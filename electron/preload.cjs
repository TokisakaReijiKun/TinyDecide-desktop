const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  getScheduler: () => ipcRenderer.invoke('scheduler:get'),
  saveSchedules: (schedules) => ipcRenderer.invoke('scheduler:save', schedules),
  syncWheels: (wheels) => ipcRenderer.invoke('scheduler:wheels', wheels),
  setAutoStart: (enabled) => ipcRenderer.invoke('scheduler:autostart', enabled),
  acknowledgeResults: (ids) => ipcRenderer.invoke('scheduler:ack', ids),
  clearScheduledHistory: () => ipcRenderer.invoke('scheduler:clear-history'),
  saveCountdowns: (countdowns) => ipcRenderer.invoke('countdown:save', countdowns),
  acknowledgeCountdownAlert: (id) => ipcRenderer.invoke('countdown:ack', id),
  onScheduler: (callback) => {
    const listener = (_event, snapshot) => callback(snapshot);
    ipcRenderer.on('scheduler:changed', listener);
    return () => ipcRenderer.removeListener('scheduler:changed', listener);
  }
});
