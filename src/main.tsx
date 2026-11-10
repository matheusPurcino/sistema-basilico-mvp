import React from 'react';
import { createRoot } from 'react-dom/client';
import { configurarLocalizadorWasm } from './infrastructure';
import { App } from './presentation/App';
import './presentation/styles.css';

// Aponta para `sql-wasm.wasm` servido localmente em `public/` (funciona 100% offline
// no navegador e dentro do pacote Electron).
configurarLocalizadorWasm((arquivo) => `./${arquivo}`);

const container = document.getElementById('root');
if (!container) {
  throw new Error('Elemento #root não encontrado no index.html.');
}

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
