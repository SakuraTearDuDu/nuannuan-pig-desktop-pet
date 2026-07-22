const petRows = document.getElementById('petRows');
const summary = document.getElementById('summary');
const actionStatus = document.getElementById('actionStatus');
const baseActions = document.getElementById('baseActions');
const extraActions = document.getElementById('extraActions');
const longActions = document.getElementById('longActions');
const scaleSelect = document.getElementById('scaleSelect');
const inactivitySelect = document.getElementById('inactivitySelect');
const groupMoveCheckbox = document.getElementById('groupMoveCheckbox');
const autoActionsCheckbox = document.getElementById('autoActionsCheckbox');
const showAllButton = document.getElementById('showAllButton');
const resetPositionsButton = document.getElementById('resetPositionsButton');
const targetAllButton = document.getElementById('targetAllButton');
const targetNoneButton = document.getElementById('targetNoneButton');
const resetSettingsButton = document.getElementById('resetSettingsButton');
const quitButton = document.getElementById('quitButton');

let currentState = null;
let rendering = false;

function setStatus(text) {
  actionStatus.textContent = text || '';
}

function formatTimeout(ms) {
  if (!ms) {
    return '关闭';
  }
  if (ms % 60000 === 0) {
    return `${ms / 60000} 分钟`;
  }
  return `${Math.round(ms / 1000)} 秒`;
}

function renderSelectOptions(select, options, selectedValue, labelFor) {
  select.innerHTML = '';
  let hasSelected = false;
  for (const option of options) {
    const optionElement = document.createElement('option');
    optionElement.value = String(option.value);
    optionElement.textContent = labelFor(option);
    if (option.value === selectedValue) {
      optionElement.selected = true;
      hasSelected = true;
    }
    select.appendChild(optionElement);
  }
  if (!hasSelected) {
    const optionElement = document.createElement('option');
    optionElement.value = String(selectedValue);
    optionElement.textContent = labelFor({ value: selectedValue, label: formatTimeout(selectedValue) });
    optionElement.selected = true;
    select.appendChild(optionElement);
  }
}

function renderPetRows(state) {
  petRows.innerHTML = '';
  for (const pet of state.pets) {
    const row = document.createElement('div');
    row.className = 'pet-row';

    const name = document.createElement('strong');
    name.textContent = pet.displayName;

    const enabled = document.createElement('input');
    enabled.type = 'checkbox';
    enabled.checked = pet.enabled;
    enabled.dataset.role = 'enabled';
    enabled.dataset.petId = pet.id;

    const actionTarget = document.createElement('input');
    actionTarget.type = 'checkbox';
    actionTarget.checked = pet.actionTarget;
    actionTarget.dataset.role = 'target';
    actionTarget.dataset.petId = pet.id;

    const onlyButton = document.createElement('button');
    onlyButton.type = 'button';
    onlyButton.textContent = '只控';
    onlyButton.dataset.role = 'only-target';
    onlyButton.dataset.petId = pet.id;

    row.append(name, enabled, actionTarget, onlyButton);
    petRows.appendChild(row);
  }
}

function createActionButton(action, kind, disabled) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = action.label;
  button.disabled = disabled;
  button.dataset.role = 'action';
  button.dataset.actionId = action.state || action.id;
  button.dataset.kind = kind;
  return button;
}

function renderActions(container, actions, kind, disabled) {
  container.innerHTML = '';
  if (!actions.length) {
    const empty = document.createElement('span');
    empty.className = 'status-text';
    empty.textContent = '暂无动作';
    container.appendChild(empty);
    return;
  }
  for (const action of actions) {
    container.appendChild(createActionButton(action, kind, disabled));
  }
}

function render(state) {
  currentState = state;
  rendering = true;

  summary.textContent = `${state.enabledCount} 只显示 · ${state.actionTargetCount} 只勾选动作目标 · ${state.targetCount} 只当前可控制`;
  showAllButton.textContent = state.settings.hidden ? '显示全部' : '隐藏全部';
  renderPetRows(state);
  renderActions(baseActions, state.baseActions, 'base', state.targetCount === 0);
  renderActions(extraActions, state.extraActions, 'extra', !state.siyanjiSpecialAvailable);
  renderActions(longActions, state.longActions, 'long', !state.siyanjiSpecialAvailable);

  renderSelectOptions(
    scaleSelect,
    state.scales.map(scale => ({ value: scale })),
    state.settings.scale,
    option => `${Math.round(Number(option.value) * 100)}%`
  );
  renderSelectOptions(
    inactivitySelect,
    state.inactivityOptions.map(option => ({ value: option.ms, label: option.label })),
    state.settings.inactivitySadTimeoutMs,
    option => option.label
  );

  groupMoveCheckbox.checked = state.settings.groupMoveEnabled;
  autoActionsCheckbox.checked = state.settings.autoActionsEnabled;
  targetAllButton.disabled = state.pets.every(pet => pet.actionTarget);
  targetNoneButton.disabled = state.pets.every(pet => !pet.actionTarget);

  setStatus(state.siyanjiSpecialAvailable ? '' : '四眼鸡专属动作需要四眼鸡显示并参与动作目标');
  rendering = false;
}

async function refresh() {
  render(await window.duduPet.getControlState());
}

petRows.addEventListener('change', async event => {
  const input = event.target;
  if (!input.dataset || !input.dataset.petId) {
    return;
  }
  if (input.dataset.role === 'enabled') {
    render(await window.duduPet.setPetEnabled(input.dataset.petId, input.checked));
  }
  if (input.dataset.role === 'target') {
    render(await window.duduPet.setActionTarget(input.dataset.petId, input.checked));
  }
});

petRows.addEventListener('click', async event => {
  const button = event.target.closest('button[data-role="only-target"]');
  if (!button) {
    return;
  }
  render(await window.duduPet.setSingleActionTarget(button.dataset.petId));
});

document.body.addEventListener('click', async event => {
  const button = event.target.closest('button[data-role="action"]');
  if (!button) {
    return;
  }
  const result = await window.duduPet.playAction(button.dataset.actionId, button.dataset.kind);
  setStatus(result.played ? `已发送给 ${result.targets.length} 只宠物` : '没有可用的动作目标');
});

scaleSelect.addEventListener('change', async () => {
  if (!rendering) {
    render(await window.duduPet.setScale(Number(scaleSelect.value)));
  }
});

inactivitySelect.addEventListener('change', async () => {
  if (!rendering) {
    await window.duduPet.setInactivitySadTimeout(Number(inactivitySelect.value));
  }
});

groupMoveCheckbox.addEventListener('change', async () => {
  if (!rendering) {
    render(await window.duduPet.setGroupMoveEnabled(groupMoveCheckbox.checked));
  }
});

autoActionsCheckbox.addEventListener('change', async () => {
  if (!rendering) {
    render(await window.duduPet.setAutoActionsEnabled(autoActionsCheckbox.checked));
  }
});

showAllButton.addEventListener('click', async () => {
  render(await window.duduPet.setWindowVisibility(currentState.settings.hidden));
});

resetPositionsButton.addEventListener('click', async () => {
  render(await window.duduPet.resetPositions());
});

targetAllButton.addEventListener('click', async () => {
  render(await window.duduPet.setAllActionTargets(true));
});

targetNoneButton.addEventListener('click', async () => {
  render(await window.duduPet.setAllActionTargets(false));
});

resetSettingsButton.addEventListener('click', async () => {
  render(await window.duduPet.resetAllSettings());
});

quitButton.addEventListener('click', () => {
  window.duduPet.quit();
});

window.duduPet.onControlStateUpdated(render);
refresh();
