const CELL_WIDTH = 192;
const CELL_HEIGHT = 208;
const SPRITESHEET_SRC = '../../assets/spritesheet.webp';

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
let dragging = false;
let movePending = false;
let pointerDownAt = 0;
let settings = {
  scale: 1,
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

function draw() {
  const now = performance.now();
  const state = stateDefinition();

  if (transientUntil && now > transientUntil && !dragging) {
    setState('idle');
  }

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

window.duduPet.getInitialState().then(initialState => {
  settings = { ...settings, ...initialState };
});

spritesheet.addEventListener('load', () => {
  draw();
});

spritesheet.addEventListener('error', () => {
  ctx.clearRect(0, 0, CELL_WIDTH, CELL_HEIGHT);
});

spritesheet.src = SPRITESHEET_SRC;
