const CELL_WIDTH = 192;
const CELL_HEIGHT = 208;
const SPRITESHEET_SRC = '../../assets/spritesheet.webp';
const DEFAULT_SAD_TIMEOUT_MINUTES = 5;
const CLICK_SEQUENCE_MS = 560;
const CLICK_MAX_MS = 240;
const CLICK_MAX_MOVE = 8;
const JUMP_TRANSIENT_MS = 950;

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
let pointerDownPoint = null;
let dragging = false;
let movePending = false;
let pointerDownAt = 0;
let lastInteractionAt = performance.now();
let sadActive = false;
let clickSequence = [];
let settings = {
  scale: 1,
  sadTimeoutMinutes: DEFAULT_SAD_TIMEOUT_MINUTES,
  alwaysOnTop: true,
  hidden: false
};

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

function recordInteraction() {
  lastInteractionAt = performance.now();
  if (sadActive) {
    sadActive = false;
    setState('idle');
  }
}

function maybeEnterSadState(now) {
  if (sadActive || dragging || transientUntil || currentState !== 'idle') {
    return;
  }

  const sadAfterMs = (settings.sadTimeoutMinutes || DEFAULT_SAD_TIMEOUT_MINUTES) * 60 * 1000;
  if (now - lastInteractionAt >= sadAfterMs) {
    sadActive = true;
    setState('failed');
  }
}

function draw() {
  const now = performance.now();

  if (transientUntil && now > transientUntil && !dragging) {
    setState('idle');
  }

  maybeEnterSadState(now);

  const activeState = stateDefinition();
  if (now >= nextFrameAt) {
    frameIndex = (frameIndex + 1) % activeState.frames;
    nextFrameAt = now + activeState.durations[frameIndex];
  }

  ctx.clearRect(0, 0, CELL_WIDTH, CELL_HEIGHT);
  ctx.drawImage(
    spritesheet,
    frameIndex * CELL_WIDTH,
    activeState.row * CELL_HEIGHT,
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

function pointerDistance(a, b) {
  if (!a || !b) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.hypot(a.screenX - b.screenX, a.screenY - b.screenY);
}

function registerShortClick(now) {
  clickSequence = clickSequence.filter(timestamp => now - timestamp <= CLICK_SEQUENCE_MS);
  clickSequence.push(now);

  if (clickSequence.length >= 3) {
    clickSequence = [];
    setState('jumping', JUMP_TRANSIENT_MS);
    return true;
  }

  if (clickSequence.length === 2) {
    setState('jumping', JUMP_TRANSIENT_MS);
    return true;
  }

  return false;
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

  recordInteraction();
  dragging = true;
  pointerDownAt = performance.now();
  lastPointer = pointFromEvent(event);
  pointerDownPoint = lastPointer;
  canvas.classList.add('dragging');
  canvas.setPointerCapture(event.pointerId);
  setState('running');
  await window.duduPet.beginDrag(lastPointer);
});

canvas.addEventListener('pointermove', async event => {
  recordInteraction();
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

  recordInteraction();
  dragging = false;
  movePending = false;
  canvas.classList.remove('dragging');
  try {
    canvas.releasePointerCapture(event.pointerId);
  } catch {
    // Pointer capture may already be gone when the window loses focus.
  }

  await window.duduPet.endDrag();
  const now = performance.now();
  const shortPress = now - pointerDownAt < CLICK_MAX_MS;
  const shortMove = pointerDistance(pointFromEvent(event), pointerDownPoint) <= CLICK_MAX_MOVE;
  pointerDownPoint = null;

  if (shortPress && shortMove && registerShortClick(now)) {
    return;
  }

  setState(shortPress && shortMove ? 'waving' : 'idle', shortPress && shortMove ? 900 : 0);
}

canvas.addEventListener('pointerup', finishDrag);
canvas.addEventListener('pointercancel', finishDrag);

window.addEventListener('contextmenu', event => {
  event.preventDefault();
  recordInteraction();
  window.duduPet.showContextMenu();
});

window.addEventListener('keydown', event => {
  recordInteraction();
  if (event.key === 'r') {
    setState('review', 1200);
  }
  if (event.key === 'Escape') {
    setState('idle');
  }
});

function applySettings(nextSettings) {
  const previousSadTimeoutMinutes = settings.sadTimeoutMinutes;
  settings = { ...settings, ...nextSettings };
  if (
    Object.prototype.hasOwnProperty.call(nextSettings, 'sadTimeoutMinutes') &&
    nextSettings.sadTimeoutMinutes !== previousSadTimeoutMinutes
  ) {
    recordInteraction();
  }
}

window.duduPet.onSettingsUpdated(applySettings);

window.duduPet.getInitialState().then(initialState => {
  applySettings(initialState);
});

spritesheet.addEventListener('load', () => {
  draw();
});

spritesheet.addEventListener('error', () => {
  ctx.clearRect(0, 0, CELL_WIDTH, CELL_HEIGHT);
});

spritesheet.src = SPRITESHEET_SRC;
