const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('widgetApi', {
  clicked: () => ipcRenderer.send('widget:clicked'),
  close: () => ipcRenderer.send('widget:close'),
  dragBy: (dx, dy) => ipcRenderer.send('widget:dragBy', dx, dy),
});
