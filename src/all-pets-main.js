const { app, BrowserWindow, Menu, Tray, ipcMain, dialog, screen, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');

const CELL_WIDTH = 192;
const CELL_HEIGHT = 208;
const ATLAS_WIDTH = 1536;
const MIN_BASE_ATLAS_HEIGHT = 1872;
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
const APP_DISPLAY_NAME = '大湾鸡总动员';
const SMOKE_ENV_VAR = 'DAWANJI_ALL_PETS_SMOKE_TEST';

const PETS = [
  { id: 'siyanji', displayName: '四眼鸡', hasSiyanjiSpecialActions: true },
  { id: 'nuannuan-pig', displayName: '暖暖猪', hasSiyanjiSpecialActions: false },
  { id: 'rebellious-burger-king', displayName: '叛逆汉堡大王', hasSiyanjiSpecialActions: false },
  { id: 'koushui-ji', displayName: '口水鸡', hasSiyanjiSpecialActions: false },
  { id: 'chuanghuo-ji', displayName: '闯祸鸡', hasSiyanjiSpecialActions: false },
  { id: 'mini-chieftain-chicken', displayName: 'mini酋长鸡', hasSiyanjiSpecialActions: false },
  { id: 'gui-fei-ji-student-uniform-pixel', displayName: '贵妃鸡（学生服）', hasSiyanjiSpecialActions: false },
  { id: 'nuannuanji-student-pig', displayName: '暖暖鸡（学生小猪版）', hasSiyanjiSpecialActions: false }
];

const BASE_ACTIONS = [
  { label: '待机', state: 'idle', duration: 0 },
  { label: '向右跑', state: 'running-right', duration: 0 },
  { label: '向左跑', state: 'running-left', duration: 0 },
  { label: '挥手', state: 'waving', duration: 0 },
  { label: '跳跃', state: 'jumping', duration: 0 },
  { label: '难过', state: 'failed', duration: 0 },
  { label: '等待', state: 'waiting', duration: 0 },
  { label: '原地跑', state: 'running', duration: 0 },
  { label: '专注', state: 'review', duration: 0 }
];

const ROOT_DIR = path.join(__dirname, '..');
const ALL_PETS_ASSETS_DIR = path.join(ROOT_DIR, 'android', 'all-pets-apk', 'app', 'src', 'main', 'assets');
const TRAY_ICON_PATH = path.join(
  ROOT_DIR,
  'build',
  process.platform === 'win32' ? 'all-pets-icon.ico' : 'all-pets-icon.png'
);

let settingsWindow = null;
let controlWindow = null;
let tray = null;
let settings = null;
let isQuitting = false;
let activeDrag = null;
let dragTimer = null;
let readyCount = 0;
let controlReady = false;
let extraActions = [];
let extraActionsManifest = null;
let longActionsManifest = null;

const instances = new Map();
const contentsToPetId = new Map();

app.setName(APP_DISPLAY_NAME);

function petIds() {
  return PETS.map(pet => pet.id);
}

function petFlagMap(value) {
  return Object.fromEntries(PETS.map(pet => [pet.id, value]));
}

function normalizePetFlagMap(value, defaultValue) {
  const source = value && typeof value === 'object' ? value : {};
  return Object.fromEntries(PETS.map(pet => [
    pet.id,
    typeof source[pet.id] === 'boolean' ? source[pet.id] : defaultValue
  ]));
}

function defaultSettings() {
  return {
    scale: 1,
    alwaysOnTop: true,
    hidden: false,
    inactivitySadTimeoutMs: DEFAULT_INACTIVITY_SAD_TIMEOUT_MS,
    boundsByPet: {},
    controlBounds: null,
    enabledByPet: petFlagMap(true),
    actionTargetByPet: petFlagMap(true),
    groupMoveEnabled: false,
    autoActionsEnabled: true
  };
}

function isSmokeTest() {
  return process.env[SMOKE_ENV_VAR] === '1';
}

function smokeLog(message) {
  if (!isSmokeTest()) {
    return;
  }
  console.log(message);
  if (process.env.DAWANJI_ALL_PETS_SMOKE_LOG) {
    fs.appendFileSync(process.env.DAWANJI_ALL_PETS_SMOKE_LOG, `${message}\n`);
  }
}

function scheduleSmokeTimeout() {
  if (!isSmokeTest()) {
    return;
  }
  const timer = setTimeout(() => {
    smokeLog(`${SMOKE_ENV_VAR}_TIMEOUT:pets=${readyCount}/${enabledPets().length};control=${controlReady}`);
    isQuitting = true;
    app.quit();
  }, 45000);
  if (typeof timer.unref === 'function') {
    timer.unref();
  }
}

function petAssetName(pet, fileName) {
  return fileName.startsWith(`${pet.id}-`) ? fileName : `${pet.id}-${fileName}`;
}

function petAssetPath(pet, fileName) {
  return path.join(ALL_PETS_ASSETS_DIR, petAssetName(pet, fileName));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
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

function validateBaseSpritesheet(filePath) {
  const size = parseWebpSize(filePath);
  if (size.width !== ATLAS_WIDTH || size.height < MIN_BASE_ATLAS_HEIGHT || size.height % CELL_HEIGHT !== 0) {
    throw new Error(`${path.basename(filePath)} must be ${ATLAS_WIDTH} wide and at least ${MIN_BASE_ATLAS_HEIGHT} high; found ${size.width}x${size.height}.`);
  }
  return size;
}

function validateSpecialManifest(manifest, manifestName, spritesheetName, rowsKey) {
  if (!manifest || manifest.cellWidth !== CELL_WIDTH || manifest.cellHeight !== CELL_HEIGHT) {
    throw new Error(`${manifestName} must use ${CELL_WIDTH}x${CELL_HEIGHT} cells.`);
  }
  if (!Number.isInteger(manifest.columns) || manifest.columns < 1) {
    throw new Error(`${manifestName} must declare a positive columns value.`);
  }
  const rows = manifest[rowsKey];
  if (!Array.isArray(rows) || rows.length < 1) {
    throw new Error(`${manifestName} must contain ${rowsKey}.`);
  }
  for (const row of rows) {
    if (!row.id || !row.label || !Number.isInteger(row.row) || !Number.isInteger(row.frames)) {
      throw new Error(`${manifestName} contains incomplete action metadata.`);
    }
  }

  const size = parseWebpSize(spritesheetName);
  const expectedWidth = CELL_WIDTH * manifest.columns;
  const expectedRows = rowsKey === 'actions'
    ? Math.max(...rows.map(row => row.row + (row.rowCount || Math.ceil(row.frames / manifest.columns))))
    : rows.length;
  const expectedHeight = CELL_HEIGHT * expectedRows;
  if (size.width !== expectedWidth || size.height < expectedHeight) {
    throw new Error(`${path.basename(spritesheetName)} dimensions do not match ${manifestName}.`);
  }
}

function validateAssets() {
  for (const pet of PETS) {
    const petJsonPath = petAssetPath(pet, 'pet.json');
    const spritesheetPath = petAssetPath(pet, 'spritesheet.webp');
    if (!fs.existsSync(petJsonPath)) {
      throw new Error(`Missing ${petJsonPath}`);
    }
    if (!fs.existsSync(spritesheetPath)) {
      throw new Error(`Missing ${spritesheetPath}`);
    }

    const petJson = readJson(petJsonPath);
    if (petJson.id !== pet.id || petJson.spritesheetPath !== 'spritesheet.webp') {
      throw new Error(`${path.basename(petJsonPath)} must describe ${pet.id} and spritesheet.webp.`);
    }
    validateBaseSpritesheet(spritesheetPath);
  }

  const siyanji = PETS[0];
  const extraManifestPath = petAssetPath(siyanji, 'siyanji-extra-actions.json');
  const extraSpritesheetPath = petAssetPath(siyanji, 'siyanji-extra-actions.webp');
  const longManifestPath = petAssetPath(siyanji, 'siyanji-long-actions.json');
  const longSpritesheetPath = petAssetPath(siyanji, 'siyanji-long-actions.webp');
  extraActionsManifest = readJson(extraManifestPath);
  longActionsManifest = readJson(longManifestPath);
  validateSpecialManifest(extraActionsManifest, 'siyanji-extra-actions.json', extraSpritesheetPath, 'rows');
  validateSpecialManifest(longActionsManifest, 'siyanji-long-actions.json', longSpritesheetPath, 'actions');

  extraActions = extraActionsManifest.rows.map(row => ({
    label: row.label,
    state: row.id
  }));
}

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
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

function readSettings() {
  const defaults = defaultSettings();

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
      ),
      boundsByPet: parsed.boundsByPet && typeof parsed.boundsByPet === 'object' ? parsed.boundsByPet : {},
      controlBounds: parsed.controlBounds && typeof parsed.controlBounds === 'object' ? parsed.controlBounds : null,
      enabledByPet: normalizePetFlagMap(parsed.enabledByPet, true),
      actionTargetByPet: normalizePetFlagMap(parsed.actionTargetByPet, true),
      groupMoveEnabled: typeof parsed.groupMoveEnabled === 'boolean'
        ? parsed.groupMoveEnabled
        : defaults.groupMoveEnabled,
      autoActionsEnabled: typeof parsed.autoActionsEnabled === 'boolean'
        ? parsed.autoActionsEnabled
        : defaults.autoActionsEnabled
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

function windowSize() {
  return {
    width: Math.round(CELL_WIDTH * settings.scale),
    height: Math.round(CELL_HEIGHT * settings.scale)
  };
}

function clampBounds(bounds) {
  const display = screen.getPrimaryDisplay();
  const area = display.workArea;
  const minX = area.x;
  const minY = area.y;
  const maxX = area.x + Math.max(0, area.width - bounds.width);
  const maxY = area.y + Math.max(0, area.height - bounds.height);
  return {
    x: Math.max(minX, Math.min(maxX, Math.round(bounds.x))),
    y: Math.max(minY, Math.min(maxY, Math.round(bounds.y))),
    width: bounds.width,
    height: bounds.height
  };
}

function defaultBounds(index, total) {
  const display = screen.getPrimaryDisplay();
  const area = display.workArea;
  const size = windowSize();
  const gap = 12;
  const maxColumnsByWidth = Math.max(1, Math.floor((area.width + gap) / Math.max(1, size.width + gap)));
  const columns = Math.min(4, maxColumnsByWidth, Math.max(1, total));
  const rows = Math.ceil(total / columns);
  const column = index % columns;
  const row = Math.floor(index / columns);
  const gridWidth = columns * size.width + (columns - 1) * gap;
  const gridHeight = rows * size.height + (rows - 1) * gap;
  return clampBounds({
    x: area.x + Math.round((area.width - gridWidth) / 2) + column * (size.width + gap),
    y: area.y + Math.round((area.height - gridHeight) / 2) + row * (size.height + gap),
    ...size
  });
}

function normalizeBounds(pet, index, total) {
  const size = windowSize();
  const saved = settings.boundsByPet[pet.id];
  if (!saved || typeof saved.x !== 'number' || typeof saved.y !== 'number') {
    return defaultBounds(index, total);
  }
  return clampBounds({
    x: saved.x,
    y: saved.y,
    ...size
  });
}

function enabledPets() {
  return PETS.filter(pet => settings.enabledByPet[pet.id] !== false);
}

function actionTargetPetIds() {
  return PETS
    .filter(pet => settings.enabledByPet[pet.id] !== false && settings.actionTargetByPet[pet.id] !== false)
    .map(pet => pet.id);
}

function actionTargetMemberIds() {
  return PETS
    .filter(pet => settings.actionTargetByPet[pet.id] !== false)
    .map(pet => pet.id);
}

function siyanjiSpecialAvailable() {
  return settings.enabledByPet.siyanji !== false
    && settings.actionTargetByPet.siyanji !== false
    && instances.has('siyanji');
}

function settingsPayload() {
  return {
    scale: settings.scale,
    alwaysOnTop: settings.alwaysOnTop,
    hidden: settings.hidden,
    inactivitySadTimeoutMs: settings.inactivitySadTimeoutMs,
    groupMoveEnabled: settings.groupMoveEnabled,
    autoActionsEnabled: settings.autoActionsEnabled
  };
}

function controlState() {
  const targetIds = actionTargetPetIds();
  const actionTargetIds = actionTargetMemberIds();
  return {
    appDisplayName: APP_DISPLAY_NAME,
    pets: PETS.map(pet => ({
      id: pet.id,
      displayName: pet.displayName,
      enabled: settings.enabledByPet[pet.id] !== false,
      actionTarget: settings.actionTargetByPet[pet.id] !== false,
      hasSiyanjiSpecialActions: pet.hasSiyanjiSpecialActions
    })),
    settings: {
      scale: settings.scale,
      hidden: settings.hidden,
      inactivitySadTimeoutMs: settings.inactivitySadTimeoutMs,
      groupMoveEnabled: settings.groupMoveEnabled,
      autoActionsEnabled: settings.autoActionsEnabled
    },
    scales: SCALES,
    inactivityOptions: INACTIVITY_SAD_TIMEOUT_OPTIONS,
    baseActions: BASE_ACTIONS,
    extraActions,
    longActions: longActionsManifest && Array.isArray(longActionsManifest.actions)
      ? longActionsManifest.actions.map(action => ({ id: action.id, label: action.label }))
      : [],
    targetCount: targetIds.length,
    actionTargetCount: actionTargetIds.length,
    enabledCount: enabledPets().length,
    siyanjiSpecialAvailable: siyanjiSpecialAvailable()
  };
}

function instanceFromSender(sender) {
  return instances.get(contentsToPetId.get(sender.id)) || null;
}

function canUseWindow(targetWindow) {
  return Boolean(
    targetWindow
    && !targetWindow.isDestroyed()
    && targetWindow.webContents
    && !targetWindow.webContents.isDestroyed()
  );
}

function sendToWindow(targetWindow, channel, payload) {
  if (canUseWindow(targetWindow)) {
    targetWindow.webContents.send(channel, payload);
  }
}

function screenPointFromPayload(point) {
  if (
    point
    && Number.isFinite(point.screenX)
    && Number.isFinite(point.screenY)
  ) {
    return {
      x: Math.round(point.screenX),
      y: Math.round(point.screenY)
    };
  }
  return screen.getCursorScreenPoint();
}

function savePetBounds(instance) {
  if (!instance || !instance.window || instance.window.isDestroyed()) {
    return;
  }
  settings.boundsByPet[instance.pet.id] = instance.window.getBounds();
  saveSettings();
}

function enforceWindowSize(instance) {
  if (!instance || !instance.window || instance.window.isDestroyed()) {
    return;
  }
  const size = windowSize();
  const bounds = instance.window.getBounds();
  if (bounds.width !== size.width || bounds.height !== size.height) {
    instance.window.setBounds({ x: bounds.x, y: bounds.y, ...size });
  }
}

function sendSettingsUpdated() {
  for (const instance of instances.values()) {
    sendToWindow(instance.window, 'settings-updated', settingsPayload());
  }
  sendToWindow(settingsWindow, 'settings-updated', settingsPayload());
}

function sendControlStateUpdated() {
  sendToWindow(controlWindow, 'control-state-updated', controlState());
}

function notifyStateChanged() {
  sendSettingsUpdated();
  sendControlStateUpdated();
  updateTrayMenu();
  saveSettings();
}

function sendPlayState(instance, state, transientMs = 0, options = {}) {
  sendToWindow(instance.window, 'play-state', {
    state,
    transientMs,
    persistent: Boolean(options.persistent)
  });
}

function playStateForPetIds(petIdsToPlay, state, transientMs = 0, options = {}) {
  for (const petId of petIdsToPlay) {
    const instance = instances.get(petId);
    if (instance) {
      sendPlayState(instance, state, transientMs, options);
    }
  }
}

function playAction(actionId, kind = 'base') {
  const normalizedKind = kind || 'base';
  if (normalizedKind === 'extra' || normalizedKind === 'long') {
    if (!siyanjiSpecialAvailable()) {
      return { played: false, targets: [] };
    }
    playStateForPetIds(['siyanji'], actionId, 0, { persistent: true });
    return { played: true, targets: ['siyanji'] };
  }

  const targets = actionTargetPetIds();
  if (targets.length === 0) {
    return { played: false, targets: [] };
  }
  playStateForPetIds(targets, actionId, 0, { persistent: true });
  return { played: true, targets };
}

function destroyPetWindow(instance) {
  if (!instance || !instance.window || instance.window.isDestroyed()) {
    return;
  }
  instance.allowClose = true;
  savePetBounds(instance);
  instance.window.close();
}

function syncPetWindows() {
  const enabled = enabledPets();
  const enabledIds = new Set(enabled.map(pet => pet.id));
  for (const instance of [...instances.values()]) {
    if (!enabledIds.has(instance.pet.id)) {
      destroyPetWindow(instance);
    }
  }
  enabled.forEach((pet, index) => {
    if (!instances.has(pet.id)) {
      createPetWindow(pet, index, enabled.length);
    }
  });
}

function setPetEnabled(petId, enabled) {
  if (!petIds().includes(petId)) {
    return controlState();
  }
  settings.enabledByPet[petId] = Boolean(enabled);
  syncPetWindows();
  notifyStateChanged();
  return controlState();
}

function setActionTarget(petId, enabled) {
  if (!petIds().includes(petId)) {
    return controlState();
  }
  settings.actionTargetByPet[petId] = Boolean(enabled);
  notifyStateChanged();
  return controlState();
}

function setSingleActionTarget(petId) {
  if (!petIds().includes(petId)) {
    return controlState();
  }
  settings.actionTargetByPet = Object.fromEntries(PETS.map(pet => [pet.id, pet.id === petId]));
  notifyStateChanged();
  return controlState();
}

function setAllActionTargets(enabled) {
  settings.actionTargetByPet = petFlagMap(Boolean(enabled));
  notifyStateChanged();
  return controlState();
}

function setScale(scale) {
  if (!SCALES.includes(scale)) {
    return controlState();
  }
  settings.scale = scale;
  const size = windowSize();
  for (const instance of instances.values()) {
    if (!instance.window || instance.window.isDestroyed()) {
      continue;
    }
    const bounds = instance.window.getBounds();
    instance.window.setBounds(clampBounds({ x: bounds.x, y: bounds.y, ...size }));
    savePetBounds(instance);
  }
  notifyStateChanged();
  return controlState();
}

function setInactivitySadTimeout(ms) {
  settings.inactivitySadTimeoutMs = normalizeInactivitySadTimeoutMs(ms, settings.inactivitySadTimeoutMs);
  notifyStateChanged();
  return settingsPayload();
}

function setWindowVisibility(visible) {
  settings.hidden = !visible;
  for (const instance of instances.values()) {
    if (!instance.window || instance.window.isDestroyed()) {
      continue;
    }
    if (visible) {
      instance.window.showInactive();
    } else {
      instance.window.hide();
    }
  }
  sendSettingsUpdated();
  sendControlStateUpdated();
  updateTrayMenu();
  saveSettings();
}

function resetPositions() {
  const size = windowSize();
  const enabled = enabledPets();
  enabled.forEach((pet, index) => {
    const instance = instances.get(pet.id);
    if (!instance || !instance.window || instance.window.isDestroyed()) {
      return;
    }
    instance.window.setBounds(defaultBounds(index, enabled.length));
    settings.boundsByPet[pet.id] = { ...instance.window.getBounds(), ...size };
    sendPlayState(instance, 'idle', 0, { persistent: true });
  });
  notifyStateChanged();
  return controlState();
}

function setGroupMoveEnabled(enabled) {
  settings.groupMoveEnabled = Boolean(enabled);
  notifyStateChanged();
  return controlState();
}

function setAutoActionsEnabled(enabled) {
  settings.autoActionsEnabled = Boolean(enabled);
  notifyStateChanged();
  return controlState();
}

function resetAllSettings() {
  settings = defaultSettings();
  syncPetWindows();
  resetPositions();
  showControlPanel();
  notifyStateChanged();
  return controlState();
}

function openInactivitySettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }

  const parent = [...instances.values()].find(instance => instance.window && !instance.window.isDestroyed());
  settingsWindow = new BrowserWindow({
    width: 360,
    height: 240,
    show: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    title: '无互动难过时间',
    parent: parent ? parent.window : undefined,
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
  settingsWindow.once('ready-to-show', () => {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.show();
    }
  });
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

function controlWindowBounds() {
  const saved = settings.controlBounds;
  if (
    saved
    && typeof saved.x === 'number'
    && typeof saved.y === 'number'
    && typeof saved.width === 'number'
    && typeof saved.height === 'number'
  ) {
    return {
      x: Math.round(saved.x),
      y: Math.round(saved.y),
      width: Math.max(720, Math.round(saved.width)),
      height: Math.max(560, Math.round(saved.height))
    };
  }
  return {
    width: 1180,
    height: 760
  };
}

function saveControlBounds() {
  if (!controlWindow || controlWindow.isDestroyed()) {
    return;
  }
  settings.controlBounds = controlWindow.getBounds();
  saveSettings();
}

function checkSmokeReady() {
  if (!isSmokeTest()) {
    return;
  }
  if (controlReady && readyCount >= enabledPets().length) {
    setTimeout(() => {
      isQuitting = true;
      app.quit();
    }, 400);
  }
}

function createControlWindow() {
  if (controlWindow && !controlWindow.isDestroyed()) {
    return;
  }

  const createdWindow = new BrowserWindow({
    ...controlWindowBounds(),
    show: false,
    minWidth: 900,
    minHeight: 560,
    title: APP_DISPLAY_NAME,
    icon: TRAY_ICON_PATH,
    backgroundColor: '#f7fbff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  controlWindow = createdWindow;

  createdWindow.setMenu(null);
  createdWindow.loadFile(path.join(__dirname, 'renderer', 'all-pets-control.html'));

  if (isSmokeTest()) {
    smokeLog(`${SMOKE_ENV_VAR}_CONTROL_CREATED`);
    createdWindow.webContents.once('did-finish-load', () => {
      smokeLog(`${SMOKE_ENV_VAR}_CONTROL_LOADED`);
    });
    createdWindow.webContents.once('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
      smokeLog(`${SMOKE_ENV_VAR}_CONTROL_FAIL_LOAD:${errorCode}:${errorDescription}:${validatedURL}`);
    });
  }

  createdWindow.once('ready-to-show', () => {
    if (createdWindow.isDestroyed()) {
      return;
    }
    controlReady = true;
    createdWindow.show();
    createdWindow.focus();
    smokeLog(`${SMOKE_ENV_VAR}_CONTROL_READY`);
    checkSmokeReady();
  });

  createdWindow.on('close', event => {
    if (!isQuitting) {
      event.preventDefault();
      createdWindow.hide();
      return;
    }
    saveControlBounds();
  });

  createdWindow.on('moved', saveControlBounds);
  createdWindow.on('resized', saveControlBounds);
  createdWindow.on('closed', () => {
    if (controlWindow === createdWindow) {
      controlWindow = null;
      controlReady = false;
    }
  });
}

function showControlPanel() {
  if (!canUseWindow(controlWindow)) {
    controlWindow = null;
    createControlWindow();
    return;
  }
  if (controlWindow.isMinimized()) {
    controlWindow.restore();
  }
  controlWindow.show();
  controlWindow.focus();
}

function buildMenuTemplate(isTrayMenu, targetPetId = null) {
  if (isTrayMenu) {
    return [
      {
        label: '打开总控面板',
        click: showControlPanel
      },
      {
        label: settings.hidden ? '显示全部宠物' : '隐藏全部宠物',
        click: () => setWindowVisibility(settings.hidden)
      },
      {
        label: '重置队形',
        click: resetPositions
      },
      { type: 'separator' },
      {
        label: `退出 ${APP_DISPLAY_NAME}`,
        click: () => {
          isQuitting = true;
          app.quit();
        }
      }
    ];
  }

  const instance = targetPetId ? instances.get(targetPetId) : null;
  const petName = instance ? instance.pet.displayName : '当前宠物';
  const isTarget = Boolean(targetPetId && settings.actionTargetByPet[targetPetId] !== false);
  return [
    {
      label: '打开总控面板',
      click: showControlPanel
    },
    {
      label: `只控制${petName}`,
      enabled: Boolean(targetPetId),
      click: () => setSingleActionTarget(targetPetId)
    },
    {
      label: isTarget ? '移出动作目标' : '加入动作目标',
      enabled: Boolean(targetPetId),
      click: () => setActionTarget(targetPetId, !isTarget)
    },
    {
      label: `隐藏${petName}`,
      enabled: Boolean(targetPetId),
      click: () => setPetEnabled(targetPetId, false)
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ];
}

function popupPetMenu(targetPetId) {
  const instance = targetPetId ? instances.get(targetPetId) : null;
  Menu.buildFromTemplate(buildMenuTemplate(false, targetPetId)).popup({
    window: instance ? instance.window : undefined
  });
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
  tray.on('click', showControlPanel);
  updateTrayMenu();
}

function stopDragTicker() {
  if (dragTimer) {
    clearInterval(dragTimer);
    dragTimer = null;
  }
}

function moveDraggedWindow() {
  if (!activeDrag || !activeDrag.instance.window || activeDrag.instance.window.isDestroyed()) {
    return;
  }

  const cursor = screen.getCursorScreenPoint();
  const size = windowSize();
  const deltaX = cursor.x - activeDrag.screenX;
  const deltaY = cursor.y - activeDrag.screenY;
  const dragState = deltaX > 2 ? 'running-right' : deltaX < -2 ? 'running-left' : 'running';

  if (activeDrag.groupMove) {
    for (const [petId, startBounds] of activeDrag.boundsByPet.entries()) {
      const instance = instances.get(petId);
      if (!instance || !instance.window || instance.window.isDestroyed()) {
        continue;
      }
      instance.window.setBounds(clampBounds({
        x: startBounds.x + deltaX,
        y: startBounds.y + deltaY,
        ...size
      }));
      if (instance !== activeDrag.instance) {
        sendPlayState(instance, dragState, 0);
      }
    }
    return;
  }

  activeDrag.instance.window.setBounds(clampBounds({
    x: activeDrag.bounds.x + deltaX,
    y: activeDrag.bounds.y + deltaY,
    ...size
  }));
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

function markPetReady(pet) {
  readyCount += 1;
  if (isSmokeTest()) {
    smokeLog(`${SMOKE_ENV_VAR}_READY:${pet.id}`);
    checkSmokeReady();
  }
}

function createPetWindow(pet, index, total) {
  const bounds = normalizeBounds(pet, index, total);
  const petWindow = new BrowserWindow({
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
    title: `${APP_DISPLAY_NAME} - ${pet.displayName}`,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  const instance = { pet, window: petWindow, allowClose: false };
  instances.set(pet.id, instance);
  const webContentsId = petWindow.webContents.id;
  contentsToPetId.set(webContentsId, pet.id);

  petWindow.setMenu(null);
  petWindow.setAlwaysOnTop(settings.alwaysOnTop, settings.alwaysOnTop ? 'screen-saver' : 'normal');
  petWindow.webContents.setVisualZoomLevelLimits(1, 1);
  petWindow.webContents.setZoomFactor(1);
  petWindow.loadFile(path.join(__dirname, 'renderer', 'all-pets.html'), {
    query: { pet: pet.id }
  });

  if (isSmokeTest()) {
    smokeLog(`${SMOKE_ENV_VAR}_CREATED:${pet.id}`);
    petWindow.webContents.once('did-finish-load', () => {
      smokeLog(`${SMOKE_ENV_VAR}_LOADED:${pet.id}`);
    });
    petWindow.webContents.once('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
      smokeLog(`${SMOKE_ENV_VAR}_FAIL_LOAD:${pet.id}:${errorCode}:${errorDescription}:${validatedURL}`);
    });
    petWindow.webContents.once('render-process-gone', (_event, details) => {
      smokeLog(`${SMOKE_ENV_VAR}_RENDER_GONE:${pet.id}:${details.reason}`);
    });
  }

  petWindow.once('ready-to-show', () => {
    if (petWindow.isDestroyed()) {
      return;
    }
    if (settings.hidden) {
      petWindow.hide();
    } else {
      petWindow.showInactive();
    }
    markPetReady(pet);
  });

  petWindow.on('close', event => {
    if (!isQuitting && !instance.allowClose) {
      event.preventDefault();
      petWindow.hide();
      return;
    }
    savePetBounds(instance);
  });

  petWindow.on('moved', () => {
    if (activeDrag && activeDrag.instance === instance) {
      return;
    }
    enforceWindowSize(instance);
    savePetBounds(instance);
  });

  petWindow.on('resize', () => enforceWindowSize(instance));
  petWindow.on('closed', () => {
    contentsToPetId.delete(webContentsId);
    instances.delete(pet.id);
    instance.allowClose = false;
  });
}

function createAllPetWindows() {
  const enabled = enabledPets();
  enabled.forEach((pet, index) => createPetWindow(pet, index, enabled.length));
}

ipcMain.handle('pet:get-initial-state', event => {
  const instance = instanceFromSender(event.sender);
  return {
    ...settingsPayload(),
    cellWidth: CELL_WIDTH,
    cellHeight: CELL_HEIGHT,
    extraActionsManifest: instance && instance.pet.hasSiyanjiSpecialActions ? extraActionsManifest : null,
    longActionsManifest: instance && instance.pet.hasSiyanjiSpecialActions ? longActionsManifest : null
  };
});

ipcMain.handle('pet:set-inactivity-sad-timeout', (_event, timeoutMs) => (
  setInactivitySadTimeout(timeoutMs)
));

ipcMain.handle('pet:begin-drag', (event, point) => {
  const instance = instanceFromSender(event.sender);
  if (!instance || !instance.window || instance.window.isDestroyed()) {
    return;
  }

  const cursor = screenPointFromPayload(point);
  const boundsByPet = new Map();
  if (settings.groupMoveEnabled) {
    for (const [petId, petInstance] of instances.entries()) {
      if (petInstance.window && !petInstance.window.isDestroyed()) {
        boundsByPet.set(petId, petInstance.window.getBounds());
      }
    }
  }
  stopDragTicker();
  activeDrag = {
    instance,
    screenX: cursor.x,
    screenY: cursor.y,
    bounds: instance.window.getBounds(),
    groupMove: settings.groupMoveEnabled,
    boundsByPet
  };
  enforceWindowSize(instance);
  startDragTicker();
});

ipcMain.handle('pet:move-drag', () => {
  moveDraggedWindow();
});

ipcMain.handle('pet:end-drag', () => {
  stopDragTicker();
  if (!activeDrag) {
    return;
  }
  const instance = activeDrag.instance;
  const groupMove = activeDrag.groupMove;
  const movedPetIds = groupMove ? [...activeDrag.boundsByPet.keys()] : [instance.pet.id];
  activeDrag = null;
  for (const petId of movedPetIds) {
    const movedInstance = instances.get(petId);
    if (!movedInstance) {
      continue;
    }
    enforceWindowSize(movedInstance);
    savePetBounds(movedInstance);
    if (groupMove && movedInstance !== instance) {
      sendPlayState(movedInstance, 'idle', 600);
    }
  }
});

ipcMain.handle('pet:show-context-menu', event => {
  const instance = instanceFromSender(event.sender);
  popupPetMenu(instance ? instance.pet.id : null);
});

ipcMain.handle('control:get-state', () => controlState());

ipcMain.handle('control:set-pet-enabled', (_event, petId, enabled) => (
  setPetEnabled(petId, enabled)
));

ipcMain.handle('control:set-action-target', (_event, petId, enabled) => (
  setActionTarget(petId, enabled)
));

ipcMain.handle('control:set-single-action-target', (_event, petId) => (
  setSingleActionTarget(petId)
));

ipcMain.handle('control:set-all-action-targets', (_event, enabled) => (
  setAllActionTargets(enabled)
));

ipcMain.handle('control:play-action', (_event, actionId, kind) => (
  playAction(actionId, kind)
));

ipcMain.handle('control:set-group-move-enabled', (_event, enabled) => (
  setGroupMoveEnabled(enabled)
));

ipcMain.handle('control:set-auto-actions-enabled', (_event, enabled) => (
  setAutoActionsEnabled(enabled)
));

ipcMain.handle('control:set-scale', (_event, scale) => (
  setScale(Number(scale))
));

ipcMain.handle('control:show-panel', () => {
  showControlPanel();
});

ipcMain.handle('control:reset-positions', () => (
  resetPositions()
));

ipcMain.handle('control:reset-all-settings', () => (
  resetAllSettings()
));

ipcMain.handle('control:set-window-visibility', (_event, visible) => {
  setWindowVisibility(Boolean(visible));
  return controlState();
});

ipcMain.handle('control:quit', () => {
  isQuitting = true;
  app.quit();
});

app.whenReady().then(() => {
  hideDockIconOnMac();
  smokeLog(`${SMOKE_ENV_VAR}_START`);
  scheduleSmokeTimeout();

  try {
    validateAssets();
    smokeLog(`${SMOKE_ENV_VAR}_ASSETS_OK`);
    settings = readSettings();
    createAllPetWindows();
    createControlWindow();
    createTray();
  } catch (error) {
    smokeLog(`${SMOKE_ENV_VAR}_ERROR:${error.message}`);
    dialog.showErrorBox(`${APP_DISPLAY_NAME} 启动失败`, error.message);
    app.quit();
  }

  app.on('activate', () => {
    if (instances.size === 0) {
      validateAssets();
      settings = readSettings();
      createAllPetWindows();
    }
    showControlPanel();
  });
});

app.on('before-quit', () => {
  isQuitting = true;
  stopDragTicker();
});

app.on('window-all-closed', event => {
  if (!isQuitting) {
    event.preventDefault();
  }
});
