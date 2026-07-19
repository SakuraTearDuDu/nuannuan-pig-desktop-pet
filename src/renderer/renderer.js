const CELL_WIDTH = 192;
const CELL_HEIGHT = 208;
const SPRITESHEET_SRC = '../../assets/spritesheet.webp';
const AUTO_ACTION_MIN_DELAY = 25_000;
const AUTO_ACTION_MAX_DELAY = 45_000;
const AUTO_ACTION_RETRY_DELAY = 5_000;
const DEFAULT_INACTIVITY_SAD_TIMEOUT_MS = 5 * 60 * 1000;
const SAD_REACTION_MS = 5600;
const FAILED_REACTION_MS = 2200;
const SHORT_PRESS_MS = 220;
const DRAG_CLICK_THRESHOLD_PX = 12;
const DRAG_DIRECTION_THRESHOLD_PX = 6;
const DOUBLE_CLICK_MS = 320;
const DOUBLE_CLICK_DISTANCE_PX = 18;
const DRAG_INTERACTION_REFRESH_MS = 500;
const AUTO_ACTIONS = [
  { state: 'waving', transientMs: 1200 },
  { state: 'jumping', transientMs: 1200 },
  { state: 'waiting', transientMs: 1800 },
  { state: 'review', transientMs: 1800 },
  { state: 'sleeping', transientMs: 7200 },
  { state: 'angry', transientMs: 2800 },
  { state: 'sad', transientMs: 5600 },
  { state: 'reading', transientMs: 6200 },
  { state: 'gaming', transientMs: 5200 },
  { state: 'studying', transientMs: 6200 }
];

const BASE_STATES = {
  idle: { row: 0, frames: 6, durations: [280, 110, 110, 140, 140, 320] },
  'running-right': { row: 1, frames: 8, durations: [120, 120, 120, 120, 120, 120, 120, 220] },
  'running-left': { row: 2, frames: 8, durations: [120, 120, 120, 120, 120, 120, 120, 220] },
  waving: { row: 3, frames: 4, durations: [140, 140, 140, 280] },
  jumping: { row: 4, frames: 5, durations: [140, 140, 140, 140, 280] },
  failed: { row: 5, frames: 8, durations: [140, 140, 140, 140, 140, 140, 140, 240] },
  waiting: { row: 6, frames: 6, durations: [150, 150, 150, 150, 150, 260] },
  running: { row: 7, frames: 6, durations: [120, 120, 120, 120, 120, 220] },
  review: { row: 8, frames: 6, durations: [150, 150, 150, 150, 150, 280] }
};

const canvas = document.getElementById('pet');
const ctx = canvas.getContext('2d', { alpha: true });
const spritesheet = new Image();
const extraSpritesheet = new Image();
const longSpritesheet = new Image();
let states = { ...BASE_STATES };
let extraSpritesheetReady = false;
let longSpritesheetReady = false;

let currentState = 'idle';
let frameIndex = 0;
let nextFrameAt = performance.now();
let transientUntil = 0;
let manualLoopState = null;
let pendingManualLoopState = null;
let lastPointer = null;
let dragStartPointer = null;
let dragTravel = 0;
let dragDirectionState = 'running';
let dragging = false;
let pointerDownAt = 0;
let lastShortTapAt = 0;
let lastShortTapPointer = null;
let lastDragInteractionMarkAt = 0;
let settings = {
  scale: 1,
  alwaysOnTop: true,
  hidden: false,
  inactivitySadTimeoutMs: DEFAULT_INACTIVITY_SAD_TIMEOUT_MS
};
let animationStarted = false;
let autoActionTimer = null;
let inactivitySadTimer = null;
let lastUserInteractionAt = performance.now();

ctx.imageSmoothingEnabled = false;

function stateDefinition() {
  return states[currentState] || states.idle;
}

function setState(name, transientMs = 0) {
  if (!states[name] || currentState === name) {
    if (transientMs) {
      transientUntil = performance.now() + transientMs;
    }
    return;
  }

  currentState = name;
  frameIndex = 0;
  nextFrameAt = performance.now();
  transientUntil = transientMs ? performance.now() + transientMs : 0;
}

function setManualLoopState(name) {
  if (!states[name]) {
    return;
  }

  manualLoopState = name;
  if (!canUseState(name)) {
    pendingManualLoopState = name;
    clearAutoActionTimer();
    clearInactivitySadTimer();
    return;
  }

  pendingManualLoopState = null;
  if (currentState === name) {
    frameIndex = 0;
    nextFrameAt = performance.now();
  } else {
    setState(name, 0);
  }
  transientUntil = 0;
  clearAutoActionTimer();
  clearInactivitySadTimer();
}

