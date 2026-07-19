const { app, BrowserWindow, Menu, Tray, ipcMain, dialog, screen, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');

const CELL_WIDTH = 192;
const CELL_HEIGHT = 208;
const ATLAS_WIDTH = 1536;
const ATLAS_HEIGHT = 1872;
const SCALES = [0.75, 1, 1.25, 1.5];
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
const APP_DISPLAY_NAME = '四眼鸡桌面宠物';
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

const ROOT_DIR = path.join(__dirname, '..');
const ASSETS_DIR = path.join(ROOT_DIR, 'assets');
const PET_JSON_PATH = path.join(ASSETS_DIR, 'pet.json');
const SPRITESHEET_PATH = path.join(ASSETS_DIR, 'spritesheet.webp');
const EXTRA_ACTIONS_PATH = path.join(ASSETS_DIR, 'siyanji-extra-actions.webp');
const EXTRA_ACTIONS_JSON_PATH = path.join(ASSETS_DIR, 'siyanji-extra-actions.json');
const LONG_ACTIONS_PATH = path.join(ASSETS_DIR, 'siyanji-long-actions.webp');
const LONG_ACTIONS_JSON_PATH = path.join(ASSETS_DIR, 'siyanji-long-actions.json');
const TRAY_ICON_PATH = path.join(ASSETS_DIR, 'tray.png');

let mainWindow = null;
let settingsWindow = null;
let tray = null;
let settings = null;
let dragState = null;
let dragTimer = null;
let isQuitting = false;
let extraActions = [];
let extraActionsManifest = null;
let longActionsManifest = null;

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
    inactivitySadTimeoutMs: DEFAULT_INACTIVITY_SAD_TIMEOUT_MS,
    bounds: null
  };

  try {
    const parsed = JSON.parse(fs.readFileSync(getSettingsPath(), 'utf8'));
    const scale = SCALES.includes(parsed.scale) ? parsed.scale : defaults.scale;
    const inactivitySadTimeoutMs = normalizeInactivitySadTimeoutMs(
      parsed.inactivitySadTimeoutMs,
      defaults.inactivitySadTimeoutMs
    );
    return {
      ...defaults,
      ...parsed,
      scale,
      alwaysOnTop: typeof parsed.alwaysOnTop === 'boolean' ? parsed.alwaysOnTop : defaults.alwaysOnTop,
      hidden: typeof parsed.hidden === 'boolean' ? parsed.hidden : defaults.hidden,
      inactivitySadTimeoutMs
    };
  } catch {
    return defaults;
  }
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

function validateLongManifest() {
  if (!fs.existsSync(LONG_ACTIONS_PATH) || !fs.existsSync(LONG_ACTIONS_JSON_PATH)) {
    longActionsManifest = null;
    return;
  }

  longActionsManifest = JSON.parse(fs.readFileSync(LONG_ACTIONS_JSON_PATH, 'utf8'));
  const longSize = parseWebpSize(LONG_ACTIONS_PATH);
  if (longActionsManifest.version !== 1) {
    throw new Error('Long actions manifest must be version 1.');
  }
  if (longActionsManifest.cellWidth !== CELL_WIDTH || longActionsManifest.cellHeight !== CELL_HEIGHT) {
    throw new Error('Long actions must use 192x208 cells.');
  }
  if (longActionsManifest.columns !== 24 || !Number.isInteger(longActionsManifest.rows) || longActionsManifest.rows < 1) {
    throw new Error('Long actions atlas must use 24 columns and a positive row count.');
  }
  if (longSize.width !== CELL_WIDTH * longActionsManifest.columns || longSize.height !== CELL_HEIGHT * longActionsManifest.rows) {
    throw new Error('Long actions atlas dimensions do not match manifest.');
  }
  if (!Array.isArray(longActionsManifest.actions) || longActionsManifest.actions.length < 1) {
    throw new Error('Long actions manifest must contain at least one action.');
  }
  for (const action of longActionsManifest.actions) {
    if (!action.id || !action.label || !Number.isInteger(action.row) || !Number.isInteger(action.rowCount) || !Number.isInteger(action.frames)) {
      throw new Error('Long action metadata is incomplete.');
    }
    if (action.frames < 1 || action.row < 0 || action.rowCount < 1) {
      throw new Error(`Long action ${action.id} has invalid frame or row metadata.`);
    }
    if (!Array.isArray(action.durations) || action.durations.length !== action.frames) {
      throw new Error(`Long action ${action.id} durations do not match its frame count.`);
    }
    const expectedRows = Math.ceil(action.frames / longActionsManifest.columns);
    if (action.rowCount !== expectedRows || action.row + action.rowCount > longActionsManifest.rows) {
      throw new Error(`Long action ${action.id} exceeds atlas row bounds.`);
    }
  }
}

