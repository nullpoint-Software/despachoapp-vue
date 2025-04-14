import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Emular __dirname en ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const buildTime = new Date().toLocaleString('es-MX', {
  dateStyle: 'full',
  timeStyle: 'short',
  timeZone: 'America/Mexico_City',
});

const outputPath = path.resolve(__dirname, './public/build-time.txt');
fs.writeFileSync(outputPath, buildTime);

console.log('✔ Fecha y hora de compilación generadas:', buildTime);
