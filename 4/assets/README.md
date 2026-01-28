# Assets - Tray Icon Animation

Questa cartella contiene le icone per l'animazione della tray icon.

## File richiesti

Per abilitare l'animazione della tray icon, crea i seguenti file PNG in questa cartella:

- `tray-frame-0.png` - Frame 1 dell'animazione
- `tray-frame-1.png` - Frame 2 dell'animazione
- `tray-frame-2.png` - Frame 3 dell'animazione
- `tray-frame-3.png` - Frame 4 dell'animazione

## Specifiche delle icone

- **Formato**: PNG con trasparenza
- **Dimensioni consigliate**: 32x32 pixel (verrà ridimensionata a 16x16 automaticamente)
- **Colore**: Preferibilmente bianco/nero per adattarsi ai temi del sistema
- **Stile**: Semplice e leggibile, icone piccole funzionano meglio nella tray

## Suggerimenti

1. **macOS**: Le icone dovrebbero essere monocromatiche (bianche su trasparente) per adattarsi alla menu bar
2. **Windows**: Puoi usare colori, ma considera che la tray può avere sfondi chiari o scuri
3. **Linux**: Simile a Windows, ma testa su diversi desktop environments

## Animazione

L'animazione cicla attraverso i 4 frame ogni 250ms (4 frame/secondo).
Puoi modificare il numero di frame e la velocità in `src/main.js`.

## Come personalizzare

Nel file `src/main.js`, modifica l'array `trayFrames` per cambiare i nomi o il numero di frame:

```javascript
const trayFrames = [
  'tray-frame-0.png',
  'tray-frame-1.png',
  'tray-frame-2.png',
  'tray-frame-3.png',
  'tray-frame-5.png'  // Aggiungi più frame se necessario
];
```

E modifica l'intervallo di animazione (in millisecondi):

```javascript
trayAnimationInterval = setInterval(() => {
  // ... codice animazione
}, 250);  // Cambia questo valore per velocità diversa
```
