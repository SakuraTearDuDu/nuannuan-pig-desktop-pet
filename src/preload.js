const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('duduPet', {
  getInitialState: () => ipcRenderer.invoke('pet:get-initial-state'),
  beginDrag: point => ipcRenderer.invoke('pet:begin-drag', point),
  moveDrag: () => ipcRenderer.invoke('pet:move-drag'),
  endDrag: () => ipcRenderer.invoke('pet:end-drag'),
  showContextMenu: () => ipcRenderer.invoke('pet:show-context-menu'),
  setInactivitySadTimeout: timeoutMs => ipcRenderer.invoke('pet:set-inactivity-sad-timeout', timeoutMs),
  onPlayState: callback => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('play-state', listener);
    return () => ipcRenderer.removeListener('play-state', listener);
  },
  onSettingsUpdated: callback => {
    const listener = (_event, settings) => callback(settings);
    ipcRenderer.on('settings-updated', listener);
    return () => ipcRenderer.removeListener('settings-updated', listener);
  }
});
