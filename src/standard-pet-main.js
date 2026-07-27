const { app, BrowserWindow, Menu, Tray, ipcMain, dialog, screen, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');

const CELL_WIDTH = 192;
const CELL_HEIGHT = 208;
const ATLAS_WIDTH = 1536;
const SCALES = [0.75, 1, 1.25, 1.5, 2];
const DEFAULT_INACTIVITY_SAD_TIMEOUT_MS = 5 * 60 * 1000;
const MIN_CUSTOM_INACTIVITY_SAD_TIMEOUT_MS = 10 * 1000;
const MAX_CUSTOM_INACTIVITY_SAD_TIMEOUT_MS = 24 * 60 * 60 * 1000;
const INACTIVITY_SAD_TIMEOUT_OPTIONS = [
  { label: '关闭', ms: 0 },
  { label: '1 分钟', ms: 60 * 1000 },
  { label: '3 分钟', ms: 3 * 60 * 1000 },
  { label: '5 分钟', ms: 5 * 60 * 1000 },
  { label: '10 分钟', ms: 10 * 60 * 1000 },
  { label: '30 分钟', ms: 30 * 60 * 1000 }
];
const BASE_ACTIONS = [
  { label: '待机', state: 'idle', duration: 0 },
  { label: '向右跑', state: 'running-right', duration: 1800 },
  { label: '向左跑', state: 'running-left', duration: 1800 },
  { label: '挥手', state: 'waving', duration: 1200 },
  { label: '跳跃', state: 'jumping', duration: 1200 },
  { label: '难过', state: 'failed', duration: 2200 },
  { label: '等待', state: 'waiting', duration: 1800 },
  { label: '原地跑', state: 'running', duration: 1800 },
  { label: '专注', state: 'review', duration: 1800 }
];

function createStandardPetApp(options) {
  const {
    appDisplayName,
    petId,
    rendererHtml,
    smokeEnvVar,
    expectedSpriteVersionNumber = 1,
    expectedAtlasRows = 9
  } = options;

  const rootDir = path.join(__dirname, '..');
  const assetsDir = path.join(rootDir, 'assets', petId);
  const petJsonPath = path.join(assetsDir, 'pet.json');
  const spritesheetPath = path.join(assetsDir, 'spritesheet.webp');
  const trayIconPath = path.join(assetsDir, 'tray.png');
  const expectedAtlasHeight = CELL_HEIGHT * expectedAtlasRows;

  let mainWindow = null;
  let settingsWindow = null;
  let tray = null;
  let settings = null;
  let dragState = null;
  let isQuitting = false;

  app.setName(appDisplayName);

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

  function normalizeInactivitySadTimeoutMs(value, fallback = DEFAULT_INACTIVITY_SAD_TIMEOUT_MS) {
    const timeout = Number(value);
    if (!Number.isFinite(timeout)) {
      return fallback;
    }
    if (timeout <= 0) {
      return 0;
    }
    return Math.min(
      MAX_CUSTOM_INACTIVITY_SAD_TIMEOUT_MS,
      Math.max(MIN_CUSTOM_INACTIVITY_SAD_TIMEOUT_MS, Math.round(timeout))
    );
  }

  function formatInactivitySadTimeout(ms) {
    if (!ms) {
      return '关闭';
    }
    if (ms % (60 * 60 * 1000) === 0) {
      return `${ms / (60 * 60 * 1000)} 小时`;
    }
    if (ms % (60 * 1000) === 0) {
      return `${ms / (60 * 1000)} 分钟`;
    }
    if (ms % 1000 === 0) {
      return `${ms / 1000} 秒`;
    }
    return `${Math.round(ms / 1000)} 秒`;
  }

  function readSettings() {
    const defaults = {
      scale: 1,
      alwaysOnTop: true,
      hidden: false,
      inactivitySadTimeoutMs: DEFAULT_INACTIVITY_SAD_TIMEOUT_MS,
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
        hidden: typeof parsed.hidden === 'boolean' ? parsed.hidden : defaults.hidden,
        inactivitySadTimeoutMs: normalizeInactivitySadTimeoutMs(
          parsed.inactivitySadTimeoutMs,
          defaults.inactivitySadTimeoutMs
        )
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
      throw new Error(`${path.basename(filePath)} is not a valid WEBP RIFF file.`);
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

    throw new Error(`Unable to read ${path.basename(filePath)} dimensions.`);
  }

  function validateAssets() {
    if (!fs.existsSync(petJsonPath)) {
      throw new Error(`Missing ${petJsonPath}`);
    }
    if (!fs.existsSync(spritesheetPath)) {
      throw new Error(`Missing ${spritesheetPath}`);
    }
    if (!fs.existsSync(trayIconPath)) {
      throw new Error(`Missing ${trayIconPath}`);
    }

    const pet = JSON.parse(fs.readFileSync(petJsonPath, 'utf8'));
    if (pet.id !== petId || pet.spritesheetPath !== 'spritesheet.webp') {
      throw new Error(`pet.json must describe ${petId} and spritesheet.webp.`);
    }
    if (pet.spriteVersionNumber !== expectedSpriteVersionNumber) {
      throw new Error(`Expected spriteVersionNumber ${expectedSpriteVersionNumber}; found ${pet.spriteVersionNumber}.`);
    }

    const size = parseWebpSize(spritesheetPath);
    if (size.width !== ATLAS_WIDTH || size.height !== expectedAtlasHeight) {
      throw new Error(`spritesheet.webp must be ${ATLAS_WIDTH}x${expectedAtlasHeight}; found ${size.width}x${size.height}.`);
    }

    return pet;
  }

  function normalizeBounds(bounds) {
    if (!bounds || typeof bounds.x !== 'number' || typeof bounds.y !== 'number') {
      return {
        ...defaultBounds(settings.scale),
        width: CELL_WIDTH * settings.scale,
        height: CELL_HEIGHT * settings.scale
      };
    }
    return {
      x: Math.round(bounds.x),
      y: Math.round(bounds.y),
      width: CELL_WIDTH * settings.scale,
      height: CELL_HEIGHT * settings.scale
    };
  }

  function windowSize() {
    return {
      width: CELL_WIDTH * settings.scale,
      height: CELL_HEIGHT * settings.scale
    };
  }

  function enforceWindowSize() {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }
    mainWindow.setContentSize(CELL_WIDTH * settings.scale, CELL_HEIGHT * settings.scale);
  }

  function settingsPayload() {
    return {
      scale: settings.scale,
      alwaysOnTop: settings.alwaysOnTop,
      hidden: settings.hidden,
      inactivitySadTimeoutMs: settings.inactivitySadTimeoutMs
    };
  }

  function sendSettingsUpdated() {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('settings-updated', settingsPayload());
    }
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.webContents.send('settings-updated', settingsPayload());
    }
  }

  function playState(state, transientMs = 0) {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }

    mainWindow.webContents.send('play-state', { state, transientMs });
  }

  function setScale(scale) {
    settings.scale = scale;
    const bounds = mainWindow ? mainWindow.getBounds() : defaultBounds(scale);
    const size = windowSize();
    settings.bounds = {
      x: bounds.x,
      y: bounds.y,
      ...size
    };
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setBounds(settings.bounds);
      sendSettingsUpdated();
    }
    saveSettings();
    updateTrayMenu();
  }

  function setInactivitySadTimeout(ms) {
    settings.inactivitySadTimeoutMs = normalizeInactivitySadTimeoutMs(ms, settings.inactivitySadTimeoutMs);
    saveSettings();
    sendSettingsUpdated();
    updateTrayMenu();
    return settingsPayload();
  }

  function resetPosition() {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }

    const size = windowSize();
    const position = defaultBounds(settings.scale);
    mainWindow.setBounds({
      ...position,
      ...size
    });
    settings.bounds = mainWindow.getBounds();
    saveSettings();
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
    sendSettingsUpdated();
    saveSettings();
    updateTrayMenu();
  }

  function openInactivitySettingsWindow() {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.focus();
      return;
    }

    settingsWindow = new BrowserWindow({
      width: 360,
      height: 240,
      show: false,
      resizable: false,
      maximizable: false,
      minimizable: false,
      fullscreenable: false,
      title: '无互动难过时间',
      parent: mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined,
      modal: false,
      backgroundColor: '#ffffff',
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      }
    });

    settingsWindow.setMenu(null);
    settingsWindow.loadFile(path.join(__dirname, 'renderer', 'inactivity-settings.html'));
    settingsWindow.once('ready-to-show', () => settingsWindow.show());
    settingsWindow.on('closed', () => {
      settingsWindow = null;
    });
  }

  function buildMenuTemplate(isTrayMenu) {
    return [
      {
        label: '基础动作',
        submenu: BASE_ACTIONS.map(action => ({
          label: action.label,
          click: () => playState(action.state, action.duration)
        }))
      },
      {
        label: settings.hidden ? '显示' : '隐藏',
        click: () => setWindowVisibility(settings.hidden)
      },
      {
        label: '大小',
        submenu: SCALES.map(scale => ({
          label: `${Math.round(scale * 100)}%`,
          type: 'radio',
          checked: settings.scale === scale,
          click: () => setScale(scale)
        }))
      },
      {
        label: '无互动难过时间',
        submenu: [
          {
            label: `当前：${formatInactivitySadTimeout(settings.inactivitySadTimeoutMs)}`,
            enabled: false
          },
          { type: 'separator' },
          ...INACTIVITY_SAD_TIMEOUT_OPTIONS.map(option => ({
            label: option.label,
            type: 'radio',
            checked: settings.inactivitySadTimeoutMs === option.ms,
            click: () => setInactivitySadTimeout(option.ms)
          })),
          { type: 'separator' },
          {
            label: '自定义...',
            click: openInactivitySettingsWindow
          }
        ]
      },
      {
        label: '重置位置',
        click: resetPosition
      },
      { type: 'separator' },
      {
        label: isTrayMenu ? `退出 ${appDisplayName}` : '退出',
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
    const image = nativeImage.createFromPath(trayIconPath);
    tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image);
    tray.setToolTip(appDisplayName);
    tray.on('click', () => setWindowVisibility(settings.hidden));
    updateTrayMenu();
  }

  function hideDockIconOnMac() {
    if (process.platform === 'darwin' && app.dock) {
      app.dock.hide();
    }
  }

  function createWindow() {
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
      icon: trayIconPath,
      title: appDisplayName,
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
    mainWindow.loadFile(path.join(__dirname, 'renderer', rendererHtml));

    if (process.env[smokeEnvVar] === '1') {
      mainWindow.webContents.once('did-finish-load', () => {
        console.log(`${smokeEnvVar}_LOADED`);
      });
      mainWindow.once('ready-to-show', () => {
        console.log(`${smokeEnvVar}_READY`);
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
    ...settingsPayload(),
    cellWidth: CELL_WIDTH,
    cellHeight: CELL_HEIGHT
  }));

  ipcMain.handle('pet:set-inactivity-sad-timeout', (_event, timeoutMs) => (
    setInactivitySadTimeout(timeoutMs)
  ));

  ipcMain.handle('pet:begin-drag', () => {
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
      validateAssets();
      settings = readSettings();
      createWindow();
      createTray();
    } catch (error) {
      dialog.showErrorBox(`${appDisplayName} 启动失败`, error.message);
      app.quit();
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        validateAssets();
        settings = readSettings();
        createWindow();
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
}

module.exports = {
  createStandardPetApp
};
