import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import fs from 'node:fs';

function verificarAddonNativo(): { compilado: boolean; caminho: string; modo: string } {
  const candidato = path.resolve(__dirname, '../addons/build/Release/escpos_driver.node');
  const existe = fs.existsSync(candidato);
  return {
    compilado: existe,
    caminho: candidato,
    modo: existe ? 'N-API C++ Nativo (escpos_driver.node)' : 'EscPosThermalSimulator (Fallback TS Binário)',
  };
}

function criarJanelaPrincipal(): void {
  const win = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: '#060b11',
    title: 'Sistema Basílico — PDV Offline-First & Hub de Delivery (ECOT11A · UNIFEI)',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    void win.loadURL(devUrl);
  } else {
    void win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  ipcMain.handle('basilico:info-ambiente', () => ({
    plataforma: process.platform,
    arquitetura: process.arch,
    versaoNode: process.versions.node,
    versaoElectron: process.versions.electron,
    addonEscPos: verificarAddonNativo(),
  }));

  criarJanelaPrincipal();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) criarJanelaPrincipal();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
