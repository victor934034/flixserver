// Run: node generate-notification-icon.js
// Requires: npm install canvas
const { createCanvas } = require('canvas');
const fs = require('fs');

const size = 96;
const canvas = createCanvas(size, size);
const ctx = canvas.getContext('2d');

// Transparent background
ctx.clearRect(0, 0, size, size);

ctx.fillStyle = '#FFFFFF';

// Rounded rect (TV screen shape)
const rx = 8, ry = 8;
const x = 10, y = 16, w = 76, h = 56;
ctx.beginPath();
ctx.moveTo(x + rx, y);
ctx.lineTo(x + w - rx, y);
ctx.quadraticCurveTo(x + w, y, x + w, y + ry);
ctx.lineTo(x + w, y + h - ry);
ctx.quadraticCurveTo(x + w, y + h, x + w - rx, y + h);
ctx.lineTo(x + rx, y + h);
ctx.quadraticCurveTo(x, y + h, x, y + h - ry);
ctx.lineTo(x, y + ry);
ctx.quadraticCurveTo(x, y, x + rx, y);
ctx.closePath();
ctx.fill();

// Cut out inside (hollow screen)
ctx.globalCompositeOperation = 'destination-out';
ctx.fillStyle = 'rgba(0,0,0,1)';
const ix = 16, iy = 22, iw = 64, ih = 44;
ctx.beginPath();
ctx.moveTo(ix + rx, iy);
ctx.lineTo(ix + iw - rx, iy);
ctx.quadraticCurveTo(ix + iw, iy, ix + iw, iy + ry);
ctx.lineTo(ix + iw, iy + ih - ry);
ctx.quadraticCurveTo(ix + iw, iy + ih, ix + iw - rx, iy + ih);
ctx.lineTo(ix + rx, iy + ih);
ctx.quadraticCurveTo(ix, iy + ih, ix, iy + ih - ry);
ctx.lineTo(ix, iy + ry);
ctx.quadraticCurveTo(ix, iy, ix + rx, iy);
ctx.closePath();
ctx.fill();

// Play triangle inside screen
ctx.globalCompositeOperation = 'source-over';
ctx.fillStyle = '#FFFFFF';
ctx.beginPath();
ctx.moveTo(38, 30);
ctx.lineTo(62, 44);
ctx.lineTo(38, 58);
ctx.closePath();
ctx.fill();

// Stand
ctx.fillRect(43, 72, 10, 6);
ctx.fillRect(34, 77, 28, 4);

const buffer = canvas.toBuffer('image/png');
fs.writeFileSync('./notification-icon.png', buffer);
console.log('notification-icon.png gerado com sucesso (96x96)');
