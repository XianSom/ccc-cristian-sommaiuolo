# Funzionalità Tray Icon Animata

## Panoramica

Il widget ora supporta un'icona animata nella system tray (barra delle applicazioni/menu bar) che può essere controllata tramite menu contestuale.

## Funzionalità implementate

### 1. Tray Icon
- ✅ Icona nella system tray sempre visibile
- ✅ Click sull'icona mostra/nasconde il widget
- ✅ Menu contestuale con opzioni avanzate

### 2. Animazione
- ✅ Animazione ciclica attraverso 4 frame
- ✅ Velocità: 250ms per frame (4 FPS)
- ✅ Controllo manuale tramite menu (avvia/ferma)

### 3. Menu Contestuale

Tasto destro sull'icona della tray per aprire il menu:

- **Mostra Widget** - Rende visibile la finestra del widget
- **Nascondi Widget** - Nasconde la finestra del widget
- **Avvia Animazione Tray** - Inizia l'animazione dell'icona
- **Ferma Animazione Tray** - Ferma l'animazione e ripristina l'icona statica
- **Esci** - Chiude completamente l'applicazione

## Setup

### Passo 1: Crea le icone

Crea 4 file PNG nella cartella `assets/`:

```
assets/
  ├── tray-frame-0.png
  ├── tray-frame-1.png
  ├── tray-frame-2.png
  └── tray-frame-3.png
```

### Passo 2: Avvia l'applicazione

```bash
npm start
```

L'icona apparirà automaticamente nella tray. Se i file delle icone non esistono, l'applicazione funzionerà comunque ma senza la tray icon.

## Personalizzazione

### Cambiare il numero di frame

In `src/main.js`, modifica l'array `trayFrames`:

```javascript
const trayFrames = [
  'tray-frame-0.png',
  'tray-frame-1.png',
  'tray-frame-2.png',
  'tray-frame-3.png',
  'tray-frame-4.png',  // Aggiungi più frame
  'tray-frame-5.png'
];
```

### Cambiare la velocità dell'animazione

Nella funzione `animateTrayIcon()`:

```javascript
trayAnimationInterval = setInterval(() => {
  // ... codice
}, 250);  // Modifica questo valore (millisecondi)
```

Esempi:
- `100` = 10 FPS (più veloce)
- `250` = 4 FPS (default)
- `500` = 2 FPS (più lento)

### Avviare l'animazione automaticamente

In `src/main.js`, decommentare questa riga:

```javascript
app.whenReady().then(() => {
  createWidget();
  createTray();
  
  // Avvia l'animazione dopo 1 secondo
  setTimeout(() => animateTrayIcon(), 1000);  // ← Decommentare questa riga
});
```

## Funzioni disponibili

### `createTray()`
Crea l'icona nella system tray con menu contestuale.

### `animateTrayIcon()`
Avvia l'animazione ciclica dell'icona.

### `stopTrayAnimation()`
Ferma l'animazione e ripristina l'icona statica.

## Controllo da codice

Puoi controllare l'animazione via IPC dal renderer process (`widget.js`):

```javascript
// In widget.js
const { ipcRenderer } = require('electron');

// Avvia animazione
ipcRenderer.send('start-tray-animation');

// Ferma animazione
ipcRenderer.send('stop-tray-animation');
```

Poi in `main.js` aggiungi i listener:

```javascript
ipcMain.on('start-tray-animation', () => {
  animateTrayIcon();
});

ipcMain.on('stop-tray-animation', () => {
  stopTrayAnimation();
});
```

## Note tecniche

- Le icone vengono ridimensionate automaticamente a 16x16 pixel
- L'animazione si ferma automaticamente quando l'app viene chiusa
- La tray icon persiste anche quando il widget è nascosto
- Su macOS, le icone monocromatiche si adattano meglio al tema del sistema

## Troubleshooting

### L'icona non appare
- Verifica che i file PNG esistano nella cartella `assets/`
- Controlla la console per messaggi di errore
- Verifica i permessi di lettura dei file

### L'animazione non funziona
- Verifica che tutti i frame esistano
- Controlla che i nomi dei file corrispondano all'array `trayFrames`
- Verifica la console per errori durante l'animazione

### L'icona è troppo grande/piccola
- Modifica il valore `width` e `height` in `resize()`
- Le dimensioni standard sono 16x16 su macOS/Linux, 16x16-24x24 su Windows
