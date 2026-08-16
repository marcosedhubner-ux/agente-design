const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('eyedropperApi', {
  onImage: (cb) => ipcRenderer.on('eyedropper:image', (_e, dataUrl, w, h) => cb(dataUrl, w, h)),
  pick: (hex) => ipcRenderer.send('eyedropper:picked', hex),
  cancel: () => ipcRenderer.send('eyedropper:cancelled'),
});
