const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('duduPet', {
  getInitialState: () => ipcRenderer.invoke('pet:get-initial-state'),
  beginDrag: point => ipcRenderer.invoke('pet:begin-drag', point),
  moveDrag: () => ipcRenderer.invoke('pet:move-drag'),
  endDrag: () => ipcRenderer.invoke('pet:end-drag'),
  showContextMenu: () => ipcRenderer.invoke('pet:show-context-menu'),
  setScale: scale => ipcRenderer.invoke('pet:set-scale', scale),
  closeScaleSettings: () => ipcRenderer.invoke('pet:close-scale-settings'),
  setSadTimeoutMinutes: minutes => ipcRenderer.invoke('pet:set-sad-timeout-minutes', minutes),
  closeSadSettings: () => ipcRenderer.invoke('pet:close-sad-settings'),
  onSettingsUpdated: callback => {
    const listener = (_event, settings) => callback(settings);
    ipcRenderer.on('settings-updated', listener);
    return () => ipcRenderer.removeListener('settings-updated', listener);
  }
});