function clearManualLoopState() {
  manualLoopState = null;
  pendingManualLoopState = null;
}

function canUseState(name) {
  const state = states[name];
  return Boolean(
    state && (
      (state.sheet === 'extra' && extraSpritesheetReady)
      || (state.sheet === 'long' && longSpritesheetReady)
      || !state.sheet
    )
  );
}

function setPreferredState(preferredName, fallbackName, transientMs = 0) {
  setState(canUseState(preferredName) ? preferredName : fallbackName, transientMs);
}

function applyPendingManualLoopState() {
  if (pendingManualLoopState && manualLoopState === pendingManualLoopState && canUseState(pendingManualLoopState)) {
    const state = pendingManualLoopState;
    pendingManualLoopState = null;
    setManualLoopState(state);
  }
}

function restoreAfterTransient() {
  transientUntil = 0;
  const restoreState = manualLoopState && canUseState(manualLoopState)
    ? manualLoopState
    : 'idle';
  setState(restoreState);
}

function randomBetween(min, max) {
  return min + Math.round(Math.random() * (max - min));
}

function clearAutoActionTimer() {
  if (autoActionTimer) {
    window.clearTimeout(autoActionTimer);
    autoActionTimer = null;
  }
}

function clearInactivitySadTimer() {
  if (inactivitySadTimer) {
    window.clearTimeout(inactivitySadTimer);
    inactivitySadTimer = null;
  }
}

function inactivitySadTimeout() {
  const timeout = Number(settings.inactivitySadTimeoutMs);
  return Number.isFinite(timeout) && timeout > 0 ? timeout : 0;
}

function playInactivitySadReaction() {
  if (manualLoopState) {
    return;
  }

  const sadState = canUseState('sad') ? 'sad' : 'failed';
  const reactionMs = sadState === 'sad' ? SAD_REACTION_MS : FAILED_REACTION_MS;
  setState(sadState, reactionMs);
  lastUserInteractionAt = performance.now();
  scheduleInactivitySadTimer(reactionMs + inactivitySadTimeout());
}

function scheduleInactivitySadTimer(delay = inactivitySadTimeout()) {
  clearInactivitySadTimer();
  const timeout = inactivitySadTimeout();
  if (!timeout) {
    return;
  }

  inactivitySadTimer = window.setTimeout(() => {
    const now = performance.now();
    if (dragging) {
      scheduleInactivitySadTimer(1000);
      return;
    }

    const remaining = timeout - (now - lastUserInteractionAt);
    if (remaining > 50) {
      scheduleInactivitySadTimer(remaining);
      return;
    }

    playInactivitySadReaction();
  }, Math.max(250, delay));
}

function markUserInteraction() {
  lastUserInteractionAt = performance.now();
  if (!manualLoopState) {
    scheduleInactivitySadTimer();
  }
}

function refreshDragInteractionTime() {
  const now = performance.now();
  if (now - lastDragInteractionMarkAt >= DRAG_INTERACTION_REFRESH_MS) {
    lastUserInteractionAt = now;
    lastDragInteractionMarkAt = now;
  }
}

function pointerDistance(a, b) {
  if (!a || !b) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.hypot(a.screenX - b.screenX, a.screenY - b.screenY);
}

function isDoubleTap(pointer, now) {
  return Boolean(
    lastShortTapAt
    && now - lastShortTapAt <= DOUBLE_CLICK_MS
    && pointerDistance(pointer, lastShortTapPointer) <= DOUBLE_CLICK_DISTANCE_PX
  );
}

function rememberShortTap(pointer, now) {
  lastShortTapAt = now;
  lastShortTapPointer = pointer;
}

function clearShortTap() {
  lastShortTapAt = 0;
  lastShortTapPointer = null;
}

function playJumpReaction() {
  clearShortTap();
  markUserInteraction();
  setState('jumping', 950);
  if (!manualLoopState) {
    resetAutoActionTimer();
  }
}

function canPlayAutoAction(action) {
  const now = performance.now();
  const state = states[action.state];
  return Boolean(
    state
    && !dragging
    && !manualLoopState
    && currentState === 'idle'
    && (!transientUntil || now >= transientUntil)
    && canUseState(action.state)
  );
}

