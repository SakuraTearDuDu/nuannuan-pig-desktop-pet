const CELL_WIDTH = 192;
const CELL_HEIGHT = 208;

const canvas = document.getElementById('pet');
const ctx = canvas.getContext('2d', { alpha: true });
const longSpritesheet = new Image();

let danceState = null;
let frameIndex = 0;
let nextFrameAt = performance.now();
let dragging = false;
let lastPointer = null;
let dragStartPointer = null;
let dragTravel = 0;
let movePending = false;
let settings = {
  scale: 1.25,
  alwaysOnTop: true,
  hidden: false
};

ctx.imageSmoothingEnabled = false;

function normalizeDurations(action) {
  if (Array.isArray(action.durations) && action.durations.length === action.frames) {
    return action.durations.map(duration => Math.max(16, Number(duration) || 120));
  }
  return Array.from({ length: action.frames }, () => 120);
}

function loadDance(manifest) {
  if (
    !manifest
    || manifest.cellWidth !== CELL_WIDTH
    || manifest.cellHeight !== CELL_HEIGHT
    || !Array.isArray(manifest.actions)
  ) {
    throw new Error('invalid IQ dance manifest');
  }

  const action = manifest.actions.find(item => item.id === 'iq-dance') || manifest.actions[0];
  danceState = {
    row: action.row,
    frames: action.frames,
    columns: manifest.columns || 24,
    durations: normalizeDurations(action)
  };
  longSpritesheet.src = `../../assets/${manifest.spritesheetPath}`;
}

function pointFromEvent(event) {
  return {
    screenX: event.screenX,
    screenY: event.screenY
  };
}

function draw() {
  if (!danceState || !longSpritesheet.complete || !longSpritesheet.naturalWidth) {
    window.requestAnimationFrame(draw);
    return;
  }

  const now = performance.now();
  if (now >= nextFrameAt) {
    frameIndex = (frameIndex + 1) % danceState.frames;
    nextFrameAt = now + danceState.durations[frameIndex];
  }

  ctx.clearRect(0, 0, CELL_WIDTH, CELL_HEIGHT);
  const column = frameIndex % danceState.columns;
  const row = danceState.row + Math.floor(frameIndex / danceState.columns);
  ctx.drawImage(
    longSpritesheet,
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

canvas.addEventListener('pointerdown', async event => {
  if (event.button !== 0) {
    return;
  }

  dragging = true;
  lastPointer = pointFromEvent(event);
  dragStartPointer = lastPointer;
  dragTravel = 0;
  canvas.classList.add('dragging');
  canvas.setPointerCapture(event.pointerId);
  await window.duduPet.beginDrag(lastPointer);
});

canvas.addEventListener('pointermove', event => {
  if (!dragging) {
    return;
  }

  const pointer = pointFromEvent(event);
  if (lastPointer) {
    dragTravel += Math.hypot(pointer.screenX - lastPointer.screenX, pointer.screenY - lastPointer.screenY);
  }
  lastPointer = pointer;

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
  dragStartPointer = null;
  dragTravel = 0;
}

canvas.addEventListener('pointerup', finishDrag);
canvas.addEventListener('pointercancel', finishDrag);

window.addEventListener('contextmenu', event => {
  event.preventDefault();
  window.duduPet.showContextMenu();
});

window.duduPet.onSettingsUpdated(nextSettings => {
  settings = { ...settings, ...nextSettings };
});

window.duduPet.onPlayState(() => {
  frameIndex = 0;
  nextFrameAt = performance.now();
});

window.duduPet.getInitialState().then(initialState => {
  settings = { ...settings, ...initialState };
  loadDance(initialState.longActionsManifest);
});

draw();
