const timeoutInput = document.getElementById('timeout-input');
const timeoutSlider = document.getElementById('timeout-slider');
const presetButtons = document.getElementById('preset-buttons');
const timeoutHint = document.getElementById('timeout-hint');
const resetButton = document.getElementById('reset-button');
const closeButton = document.getElementById('close-button');
const timeoutForm = document.getElementById('timeout-form');

let state = {
  sadTimeoutMinutes: 5,
  minSadTimeoutMinutes: 1,
  maxSadTimeoutMinutes: 120,
  sadTimeoutStepMinutes: 1,
  presetSadTimeoutMinutes: [1, 3, 5, 10, 15, 30]
};

function normalizeMinutes(value) {
  const numeric = Number(value);
  const fallback = state.sadTimeoutMinutes || 5;
  const raw = Number.isFinite(numeric) ? numeric : fallback;
  const stepped = Math.round(raw / state.sadTimeoutStepMinutes) * state.sadTimeoutStepMinutes;
  const clamped = Math.min(state.maxSadTimeoutMinutes, Math.max(state.minSadTimeoutMinutes, stepped));
  return Number(clamped.toFixed(0));
}

function renderPresetButtons() {
  presetButtons.innerHTML = '';
  state.presetSadTimeoutMinutes.forEach(minutes => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'preset-button';
    button.dataset.minutes = String(minutes);
    button.textContent = `${minutes} 分钟`;
    button.addEventListener('click', () => setDraftMinutes(minutes, true));
    presetButtons.appendChild(button);
  });
}

function updatePresetState(minutes) {
  presetButtons.querySelectorAll('.preset-button').forEach(button => {
    const buttonMinutes = Number(button.dataset.minutes);
    button.classList.toggle('active', buttonMinutes === minutes);
  });
}

function updateHint(minutes, prefix = '当前等待') {
  timeoutHint.textContent = `${prefix} ${minutes} 分钟。支持 ${state.minSadTimeoutMinutes} 到 ${state.maxSadTimeoutMinutes} 分钟，每次按 ${state.sadTimeoutStepMinutes} 分钟对齐。`;
}

function updateControlBounds() {
  const min = String(state.minSadTimeoutMinutes);
  const max = String(state.maxSadTimeoutMinutes);
  const step = String(state.sadTimeoutStepMinutes);

  [timeoutInput, timeoutSlider].forEach(control => {
    control.min = min;
    control.max = max;
    control.step = step;
  });
}

function syncControls(minutes) {
  const clamped = normalizeMinutes(minutes);
  state.sadTimeoutMinutes = clamped;
  timeoutInput.value = String(clamped);
  timeoutSlider.value = String(clamped);
  updatePresetState(clamped);
  updateHint(clamped);
}

function setDraftMinutes(nextMinutes, commit = false) {
  const clamped = normalizeMinutes(nextMinutes);
  syncControls(clamped);
  if (commit) {
    window.duduPet.setSadTimeoutMinutes(clamped);
  }
}

timeoutInput.addEventListener('input', () => {
  if (timeoutInput.value.trim() === '') {
    return;
  }

  const minutes = Number(timeoutInput.value);
  if (!Number.isFinite(minutes)) {
    return;
  }

  const draftMinutes = normalizeMinutes(minutes);
  timeoutSlider.value = String(draftMinutes);
  updatePresetState(draftMinutes);
  updateHint(draftMinutes, '将应用等待');
});

timeoutInput.addEventListener('change', () => {
  setDraftMinutes(timeoutInput.value, true);
});

timeoutSlider.addEventListener('input', () => {
  setDraftMinutes(timeoutSlider.value, false);
});

timeoutSlider.addEventListener('change', () => {
  setDraftMinutes(timeoutSlider.value, true);
});

resetButton.addEventListener('click', () => setDraftMinutes(5, true));

closeButton.addEventListener('click', () => {
  window.duduPet.closeSadSettings();
});

timeoutForm.addEventListener('submit', event => {
  event.preventDefault();
  setDraftMinutes(timeoutInput.value, true);
});

window.duduPet.onSettingsUpdated(nextSettings => {
  state = { ...state, ...nextSettings };
  updateControlBounds();
  renderPresetButtons();
  syncControls(nextSettings.sadTimeoutMinutes ?? state.sadTimeoutMinutes);
});

window.duduPet.getInitialState().then(initialState => {
  state = { ...state, ...initialState };
  updateControlBounds();
  renderPresetButtons();
  syncControls(initialState.sadTimeoutMinutes ?? state.sadTimeoutMinutes);
});
