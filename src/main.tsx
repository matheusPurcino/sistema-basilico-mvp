import React from 'react';
import { createRoot } from 'react-dom/client';
import { configurarLocalizadorWasm } from './infrastructure';
import { App } from './presentation/App';
import './presentation/styles.css';

// Aponta para os arquivos WASM do SQLite servidos localmente.
// Suporta tanto protocolo http(s):// no navegador quanto file:// no Electron.
configurarLocalizadorWasm((arquivo) => {
  if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
    return `./${arquivo}`;
  }
  return `/${arquivo}`;
});

const container = document.getElementById('root');
if (!container) {
  throw new Error('Elemento #root não encontrado no index.html.');
}

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
