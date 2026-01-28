const { app, BrowserWindow, screen, ipcMain, Tray, nativeImage, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Mantieni un riferimento globale all'oggetto window e tray
let mainWindow;
let tray = null;
let trayAnimationInterval = null;

// Array dei frame per l'animazione della tray icon
const trayFrames = [
  'icon-0.png',
  'icon-1.png',
  'icon-2.png',
  'icon-3.png',
  'icon-4.png',
  'icon-5.png'
];

function createWidget() {
  // Ottieni le dimensioni del display principale
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  // Crea la finestra del browser
  mainWindow = new BrowserWindow({
    width: 315, // 350 * 0.9 = 315
    height: 315, // 350 * 0.9 = 315
    x: width - 335, // Posiziona il widget in alto a destra (315 + 20)
    y: 20,
    frame: false, // Rimuove la barra del titolo
    alwaysOnTop: true, // Mantiene sempre in primo piano
    skipTaskbar: true, // Non mostra nella taskbar
    resizable: false, // Non ridimensionabile
    transparent: true, // Sfondo trasparente
    titleBarStyle: 'customButtonsOnHover',
    titleBarOverlay: false,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      webSecurity: false,
      allowRunningInsecureContent: true
    },
    show: false // Non mostra immediatamente
  });

  // Carica il file HTML del widget
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Debug: aggiungi console per vedere cosa succede
  mainWindow.webContents.once('dom-ready', () => {
    console.log('DOM ready, path:', __dirname);
    console.log('Files in directory:', fs.readdirSync(__dirname));
  });

  // Aggiungi listener per errori di caricamento
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.log('Failed to load:', validatedURL, errorDescription);
  });

  // Mostra la finestra quando è pronta
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Su macOS, nascondi l'icona dal dock
    if (process.platform === 'darwin') {
      app.dock.hide();
    }
  });

  // Gestisce la chiusura della finestra
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Previeni che la finestra venga chiusa accidentalmente
  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    } else {
      // Cleanup veloce prima di chiudere
      if (mainWindow && !mainWindow.isDestroyed()) {
        try {
          mainWindow.webContents.send('cleanup-audio');
        } catch (error) {
          console.log('Errore durante cleanup:', error);
        }
      }
    }
  });

  // Imposta la finestra per passare attraverso i click del mouse (opzionale)
  // Decommentare la riga seguente se si vuole che il widget sia "click-through"
  // mainWindow.setIgnoreMouseEvents(true);

  // Abilita il trascinamento del widget
  mainWindow.webContents.executeJavaScript(`
    document.addEventListener('DOMContentLoaded', () => {
      const widget = document.querySelector('.widget-container');
      let isDragging = false;
      let offset = { x: 0, y: 0 };

      widget.addEventListener('mousedown', (e) => {
        isDragging = true;
        const bounds = widget.getBoundingClientRect();
        offset.x = e.clientX - bounds.left;
        offset.y = e.clientY - bounds.top;
        widget.style.cursor = 'grabbing';
      });

      document.addEventListener('mousemove', (e) => {
        if (isDragging) {
          const { ipcRenderer } = require('electron');
          ipcRenderer.send('move-window', {
            x: e.screenX - offset.x,
            y: e.screenY - offset.y
          });
        }
      });

      document.addEventListener('mouseup', () => {
        isDragging = false;
        widget.style.cursor = 'grab';
      });
    });
  `);
}

