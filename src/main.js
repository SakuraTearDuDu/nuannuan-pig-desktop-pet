const { app, BrowserWindow, Menu, Tray, ipcMain, dialog, screen, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');

const CELL_WIDTH = 192;
const CELL_HEIGHT = 208;
const ATLAS_WIDTH = 1536;
const ATLAS_HEIGHT = 1872;
const SCALES = [0.75, 1, 1.25, 1.5];

const ROOT_DIR = path.join(__dirname, '..');
const ASSETS_DIR = path.join(ROOT_DIR, 'assets');
const PET_JSON_PATH = path.join(ASSETS_DIR, 'pet.json');
const SPRITESHEET_PATH = path.join(ASSETS_DIR, 'spritesheet.webp');
const TRAY_ICON_PATH = path.join(ASSETS_DIR, 'tray.png');

let mainWindow = null;
let tray = null;
let settings = null;
let dragState = null;
let isQuitting = false;

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function defaultBounds(scale) {
  const display = screen.getPrimaryDisplay();
  const area = display.workArea;
  return {
    x: Math.round(area.x + area.width - CELL_WIDTH * scale - 80),
    y: Math.round(area.y + area.height - CELL_HEIGHT * scale - 80)
  };
}

function readSettings() {
  const defaults = {
    scale: 1,
    alwaysOnTop: true,
    hidden: false,
    bounds: null
  };

  try {
    const parsed = JSON.parse(fs.readFileSync(getSettingsPath(), 'utf8'));
    const scale = SCALES.includes(parsed.scale) ? parsed.scale : defaults.scale;
    return {
      ...defaults,
      ...parsed,
      scale,
      alwaysOnTop: typeof parsed.alwaysOnTop === 'boolean' ? parsed.alwaysOnTop : defaults.alwaysOnTop,
      hidden: typeof parsed.hidden === 'boolean' ? parsed.hidden : defaults.hidden
    };
  } catch {
    return defaults;
  }
}

function saveSettings() {
  if (!settings) {
    return;
  }

  fs.mkdirSync(app.getPath('userData'), { recursive: true });
  fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2));
}

function parseWebpSize(filePath) {
  const data = fs.readFileSync(filePath);
  if (data.length < 30 || data.toString('ascii', 0, 4) !== 'RIFF' || data.toString('ascii', 8, 12) !== 'WEBP') {
    throw new Error('spritesheet.webp is not a valid WEBP RIFF file.');
  }

  let offset = 12;
  while (offset + 8 <= data.length) {
    const chunk = data.toString('ascii', offset, offset + 4);
    const size = data.readUInt32LE(offset + 4);
    const start = offset + 8;

    if (chunk === 'VP8X') {
      return {
        width: 1 + data.readUIntLE(start + 4, 3),
        height: 1 + data.readUIntLE(start + 7, 3)
      };
    }

    if (chunk === 'VP8 ' && start + 10 <= data.length) {
      return {
        width: data.readUInt16LE(start + 6) & 0x3fff,
        height: data.readUInt16LE(start + 8) & 0x3fff
      };
    }

    if (chunk === 'VP8L' && start + 5 <= data.length) {
      const bits = data.readUInt32LE(start + 1);
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1
      };
    }

    offset = start + size + (size % 2);
  }

  throw new Error('Unable to read WEBP dimensions.');
}

function validateAssets() {
  if (!fs.existsSync(PET_JSON_PATH)) {
    throw new Error(`Missing ${PET_JSON_PATH}`);
  }
  if (!fs.existsSync(SPRITESHEET_PATH)) {
    throw new Error(`Missing ${SPRITESHEET_PATH}`);
  }

  const pet = JSON.parse(fs.readFileSync(PET_JSON_PATH, 'utf8'));
  if (pet.id !== 'dudu' || pet.spritesheetPath !== 'spritesheet.webp') {
    throw new Error('pet.json must describe the bundled Dudu pet and spritesheet.webp.');
  }

  const size = parseWebpSize(SPRITESHEET_PATH);
  if (size.width !== ATLAS_WIDTH || size.height !== ATLAS_HEIGHT) {
    throw new Error(`spritesheet.webp must be ${ATLAS_WIDTH}x${ATLAS_HEIGHT}; found ${size.width}x${size.height}.`);
  }

  return pet;
}

