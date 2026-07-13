const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('apkSigner', {
  getEnvironment: () => ipcRenderer.invoke('environment:get'),
  chooseApk: () => ipcRenderer.invoke('file:choose-apk'),
  chooseKeystore: () => ipcRenderer.invoke('file:choose-keystore'),
  chooseOutput: (defaultPath) => ipcRenderer.invoke('file:choose-output', defaultPath),
  sign: (request) => ipcRenderer.invoke('apk:sign', request),
})