// Funzione per creare la tray icon
function createTray() {
  try {
    // Crea l'icona iniziale della tray
    const iconPath = path.join(__dirname, '..', 'assets', trayFrames[0]);
    
    // Verifica se il file esiste
    if (!fs.existsSync(iconPath)) {
      console.log('⚠️ File icona tray non trovato:', iconPath);
      console.log('💡 Crea i file icona nella cartella assets per abilitare la tray icon');
      return;
    }
    
    const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
    tray = new Tray(icon);
    
    // Crea il menu contestuale
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Mostra Widget',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
          }
        }
      },
      {
        label: 'Nascondi Widget',
        click: () => {
          if (mainWindow) {
            mainWindow.hide();
          }
        }
      },
      { type: 'separator' },
      {
        label: 'Avvia Animazione Tray',
        click: () => {
          animateTrayIcon();
        }
      },
      {
        label: 'Ferma Animazione Tray',
        click: () => {
          stopTrayAnimation();
        }
      },
      { type: 'separator' },
      {
        label: 'Esci',
        click: () => {
          app.isQuiting = true;
          app.quit();
        }
      }
    ]);
    
    tray.setContextMenu(contextMenu);
    tray.setToolTip('Performance Monitor Widget');
    
    // Click sulla tray icon mostra/nasconde la finestra
    tray.on('click', () => {
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
        }
      }
    });
    
    console.log('✅ Tray icon creata con successo');
  } catch (error) {
    console.error('❌ Errore nella creazione della tray icon:', error);
  }
}

// Funzione per animare l'icona della tray
function animateTrayIcon() {
  // Se l'animazione è già attiva, non fare nulla
  if (trayAnimationInterval) {
    console.log('⚠️ Animazione tray già attiva');
    return;
  }
  
  if (!tray) {
    console.log('⚠️ Tray non inizializzata');
    return;
  }
  
  let frame = 0;

  trayAnimationInterval = setInterval(() => {
    try {
      const iconPath = path.join(__dirname, '..', 'assets', trayFrames[frame]);
      
      // Verifica se il file esiste
      if (fs.existsSync(iconPath)) {
        const image = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
        tray.setImage(image);
        frame = (frame + 1) % trayFrames.length;
      } else {
        console.log('⚠️ Frame non trovato:', iconPath);
        stopTrayAnimation();
      }
    } catch (error) {
      console.error('❌ Errore nell\'animazione tray:', error);
      stopTrayAnimation();
    }
  }, 250);
  
  console.log('▶️ Animazione tray avviata');
}

// Funzione per fermare l'animazione della tray
function stopTrayAnimation() {
  if (trayAnimationInterval) {
    clearInterval(trayAnimationInterval);
    trayAnimationInterval = null;
    
    // Ripristina l'icona iniziale
    if (tray) {
      try {
        const iconPath = path.join(__dirname, '..', 'assets', trayFrames[0]);
        if (fs.existsSync(iconPath)) {
          const image = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
          tray.setImage(image);
        }
      } catch (error) {
        console.error('❌ Errore nel ripristino icona tray:', error);
      }
    }
    
    console.log('⏹️ Animazione tray fermata');
  }
}

// Gestisce il movimento della finestra
ipcMain.on('move-window', (event, { x, y }) => {
  if (mainWindow) {
    mainWindow.setPosition(Math.round(x), Math.round(y));
  }
});