function windowSize() {
  return {
    width: Math.round(CELL_WIDTH * settings.scale),
    height: Math.round(CELL_HEIGHT * settings.scale)
  };
}

function enforceWindowSize() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  const bounds = mainWindow.getBounds();
  const size = windowSize();
  if (bounds.width !== size.width || bounds.height !== size.height) {
    mainWindow.setBounds({
      x: bounds.x,
      y: bounds.y,
      ...size
    });
  }
}

function normalizeBounds(bounds) {
  const size = windowSize();
  if (!bounds || !Number.isFinite(bounds.x) || !Number.isFinite(bounds.y)) {
    return { ...defaultBounds(settings.scale), ...size };
  }

  return {
    x: Math.round(bounds.x),
    y: Math.round(bounds.y),
    ...size
  };
}

function emitSettings() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send('settings-updated', {
    scale: settings.scale,
    alwaysOnTop: settings.alwaysOnTop,
    hidden: settings.hidden
  });
}

function setWindowVisibility(visible) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  settings.hidden = !visible;
  if (visible) {
    mainWindow.showInactive();
  } else {
    mainWindow.hide();
  }
  saveSettings();
  updateTrayMenu();
  emitSettings();
}

function setScale(scale) {
  if (!SCALES.includes(scale) || !mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  const bounds = mainWindow.getBounds();
  settings.scale = scale;
  const size = windowSize();
  mainWindow.setBounds({
    x: bounds.x,
    y: bounds.y,
    ...size
  });
  settings.bounds = mainWindow.getBounds();
  saveSettings();
  updateTrayMenu();
  emitSettings();
}

function setAlwaysOnTop(enabled) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  settings.alwaysOnTop = enabled;
  mainWindow.setAlwaysOnTop(enabled, enabled ? 'screen-saver' : 'normal');
  saveSettings();
  updateTrayMenu();
  emitSettings();
}

function resetPosition() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.setBounds(normalizeBounds(defaultBounds(settings.scale)));
  settings.bounds = mainWindow.getBounds();
  settings.hidden = false;
  mainWindow.showInactive();
  saveSettings();
  updateTrayMenu();
  emitSettings();
}

function buildMenuTemplate(isTrayMenu) {
  const visibilityLabel = settings.hidden ? '显示 暖暖猪' : '隐藏 暖暖猪';
  return [
    {
      label: visibilityLabel,
      click: () => setWindowVisibility(settings.hidden)
    },
    {
      label: '始终置顶',
      type: 'checkbox',
      checked: settings.alwaysOnTop,
      click: menuItem => setAlwaysOnTop(menuItem.checked)
    },
    { type: 'separator' },
    {
      label: '缩放',
      submenu: SCALES.map(scale => ({
        label: `${Math.round(scale * 100)}%`,
        type: 'radio',
        checked: settings.scale === scale,
        click: () => setScale(scale)
      }))
    },
    {
      label: '重置位置',
      click: resetPosition
    },
    { type: 'separator' },
    {
      label: isTrayMenu ? '退出 暖暖猪-桌面宠物' : '退出',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ];
}

function popupPetMenu() {
  Menu.buildFromTemplate(buildMenuTemplate(false)).popup({ window: mainWindow });
}

function updateTrayMenu() {
  if (!tray) {
    return;
  }
  tray.setContextMenu(Menu.buildFromTemplate(buildMenuTemplate(true)));
}

function createTray() {
  const image = nativeImage.createFromPath(TRAY_ICON_PATH);
  tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image);
  tray.setToolTip('暖暖猪-桌面宠物');
  tray.on('click', () => setWindowVisibility(settings.hidden));
  updateTrayMenu();
}

