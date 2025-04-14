const fs = require('fs');
const path = require('path');

const buildTime = new Date().toLocaleString('es-MX', {
  dateStyle: 'full',
  timeStyle: 'short',
  timeZone: 'America/Mexico_City',
});

const outputPath = path.resolve(__dirname, '../public/build-time.txt');
fs.writeFileSync(outputPath, buildTime);

console.log('✔ Fecha y hora de compilación generadas:', buildTime);