function validateAssets() {
  if (!fs.existsSync(PET_JSON_PATH)) {
    throw new Error(`Missing ${PET_JSON_PATH}`);
  }
  if (!fs.existsSync(SPRITESHEET_PATH)) {
    throw new Error(`Missing ${SPRITESHEET_PATH}`);
  }
  if (!fs.existsSync(EXTRA_ACTIONS_PATH)) {
    throw new Error(`Missing ${EXTRA_ACTIONS_PATH}`);
  }
  if (!fs.existsSync(EXTRA_ACTIONS_JSON_PATH)) {
    throw new Error(`Missing ${EXTRA_ACTIONS_JSON_PATH}`);
  }

  const pet = JSON.parse(fs.readFileSync(PET_JSON_PATH, 'utf8'));
  if (pet.id !== 'siyanji' || pet.spritesheetPath !== 'spritesheet.webp') {
    throw new Error('pet.json must describe the bundled Siyanji pet and spritesheet.webp.');
  }

  const size = parseWebpSize(SPRITESHEET_PATH);
  if (size.width !== ATLAS_WIDTH || size.height !== ATLAS_HEIGHT) {
    throw new Error(`spritesheet.webp must be ${ATLAS_WIDTH}x${ATLAS_HEIGHT}; found ${size.width}x${size.height}.`);
  }

  extraActionsManifest = JSON.parse(fs.readFileSync(EXTRA_ACTIONS_JSON_PATH, 'utf8'));
  const extraSize = parseWebpSize(EXTRA_ACTIONS_PATH);
  if (extraSize.width !== CELL_WIDTH * extraActionsManifest.columns || extraSize.height !== CELL_HEIGHT * extraActionsManifest.rows.length) {
    throw new Error('siyanji-extra-actions.webp dimensions do not match manifest.');
  }
  extraActions = Array.isArray(extraActionsManifest.rows)
    ? extraActionsManifest.rows
      .filter(row => row && row.id && row.label)
      .map(row => ({
        label: row.label,
        state: row.id,
        duration: Number.isFinite(row.menuDurationMs)
          ? row.menuDurationMs
          : Array.isArray(row.durations)
            ? row.durations.reduce((total, duration) => total + (Number(duration) || 0), 0)
            : 0
      }))
    : [];
  validateLongManifest();

  return pet;
}

function normalizeBounds(bounds) {
  if (!bounds || typeof bounds.x !== 'number' || typeof bounds.y !== 'number') {
    return defaultBounds(settings.scale);
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

function playState(state, transientMs = 0, options = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send('play-state', {
    state,
    transientMs,
    persistent: options.persistent === true
  });
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
  const actionSections = [
    {
      label: '基础动作',
      submenu: BASE_ACTIONS.map(action => ({
        label: action.label,
        click: () => playState(action.state, 0, { persistent: true })
      }))
    }
  ];

  if (extraActions.length > 0) {
    actionSections.push({
      label: '扩展动作',
      submenu: extraActions.map(action => ({
        label: action.label,
        click: () => playState(action.state, 0, { persistent: true })
      }))
    });
  }

  if (longActionsManifest && Array.isArray(longActionsManifest.actions) && longActionsManifest.actions.length > 0) {
    actionSections.push({
      label: '长动作',
      submenu: longActionsManifest.actions.map(action => ({
        label: action.label,
        click: () => playState(action.id, 0, { persistent: true })
      }))
    });
  }

  return [
    ...actionSections,
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
      label: isTrayMenu ? `退出 ${APP_DISPLAY_NAME}` : '退出',
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
  tray.setToolTip(APP_DISPLAY_NAME);
  tray.on('click', () => setWindowVisibility(settings.hidden));
  updateTrayMenu();
}

function stopDragTicker() {
  if (dragTimer) {
    clearInterval(dragTimer);
    dragTimer = null;
  }
}

function moveDraggedWindow() {
  if (!mainWindow || !dragState || mainWindow.isDestroyed()) {
    return;
  }

  const cursor = screen.getCursorScreenPoint();
  const size = windowSize();
  const nextX = Math.round(dragState.bounds.x + cursor.x - dragState.screenX);
  const nextY = Math.round(dragState.bounds.y + cursor.y - dragState.screenY);
  const bounds = mainWindow.getBounds();
  if (bounds.x === nextX && bounds.y === nextY && bounds.width === size.width && bounds.height === size.height) {
    return;
  }

  mainWindow.setBounds({
    x: nextX,
    y: nextY,
    ...size
  });
}

function startDragTicker() {
  stopDragTicker();
  dragTimer = setInterval(moveDraggedWindow, 16);
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
    title: APP_DISPLAY_NAME,
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

  if (process.env.SIYANJI_PET_SMOKE_TEST === '1') {
    mainWindow.webContents.once('did-finish-load', () => {
      console.log('SIYANJI_PET_SMOKE_LOADED');
    });
    mainWindow.once('ready-to-show', () => {
      console.log('SIYANJI_PET_SMOKE_READY');
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
  cellHeight: CELL_HEIGHT,
  extraActionsManifest,
  longActionsManifest
}));

ipcMain.handle('pet:set-inactivity-sad-timeout', (_event, timeoutMs) => (
  setInactivitySadTimeout(timeoutMs)
));

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
  startDragTicker();
});

ipcMain.handle('pet:move-drag', () => {
  moveDraggedWindow();
});

ipcMain.handle('pet:end-drag', () => {
  stopDragTicker();
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
    dialog.showErrorBox(`${APP_DISPLAY_NAME} 启动失败`, error.message);
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
  stopDragTicker();
});

app.on('window-all-closed', event => {
  event.preventDefault();
});
