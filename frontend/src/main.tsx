import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Mapbox GL requires this workaround for bundlers
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).global = window;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
