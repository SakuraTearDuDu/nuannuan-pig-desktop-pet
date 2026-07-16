const CELL_WIDTH = 192;
const CELL_HEIGHT = 208;
const PET_ID = new URL(document.currentScript.src).searchParams.get('pet');
const SPRITESHEET_SRC = `../../assets/${PET_ID}/spritesheet.webp`;
const AUTO_ACTION_MIN_DELAY = 25_000;
const AUTO_ACTION_MAX_DELAY = 45_000;
const AUTO_ACTION_RETRY_DELAY = 5_000;
const DEFAULT_INACTIVITY_SAD_TIMEOUT_MS = 5 * 60 * 1000;
const INACTIVITY_SAD_REACTION_MS = 2200;
const AUTO_ACTIONS = [
  { state: 'waving', transientMs: 1200 },
  { state: 'jumping', transientMs: 1200 },
  { state: 'waiting', transientMs: 1800 },
  { state: 'review', transientMs: 1800 }
];

const STATES = {
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

let currentState = 'idle';
let frameIndex = 0;
let nextFrameAt = performance.now();
let transientUntil = 0;
let lastPointer = null;
let dragStartPointer = null;
let dragTravel = 0;
let dragDirectionState = 'running';
let dragging = false;
let movePending = false;
let pointerDownAt = 0;
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
  return STATES[currentState] || STATES.idle;
}

function setState(name, transientMs = 0) {
  if (!STATES[name] || currentState === name) {
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

function setPreferredState(preferredName, fallbackName, transientMs = 0) {
  setState(STATES[preferredName] ? preferredName : fallbackName, transientMs);
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
  setState('failed', INACTIVITY_SAD_REACTION_MS);
  lastUserInteractionAt = performance.now();
  scheduleInactivitySadTimer(INACTIVITY_SAD_REACTION_MS + inactivitySadTimeout());
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
  scheduleInactivitySadTimer();
}

function canPlayAutoAction(action) {
  const now = performance.now();
  return Boolean(
    STATES[action.state]
    && !dragging
    && currentState === 'idle'
    && (!transientUntil || now >= transientUntil)
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

  const drawableState = stateDefinition();
  if (now >= nextFrameAt) {
    frameIndex = (frameIndex + 1) % drawableState.frames;
    nextFrameAt = now + drawableState.durations[frameIndex];
  }

  ctx.clearRect(0, 0, CELL_WIDTH, CELL_HEIGHT);
  ctx.drawImage(
    spritesheet,
    frameIndex * CELL_WIDTH,
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
  const dy = event.screenY - lastPointer.screenY;
  dragTravel += Math.hypot(dx, dy);
  if (dx > 2) {
    dragDirectionState = 'running-right';
  } else if (dx < -2) {
    dragDirectionState = 'running-left';
  }
  setState(dragDirectionState);
  lastPointer = pointFromEvent(event);
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
  canvas.classList.add('dragging');
  canvas.setPointerCapture(event.pointerId);
  setState('running');
  clearAutoActionTimer();
  await window.duduPet.beginDrag(lastPointer);
});

canvas.addEventListener('pointermove', event => {
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
  const shortPress = performance.now() - pointerDownAt < 220;
  const wasDragged = dragTravel > 12;
  if (shortPress && !wasDragged) {
    setPreferredState('waving', 'idle', 1100);
  } else if (wasDragged) {
    setState('idle', 600);
  } else {
    setState('idle');
  }
  dragStartPointer = null;
  dragTravel = 0;
  dragDirectionState = 'running';
  markUserInteraction();
  resetAutoActionTimer();
}

canvas.addEventListener('pointerup', finishDrag);
canvas.addEventListener('pointercancel', finishDrag);

canvas.addEventListener('dblclick', () => {
  markUserInteraction();
  setState('jumping', 950);
});

window.addEventListener('contextmenu', event => {
  event.preventDefault();
  markUserInteraction();
  window.duduPet.showContextMenu();
});

window.addEventListener('keydown', event => {
  markUserInteraction();
  if (event.key === 'r') {
    setState('review', 1200);
  }
  if (event.key === 'Escape') {
    setState('idle');
  }
});

window.duduPet.onSettingsUpdated(nextSettings => {
  settings = { ...settings, ...nextSettings };
  scheduleInactivitySadTimer();
});

window.duduPet.onPlayState(({ state, transientMs }) => {
  markUserInteraction();
  setState(state, transientMs);
  resetAutoActionTimer();
});

window.duduPet.getInitialState().then(initialState => {
  settings = { ...settings, ...initialState };
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