function scheduleAutoAction(delay = randomBetween(AUTO_ACTION_MIN_DELAY, AUTO_ACTION_MAX_DELAY)) {
  clearAutoActionTimer();
  autoActionTimer = window.setTimeout(() => {
    const availableActions = AUTO_ACTIONS.filter(canPlayAutoAction);
    if (!availableActions.length) {
      scheduleAutoAction(AUTO_ACTION_RETRY_DELAY);
      return;
    }

    const action = availableActions[Math.floor(Math.random() * availableActions.length)];
    setState(action.state, action.transientMs);
    scheduleAutoAction(action.transientMs + randomBetween(AUTO_ACTION_MIN_DELAY, AUTO_ACTION_MAX_DELAY));
  }, delay);
}

function resetAutoActionTimer() {
  scheduleAutoAction();
}

function draw() {
  const now = performance.now();

  if (transientUntil && now > transientUntil && !dragging) {
    restoreAfterTransient();
  }

  const activeState = stateDefinition();
  const sheetReady = activeState.sheet === 'extra'
    ? extraSpritesheetReady
    : activeState.sheet === 'long'
      ? longSpritesheetReady
      : true;
  if (!sheetReady) {
    if (manualLoopState === currentState) {
      clearManualLoopState();
    }
    setState('idle');
  }

  const drawableState = stateDefinition();
  if (now >= nextFrameAt) {
    frameIndex = (frameIndex + 1) % drawableState.frames;
    nextFrameAt = now + drawableState.durations[frameIndex];
  }

  ctx.clearRect(0, 0, CELL_WIDTH, CELL_HEIGHT);
  const activeImage = drawableState.sheet === 'extra'
    ? extraSpritesheet
    : drawableState.sheet === 'long'
      ? longSpritesheet
      : spritesheet;
  const column = frameIndex % (drawableState.columns || drawableState.frames);
  const row = drawableState.row + Math.floor(frameIndex / (drawableState.columns || drawableState.frames));
  ctx.drawImage(
    activeImage,
    column * CELL_WIDTH,
    row * CELL_HEIGHT,
    CELL_WIDTH,
    CELL_HEIGHT,
    0,
    0,
    CELL_WIDTH,
    CELL_HEIGHT
  );

  window.requestAnimationFrame(draw);
}

function normalizeDurations(row) {
  if (Array.isArray(row.durations) && row.durations.length === row.frames) {
    return row.durations.map(duration => Math.max(16, Number(duration) || 120));
  }
  return Array.from({ length: row.frames }, () => 120);
}

function loadExtraActions(manifest) {
  try {
    if (
      !manifest
      || manifest.cellWidth !== CELL_WIDTH
      || manifest.cellHeight !== CELL_HEIGHT
      || !Array.isArray(manifest.rows)
    ) {
      throw new Error('invalid extra action manifest');
    }

    for (const row of manifest.rows) {
      if (!row.id || !Number.isInteger(row.row) || !Number.isInteger(row.frames)) {
        continue;
      }
      states[row.id] = {
        sheet: 'extra',
        row: row.row,
        frames: row.frames,
        columns: manifest.columns || row.frames,
        durations: normalizeDurations(row)
      };
    }

    extraSpritesheet.addEventListener('load', () => {
      extraSpritesheetReady = true;
      applyPendingManualLoopState();
    }, { once: true });
    extraSpritesheet.src = `../../assets/${manifest.spritesheetPath}`;
  } catch (error) {
    console.error('Failed to load extra actions:', error);
  }
}

function loadLongActions(manifest) {
  try {
    if (
      !manifest
      || manifest.cellWidth !== CELL_WIDTH
      || manifest.cellHeight !== CELL_HEIGHT
      || !Array.isArray(manifest.actions)
    ) {
      throw new Error('invalid long action manifest');
    }

    for (const action of manifest.actions) {
      if (!action.id || !Number.isInteger(action.row) || !Number.isInteger(action.rowCount) || !Number.isInteger(action.frames)) {
        continue;
      }
      states[action.id] = {
        sheet: 'long',
        row: action.row,
        rowCount: action.rowCount,
        frames: action.frames,
        columns: manifest.columns || 24,
        durations: normalizeDurations(action)
      };
    }

    longSpritesheet.addEventListener('load', () => {
      longSpritesheetReady = true;
      applyPendingManualLoopState();
    }, { once: true });
    longSpritesheet.src = `../../assets/${manifest.spritesheetPath}`;
  } catch (error) {
    console.error('Failed to load long actions:', error);
  }
}

function pointFromEvent(event) {
  return {
    screenX: event.screenX,
    screenY: event.screenY
  };
}

