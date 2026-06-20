const { contextBridge } = require('electron');

// Expose flag to renderer safely
contextBridge.exposeInMainWorld('myElectronAPI', {
  isElectron: true,
  platform: process.platform
});

window.addEventListener('DOMContentLoaded', () => {
  // Inject custom flag into window object
  window.isElectron = true;
});
