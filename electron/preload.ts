import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('basilicoDesktop', {
  isElectron: true,
  obterInfoAmbiente: () => ipcRenderer.invoke('basilico:info-ambiente'),
});
