const scaleInput = document.getElementById('scale-input');
const scaleSlider = document.getElementById('scale-slider');
const presetButtons = document.getElementById('preset-buttons');
const scaleHint = document.getElementById('scale-hint');
const resetButton = document.getElementById('reset-button');
const closeButton = document.getElementById('close-button');
const scaleForm = document.getElementById('scale-form');

let state = {
  scale: 1,
  minScale: 0.5,
  maxScale: 3,
  scaleStep: 0.05,
  presetScales: [0.75, 1, 1.25, 1.5, 2]
};

function normalizeScale(value) {
  const numeric = Number(value);
  const fallback = state.scale || 1;
  const raw = Number.isFinite(numeric) ? numeric : fallback;
  const stepped = Math.round(raw / state.scaleStep) * state.scaleStep;
  const clamped = Math.min(state.maxScale, Math.max(state.minScale, stepped));
  return Number(clamped.toFixed(2));
}

function toPercent(scale) {
  return Math.round(scale * 100);
}

function fromPercent(percent) {
  return normalizeScale(Number(percent) / 100);
}

function renderPresetButtons() {
  presetButtons.innerHTML = '';
  state.presetScales.forEach(scale => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'preset-button';
    button.dataset.scale = String(scale);
    button.textContent = `${toPercent(scale)}%`;
    button.addEventListener('click', () => setDraftScale(scale, true));
    presetButtons.appendChild(button);
  });
}

function updatePresetState(scale) {
  presetButtons.querySelectorAll('.preset-button').forEach(button => {
    const buttonScale = Number(button.dataset.scale);
    button.classList.toggle('active', Math.abs(buttonScale - scale) < 0.001);
  });
}

function updateHint(scale, prefix = '当前缩放') {
  const percent = toPercent(scale);
  scaleHint.textContent = `${prefix} ${percent}%。支持 ${toPercent(state.minScale)}% 到 ${toPercent(state.maxScale)}%，每次按 ${toPercent(state.scaleStep)}% 对齐。`;
}

function updateControlBounds() {
  const min = String(toPercent(state.minScale));
  const max = String(toPercent(state.maxScale));
  const step = String(toPercent(state.scaleStep));

  [scaleInput, scaleSlider].forEach(control => {
    control.min = min;
    control.max = max;
    control.step = step;
  });
}

function syncControls(scale) {
  const clamped = normalizeScale(scale);
  state.scale = clamped;
  scaleInput.value = String(toPercent(clamped));
  scaleSlider.value = String(toPercent(clamped));
  updatePresetState(clamped);
  updateHint(clamped);
}

function setDraftScale(nextScale, commit = false) {
  const clamped = normalizeScale(nextScale);
  syncControls(clamped);
  if (commit) {
    window.duduPet.setScale(clamped);
  }
}

scaleInput.addEventListener('input', () => {
  if (scaleInput.value.trim() === '') {
    return;
  }

  const percent = Number(scaleInput.value);
  if (!Number.isFinite(percent)) {
    return;
  }

  const draftScale = fromPercent(percent);
  scaleSlider.value = String(toPercent(draftScale));
  updatePresetState(draftScale);
  updateHint(draftScale, '将应用缩放');
});

scaleInput.addEventListener('change', () => {
  setDraftScale(fromPercent(scaleInput.value), true);
});

scaleSlider.addEventListener('input', () => {
  setDraftScale(fromPercent(scaleSlider.value), false);
});

scaleSlider.addEventListener('change', () => {
  setDraftScale(fromPercent(scaleSlider.value), true);
});

resetButton.addEventListener('click', () => setDraftScale(1, true));

closeButton.addEventListener('click', () => {
  window.duduPet.closeScaleSettings();
});

scaleForm.addEventListener('submit', event => {
  event.preventDefault();
  setDraftScale(fromPercent(scaleInput.value), true);
});

window.duduPet.onSettingsUpdated(nextSettings => {
  state = { ...state, ...nextSettings };
  updateControlBounds();
  renderPresetButtons();
  syncControls(nextSettings.scale ?? state.scale);
});

window.duduPet.getInitialState().then(initialState => {
  state = { ...state, ...initialState };
  updateControlBounds();
  renderPresetButtons();
  syncControls(initialState.scale ?? state.scale);
});
