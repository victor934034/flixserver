import React from 'react';
import { createRoot } from 'react-dom/client';
import { init } from '@noriginmedia/norigin-spatial-navigation';
import App from './App.jsx';

init({ debug: false, visualDebug: false });

document.body.style.cursor = 'none';

createRoot(document.getElementById('root')).render(<App />);
