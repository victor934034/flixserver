import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

document.body.style.cursor = 'none';

// Register Samsung remote keys so the browser receives them
if (window.tizen && window.tizen.tvinputdevice) {
  try {
    tizen.tvinputdevice.registerKeyBatch([
      'Return', 'ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue',
      'MediaPlay', 'MediaPause', 'MediaStop', 'MediaFastForward', 'MediaRewind',
    ]);
  } catch (_) {}
}

createRoot(document.getElementById('root')).render(<App />);