// Gestisce la minimizzazione della finestra
ipcMain.on('window-minimize', () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

// Gestisce il salvataggio del file audio sul desktop
ipcMain.on('save-audio-file', (event, data) => {
  try {
    const { filename, buffer, info } = data;
    
    // Ottieni il percorso del desktop
    const desktopPath = path.join(os.homedir(), 'Desktop');
    const filePath = path.join(desktopPath, filename);
    
    // Converti l'array back in Buffer
    const audioBuffer = Buffer.from(buffer);
    
    // Salva il file
    fs.writeFile(filePath, audioBuffer, (err) => {
      if (err) {
        console.error('❌ Errore nel salvataggio del file audio:', err);
        if (mainWindow) {
          mainWindow.webContents.send('audio-save-error', err.message);
        }
      } else {
        console.log('✅ File audio salvato con successo:', filePath);
        console.log('📊 Info registrazione:', info);
        if (mainWindow) {
          mainWindow.webContents.send('audio-save-success', { filename, path: filePath });
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Errore nel processo di salvataggio:', error);
    if (mainWindow) {
      mainWindow.webContents.send('audio-save-error', error.message);
    }
  }
});

// Gestisce la chiusura della finestra
ipcMain.on('window-close', () => {
  console.log('🔴 APP: Ricevuto comando di chiusura');
  if (mainWindow) {
    // Cleanup rapido
    try {
      mainWindow.webContents.send('cleanup-audio');
    } catch (error) {
      console.log('Cleanup error:', error);
    }
    
    // Chiudi l'app
    setTimeout(() => {
      app.quit();
    }, 200);
  }
});

// Gestisce la pulizia dell'audio
ipcMain.on('cleanup-audio', () => {
  // L'evento cleanup-audio viene gestito nel renderer process
  console.log('Cleanup audio richiesto');
});

// Gestisce il toggle della visibilità
ipcMain.on('window-toggle', () => {
  if (mainWindow) {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
    }
  }
});

// Questo metodo viene chiamato quando Electron ha finito l'inizializzazione
app.whenReady().then(() => {
  createWidget();
  
  // Crea la tray icon
  createTray();
  
  // Avvia l'animazione automaticamente insieme al widget
  setTimeout(() => animateTrayIcon(), 1000);

  app.on('activate', () => {
    // Su macOS è comune ricreare una finestra quando l'icona del dock viene cliccata
    if (BrowserWindow.getAllWindows().length === 0) {
      createWidget();
    }
  });
});

// Esce quando tutte le finestre sono chiuse
app.on('window-all-closed', () => {
  // Forza la chiusura dell'app anche su macOS
  console.log('🔴 APP: Tutte le finestre chiuse - forzando quit');
  app.quit();
});

// Gestisce la chiusura forzata dell'app
app.on('before-quit', (event) => {
  console.log('🔴 APP: Before quit - iniziando cleanup completo');
  app.isQuiting = true;
  
  // Ferma l'animazione della tray se attiva
  stopTrayAnimation();
  
  // Distruggi la tray icon
  if (tray) {
    tray.destroy();
    tray = null;
  }
  
  // Prova a fare cleanup se la finestra esiste
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      // Invia comando di cleanup
      mainWindow.webContents.send('cleanup-audio');
      
      // Forza anche cleanup JavaScript diretto
      mainWindow.webContents.executeJavaScript(`
        console.log('🔴 FORCE CLEANUP: Cleanup JavaScript diretto');
        
        // Ferma TUTTI gli elementi audio nella pagina
        const audioElements = document.querySelectorAll('audio');
        console.log('Trovati ' + audioElements.length + ' elementi audio da fermare');
        audioElements.forEach((audio, i) => {
          try {
            console.log('Fermando audio ' + (i+1));
            audio.pause();
            audio.currentTime = 0;
            audio.src = '';
            audio.load();
            audio.remove();
          } catch (e) {
            console.log('Errore fermando audio ' + (i+1) + ':', e);
          }
        });
        
        // Ferma eventuali oggetti Audio globali
        if (window.audioSystem) {
          ['currentAudio', 'currentAudioCpu', 'currentAudioRam'].forEach(prop => {
            if (window.audioSystem[prop]) {
              try {
                window.audioSystem[prop].pause();
                window.audioSystem[prop].src = '';
                window.audioSystem[prop] = null;
              } catch (e) {
                console.log('Errore cleanup ' + prop + ':', e);
              }
            }
          });
        }
        
        // Cleanup tracker audio
        if (window.audioElements) {
          window.audioElements.forEach(audio => {
            try {
              audio.pause();
              audio.src = '';
            } catch (e) {}
          });
          window.audioElements = [];
        }
        
        console.log('✅ FORCE CLEANUP completato');
      `).catch(err => {
        console.log('Errore durante JavaScript cleanup:', err);
      });
      
    } catch (error) {
      console.log('Errore generale cleanup:', error);
    }
  }
  
  // Delay minimo per permettere cleanup, poi forza chiusura
  setTimeout(() => {
    console.log('🔴 APP: Timeout cleanup - forzando quit finale');
    app.exit(0);
  }, 300);
});

// Nasconde l'applicazione dal dock su macOS
if (process.platform === 'darwin') {
  app.on('ready', () => {
    app.dock.hide();
  });
}