function updateDragState(event) {
  const pointer = pointFromEvent(event);
  if (!lastPointer) {
    lastPointer = pointer;
    setState('running');
    return;
  }

  const dx = pointer.screenX - lastPointer.screenX;
  const dy = pointer.screenY - lastPointer.screenY;
  dragTravel += Math.hypot(dx, dy);
  refreshDragInteractionTime();

  if (dragStartPointer) {
    const totalDx = pointer.screenX - dragStartPointer.screenX;
    if (Math.abs(totalDx) >= DRAG_DIRECTION_THRESHOLD_PX) {
      dragDirectionState = totalDx > 0 ? 'running-right' : 'running-left';
    } else {
      dragDirectionState = 'running';
    }
  } else if (dx > 2) {
    dragDirectionState = 'running-right';
  } else if (dx < -2) {
    dragDirectionState = 'running-left';
  } else {
    dragDirectionState = 'running';
  }

  setState(dragDirectionState);
  lastPointer = pointer;
}

canvas.addEventListener('pointerdown', async event => {
  if (event.button !== 0) {
    return;
  }

  markUserInteraction();
  dragging = true;
  pointerDownAt = performance.now();
  lastPointer = pointFromEvent(event);
  dragStartPointer = lastPointer;
  dragTravel = 0;
  dragDirectionState = 'running';
  lastDragInteractionMarkAt = performance.now();
  canvas.classList.add('dragging');
  canvas.setPointerCapture(event.pointerId);
  setState('running');
  clearAutoActionTimer();
  await window.duduPet.beginDrag(lastPointer);
});

canvas.addEventListener('pointermove', async event => {
  if (!dragging) {
    return;
  }

  updateDragState(event);
});

async function finishDrag(event) {
  if (!dragging) {
    return;
  }

  markUserInteraction();
  dragging = false;
  const releasePointer = pointFromEvent(event);
  if (dragStartPointer && dragTravel === 0) {
    dragTravel += Math.hypot(
      releasePointer.screenX - dragStartPointer.screenX,
      releasePointer.screenY - dragStartPointer.screenY
    );
  }
  canvas.classList.remove('dragging');
  try {
    canvas.releasePointerCapture(event.pointerId);
  } catch {
    // Pointer capture may already be gone when the window loses focus.
  }

  await window.duduPet.endDrag();

  const now = performance.now();
  const shortPress = now - pointerDownAt < SHORT_PRESS_MS;
  const wasDragged = dragTravel > DRAG_CLICK_THRESHOLD_PX;
  if (shortPress && !wasDragged) {
    if (isDoubleTap(releasePointer, now)) {
      playJumpReaction();
    } else {
      rememberShortTap(releasePointer, now);
      setPreferredState('poke-startle', 'waving', 1100);
    }
  } else if (wasDragged) {
    clearShortTap();
    restoreAfterTransient();
  } else {
    clearShortTap();
    restoreAfterTransient();
  }
  dragStartPointer = null;
  dragTravel = 0;
  dragDirectionState = 'running';
  markUserInteraction();
  if (!manualLoopState) {
    resetAutoActionTimer();
  }
}

canvas.addEventListener('pointerup', finishDrag);
canvas.addEventListener('pointercancel', finishDrag);

canvas.addEventListener('dblclick', () => {
  playJumpReaction();
});

window.addEventListener('contextmenu', event => {
  event.preventDefault();
  markUserInteraction();
  window.duduPet.showContextMenu();
});

window.addEventListener('keydown', event => {
  markUserInteraction();
  if (event.key === 'r') {
    clearManualLoopState();
    setState('review', 1200);
    scheduleInactivitySadTimer();
    resetAutoActionTimer();
  }
  if (event.key === 'Escape') {
    clearManualLoopState();
    setState('idle');
    scheduleInactivitySadTimer();
    resetAutoActionTimer();
  }
});

window.duduPet.onSettingsUpdated(nextSettings => {
  settings = { ...settings, ...nextSettings };
  scheduleInactivitySadTimer();
});

window.duduPet.onPlayState(({ state, transientMs, persistent }) => {
  markUserInteraction();
  if (persistent) {
    setManualLoopState(state);
    return;
  }

  clearManualLoopState();
  setState(state, transientMs);
  scheduleInactivitySadTimer();
  resetAutoActionTimer();
});

window.duduPet.getInitialState().then(initialState => {
  settings = { ...settings, ...initialState };
  loadExtraActions(initialState.extraActionsManifest);
  loadLongActions(initialState.longActionsManifest);
  markUserInteraction();
});

function startAnimation() {
  if (animationStarted) {
    return;
  }

  animationStarted = true;
  scheduleAutoAction();
  scheduleInactivitySadTimer();
  draw();
}

spritesheet.addEventListener('load', startAnimation);

spritesheet.addEventListener('error', () => {
  ctx.clearRect(0, 0, CELL_WIDTH, CELL_HEIGHT);
});

spritesheet.src = SPRITESHEET_SRC;
