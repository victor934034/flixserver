import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

document.body.style.cursor = 'none';

createRoot(document.getElementById('root')).render(<App />);