function hideDockIconOnMac() {
  if (process.platform === 'darwin' && app.dock) {
    app.dock.hide();
  }
}

function createWindow(pet) {
  const bounds = normalizeBounds(settings.bounds);
  mainWindow = new BrowserWindow({
    ...bounds,
    show: false,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: settings.alwaysOnTop,
    backgroundColor: '#00000000',
    icon: TRAY_ICON_PATH,
    title: '暖暖猪-桌面宠物',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.setMenu(null);
  mainWindow.setAlwaysOnTop(settings.alwaysOnTop, settings.alwaysOnTop ? 'screen-saver' : 'normal');
  mainWindow.webContents.setVisualZoomLevelLimits(1, 1);
  mainWindow.webContents.setZoomFactor(1);
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  if (process.env.DUDU_PET_SMOKE_TEST === '1') {
    mainWindow.webContents.once('did-finish-load', () => {
      console.log('DUDU_PET_SMOKE_LOADED');
    });
    mainWindow.once('ready-to-show', () => {
      console.log('DUDU_PET_SMOKE_READY');
      setTimeout(() => {
        isQuitting = true;
        app.quit();
      }, 400);
    });
  }

  mainWindow.once('ready-to-show', () => {
    if (settings.hidden) {
      mainWindow.hide();
    } else {
      mainWindow.showInactive();
    }
  });

  mainWindow.on('close', event => {
    if (!isQuitting) {
      event.preventDefault();
      setWindowVisibility(false);
      return;
    }

    settings.bounds = mainWindow.getBounds();
    saveSettings();
  });

  mainWindow.on('moved', () => {
    if (!dragState && mainWindow && !mainWindow.isDestroyed()) {
      enforceWindowSize();
      settings.bounds = mainWindow.getBounds();
      saveSettings();
    }
  });

  mainWindow.on('resize', enforceWindowSize);
}

ipcMain.handle('pet:get-initial-state', () => ({
  scale: settings.scale,
  alwaysOnTop: settings.alwaysOnTop,
  hidden: settings.hidden,
  cellWidth: CELL_WIDTH,
  cellHeight: CELL_HEIGHT
}));

ipcMain.handle('pet:begin-drag', (_event, point) => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  const cursor = screen.getCursorScreenPoint();
  dragState = {
    screenX: cursor.x,
    screenY: cursor.y,
    bounds: mainWindow.getBounds()
  };
  enforceWindowSize();
});

ipcMain.handle('pet:move-drag', () => {
  if (!mainWindow || !dragState || mainWindow.isDestroyed()) {
    return;
  }

  const cursor = screen.getCursorScreenPoint();
  const size = windowSize();
  const nextX = Math.round(dragState.bounds.x + cursor.x - dragState.screenX);
  const nextY = Math.round(dragState.bounds.y + cursor.y - dragState.screenY);
  mainWindow.setBounds({
    x: nextX,
    y: nextY,
    ...size
  });
});

ipcMain.handle('pet:end-drag', () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    dragState = null;
    return;
  }

  dragState = null;
  enforceWindowSize();
  settings.bounds = mainWindow.getBounds();
  saveSettings();
});

ipcMain.handle('pet:show-context-menu', () => {
  popupPetMenu();
});

app.whenReady().then(() => {
  hideDockIconOnMac();

  try {
    const pet = validateAssets();
    settings = readSettings();
    createWindow(pet);
    createTray();
  } catch (error) {
    dialog.showErrorBox('暖暖猪-桌面宠物 启动失败', error.message);
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const pet = validateAssets();
      settings = readSettings();
      createWindow(pet);
    } else {
      setWindowVisibility(true);
    }
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', event => {
  event.preventDefault();
});
