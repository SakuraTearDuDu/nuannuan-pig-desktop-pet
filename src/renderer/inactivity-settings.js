const input = document.getElementById('timeoutMinutes');
const saveButton = document.getElementById('saveButton');
const disableButton = document.getElementById('disableButton');
const status = document.getElementById('status');

function msToMinutes(ms) {
  const timeout = Number(ms);
  return Number.isFinite(timeout) && timeout > 0 ? timeout / 60000 : 0;
}

function showStatus(message) {
  status.textContent = message;
}

function applySettings(settings) {
  input.value = String(msToMinutes(settings.inactivitySadTimeoutMs));
}

async function saveMinutes(minutes) {
  const numericMinutes = Number(minutes);
  if (!Number.isFinite(numericMinutes) || numericMinutes < 0 || numericMinutes > 1440) {
    showStatus('请输入 0 到 1440 之间的分钟数。');
    return;
  }

  const next = await window.duduPet.setInactivitySadTimeout(Math.round(numericMinutes * 60000));
  applySettings(next);
  showStatus(next.inactivitySadTimeoutMs ? '已保存。' : '已关闭。');
}

saveButton.addEventListener('click', () => {
  saveMinutes(input.value);
});

disableButton.addEventListener('click', () => {
  saveMinutes(0);
});

input.addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    saveMinutes(input.value);
  }
});

window.duduPet.onSettingsUpdated(applySettings);
window.duduPet.getInitialState().then(applySettings);
