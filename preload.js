const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('atelie', {
  sendMessage: (localId, text, imageName) => ipcRenderer.invoke('chat:send', { localId, text, imageName }),
  saveColor: (localId, hex) => ipcRenderer.invoke('chat:saveColor', { localId, hex }),

  listSessions: () => ipcRenderer.invoke('sessions:list'),
  openSession: (localId) => ipcRenderer.invoke('sessions:open', { localId }),
  deleteSession: (localId) => ipcRenderer.invoke('sessions:delete', { localId }),

  getColorHistory: () => ipcRenderer.invoke('history:getColors'),
  getImageHistory: () => ipcRenderer.invoke('history:getImages'),

  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (partial) => ipcRenderer.invoke('settings:set', partial),

  pickImage: () => ipcRenderer.invoke('dialog:pickImage'),
  captureScreen: () => ipcRenderer.invoke('screen:capture'),
  saveClipboardImage: (data, ext) => ipcRenderer.invoke('clipboard:saveImage', { data, ext }),

  removeBackground: (imageName) => ipcRenderer.invoke('image:removeBackground', { imageName }),
  removeBackgroundManual: (dataUrl) => ipcRenderer.invoke('image:removeBackgroundManual', { dataUrl }),
  enhanceImage: (imageName) => ipcRenderer.invoke('image:enhance', { imageName }),
  loadImageForEditing: (imageName) => ipcRenderer.invoke('image:loadForEditing', { imageName }),
  downloadImage: (imageName) => ipcRenderer.invoke('image:download', { imageName }),

  onHotkeyCapture: (cb) => ipcRenderer.on('capture:fromHotkey', (_e, data) => cb(data)),

  onFlyoutOpen: (cb) => ipcRenderer.on('flyout:open', (_e, anchor) => cb(anchor)),
  onFlyoutClose: (cb) => ipcRenderer.on('flyout:close', () => cb()),
  notifyFlyoutCloseDone: () => ipcRenderer.send('flyout:closeDone'),

  openEyedropper: () => ipcRenderer.send('eyedropper:open'),
  onEyedropperResult: (cb) => ipcRenderer.on('eyedropper:result', (_e, hex) => cb(hex)),
  onEyedropperError: (cb) => ipcRenderer.on('eyedropper:error', (_e, message) => cb(message)),
});
