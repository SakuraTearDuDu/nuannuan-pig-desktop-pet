const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('duduPet', {
  getInitialState: () => ipcRenderer.invoke('pet:get-initial-state'),
  beginDrag: point => ipcRenderer.invoke('pet:begin-drag', point),
  moveDrag: () => ipcRenderer.invoke('pet:move-drag'),
  endDrag: () => ipcRenderer.invoke('pet:end-drag'),
  showContextMenu: () => ipcRenderer.invoke('pet:show-context-menu'),
  setInactivitySadTimeout: timeoutMs => ipcRenderer.invoke('pet:set-inactivity-sad-timeout', timeoutMs),
  getControlState: () => ipcRenderer.invoke('control:get-state'),
  setPetEnabled: (petId, enabled) => ipcRenderer.invoke('control:set-pet-enabled', petId, enabled),
  setActionTarget: (petId, enabled) => ipcRenderer.invoke('control:set-action-target', petId, enabled),
  setSingleActionTarget: petId => ipcRenderer.invoke('control:set-single-action-target', petId),
  setAllActionTargets: enabled => ipcRenderer.invoke('control:set-all-action-targets', enabled),
  playAction: (actionId, kind) => ipcRenderer.invoke('control:play-action', actionId, kind),
  setGroupMoveEnabled: enabled => ipcRenderer.invoke('control:set-group-move-enabled', enabled),
  setAutoActionsEnabled: enabled => ipcRenderer.invoke('control:set-auto-actions-enabled', enabled),
  setScale: scale => ipcRenderer.invoke('control:set-scale', scale),
  showControlPanel: () => ipcRenderer.invoke('control:show-panel'),
  resetPositions: () => ipcRenderer.invoke('control:reset-positions'),
  resetAllSettings: () => ipcRenderer.invoke('control:reset-all-settings'),
  setWindowVisibility: visible => ipcRenderer.invoke('control:set-window-visibility', visible),
  quit: () => ipcRenderer.invoke('control:quit'),
  onPlayState: callback => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('play-state', listener);
    return () => ipcRenderer.removeListener('play-state', listener);
  },
  onSettingsUpdated: callback => {
    const listener = (_event, settings) => callback(settings);
    ipcRenderer.on('settings-updated', listener);
    return () => ipcRenderer.removeListener('settings-updated', listener);
  },
  onControlStateUpdated: callback => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('control-state-updated', listener);
    return () => ipcRenderer.removeListener('control-state-updated', listener);
  }
});
