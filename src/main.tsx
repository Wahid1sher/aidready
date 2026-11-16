import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { initFirebase } from './services/firebase';
import './styles.css';

initFirebase();
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
// Production only: a service worker in dev would serve stale modules over Vite's hot reload.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
