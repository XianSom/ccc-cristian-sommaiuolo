#!/usr/bin/env node

/**
 * Script per generare icone di test per la tray animation
 * 
 * Uso: node generate-test-icons.js
 * 
 * Questo script crea 4 icone PNG di test nella cartella assets/
 * Le icone sono semplici cerchi con colori diversi per testare l'animazione.
 * 
 * Nota: Richiede il pacchetto 'canvas' installato
 * Installa con: npm install canvas
 */

const fs = require('fs');
const path = require('path');

// Verifica se canvas è disponibile
let Canvas;
try {
  Canvas = require('canvas');
} catch (e) {
  console.log('❌ Il pacchetto "canvas" non è installato.');
  console.log('💡 Per generare icone di test, installa il pacchetto:');
  console.log('   npm install canvas');
  console.log('');
  console.log('✅ In alternativa, crea manualmente le icone PNG (32x32) nella cartella assets/');
  process.exit(1);
}

const { createCanvas } = Canvas;

const assetsDir = path.join(__dirname, 'assets');

// Crea la cartella assets se non esiste
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
  console.log('✅ Cartella assets/ creata');
}

// Configurazione
const iconSize = 32;
const frames = 4;
const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00']; // Rosso, Verde, Blu, Giallo

console.log('🎨 Generazione icone di test...\n');

// Genera ogni frame
for (let i = 0; i < frames; i++) {
  const canvas = createCanvas(iconSize, iconSize);
  const ctx = canvas.getContext('2d');
  
  // Sfondo trasparente
  ctx.clearRect(0, 0, iconSize, iconSize);
  
  // Disegna un cerchio con colore diverso per ogni frame
  const centerX = iconSize / 2;
  const centerY = iconSize / 2;
  const radius = iconSize / 2 - 2;
  
  // Cerchio principale
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
  ctx.fillStyle = colors[i];
  ctx.fill();
  
  // Bordo nero
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.stroke();
  
  // Aggiungi un numero al centro per identificare il frame
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 16px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText((i + 1).toString(), centerX, centerY);
  
  // Salva il file
  const filename = `tray-frame-${i}.png`;
  const filepath = path.join(assetsDir, filename);
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(filepath, buffer);
  
  console.log(`✅ Creato: ${filename} (${colors[i]})`);
}

console.log('\n🎉 Icone di test generate con successo!');
console.log('📁 Percorso: ' + assetsDir);
console.log('\n💡 Ora puoi avviare l\'applicazione con: npm start');
console.log('💡 Le icone saranno visibili nella system tray');
console.log('💡 Tasto destro sull\'icona per aprire il menu e avviare l\'animazione');
