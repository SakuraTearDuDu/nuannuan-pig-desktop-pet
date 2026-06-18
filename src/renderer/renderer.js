const CELL_WIDTH = 192;
const CELL_HEIGHT = 208;
const SPRITESHEET_SRC = '../../assets/spritesheet.webp';
const AUTO_ACTION_MIN_DELAY = 25_000;
const AUTO_ACTION_MAX_DELAY = 45_000;
const AUTO_ACTION_RETRY_DELAY = 5_000;
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
let states = { ...BASE_STATES };
let extraSpritesheetReady = false;

let currentState = 'idle';
let frameIndex = 0;
let nextFrameAt = performance.now();
let transientUntil = 0;
let lastPointer = null;
let dragging = false;
let movePending = false;
let pointerDownAt = 0;
let settings = {
  scale: 1,
  alwaysOnTop: true,
  hidden: false
};
let animationStarted = false;
let autoActionTimer = null;

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

function randomBetween(min, max) {
  return min + Math.round(Math.random() * (max - min));
}

function clearAutoActionTimer() {
  if (autoActionTimer) {
    window.clearTimeout(autoActionTimer);
    autoActionTimer = null;
  }
}

function canPlayAutoAction(action) {
  const now = performance.now();
  const state = states[action.state];
  return Boolean(
    state
    && !dragging
    && currentState === 'idle'
    && (!transientUntil || now >= transientUntil)
    && (state.sheet !== 'extra' || extraSpritesheetReady)
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
    setState('idle');
  }

  const activeState = stateDefinition();
  if (activeState.sheet === 'extra' && !extraSpritesheetReady) {
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
    : spritesheet;
  const column = frameIndex % (drawableState.columns || drawableState.frames);
  ctx.drawImage(
    activeImage,
    column * CELL_WIDTH,
    drawableState.row * CELL_HEIGHT,
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
    }, { once: true });
    extraSpritesheet.src = `../../assets/${manifest.spritesheetPath}`;
  } catch (error) {
    console.error('Failed to load extra actions:', error);
  }
}

function pointFromEvent(event) {
  return {
    screenX: event.screenX,
    screenY: event.screenY
  };
}

function updateDragState(event) {
  if (!lastPointer) {
    setState('running');
    return;
  }

  const dx = event.screenX - lastPointer.screenX;
  if (dx > 2) {
    setState('running-right');
  } else if (dx < -2) {
    setState('running-left');
  } else {
    setState('running');
  }
  lastPointer = pointFromEvent(event);
}

canvas.addEventListener('pointerdown', async event => {
  if (event.button !== 0) {
    return;
  }

  dragging = true;
  pointerDownAt = performance.now();
  lastPointer = pointFromEvent(event);
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
  if (!movePending) {
    movePending = true;
    window.duduPet.moveDrag().finally(() => {
      movePending = false;
    });
  }
});

async function finishDrag(event) {
  if (!dragging) {
    return;
  }

  dragging = false;
  movePending = false;
  canvas.classList.remove('dragging');
  try {
    canvas.releasePointerCapture(event.pointerId);
  } catch {
    // Pointer capture may already be gone when the window loses focus.
  }

  await window.duduPet.endDrag();
  const shortPress = performance.now() - pointerDownAt < 220;
  setState(shortPress ? 'waving' : 'idle', shortPress ? 900 : 0);
  resetAutoActionTimer();
}

canvas.addEventListener('pointerup', finishDrag);
canvas.addEventListener('pointercancel', finishDrag);

canvas.addEventListener('dblclick', () => {
  setState('jumping', 950);
});

window.addEventListener('contextmenu', event => {
  event.preventDefault();
  window.duduPet.showContextMenu();
});

window.addEventListener('keydown', event => {
  if (event.key === 'r') {
    setState('review', 1200);
  }
  if (event.key === 'Escape') {
    setState('idle');
  }
});

window.duduPet.onSettingsUpdated(nextSettings => {
  settings = { ...settings, ...nextSettings };
});

window.duduPet.onPlayState(({ state, transientMs }) => {
  setState(state, transientMs);
  resetAutoActionTimer();
});

window.duduPet.getInitialState().then(initialState => {
  settings = { ...settings, ...initialState };
  loadExtraActions(initialState.extraActionsManifest);
});

function startAnimation() {
  if (animationStarted) {
    return;
  }

  animationStarted = true;
  scheduleAutoAction();
  draw();
}

spritesheet.addEventListener('load', startAnimation);

spritesheet.addEventListener('error', () => {
  ctx.clearRect(0, 0, CELL_WIDTH, CELL_HEIGHT);
});

spritesheet.src = SPRITESHEET_SRC;
