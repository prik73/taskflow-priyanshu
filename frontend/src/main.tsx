import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@knadh/oat/oat.min.css';
import '@knadh/oat/js/index.js';
import './index.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
