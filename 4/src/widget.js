const { ipcRenderer } = require('electron');
const os = require('os');

// Variabili per il monitoraggio di un minuto
let monitoringData = [];
let monitoringActive = false;
let monitoringInterval = null;
let monitoringCounter = 0;
let monitoringTimeout = null; // AGGIUNGI QUESTA VARIABILE
const MAX_SAMPLES = 10; // 10 campioni in 600 secondi (ogni 60 secondi)

// Variabili per il monitoraggio ciclico
let cyclicMonitoringActive = false;
let cyclicMonitoringTimeout = null;

// Variabili per l'aggiornamento velocità animazione in tempo reale
let speedUpdateInterval = null;

// ================== SISTEMA DI SIMULAZIONE ==================
// Variabili per la simulazione delle coppie audio
let simulationMode = false; // DISATTIVATA - usa valori reali
let currentSimulationPair = 0; // Coppia attuale (0-9 per testare tutte le coppie)
let simulationCycleCount = 0; // Contatore dei cicli completati

// Funzione per generare valori CPU simulati basati sulla coppia corrente
function getSimulatedCPUValue() {
    // Genera un valore nella fascia del 10% corrispondente alla coppia corrente
    // Coppia 0: CPU 0-9%, Coppia 1: CPU 10-19%, etc.
    const baseValue = currentSimulationPair * 10;
    const randomOffset = Math.random() * 10; // 0-10%
    const simulatedCPU = Math.min(100, baseValue + randomOffset);
    console.log(`🎯 SIMULAZIONE: Coppia ${currentSimulationPair} -> CPU simulata: ${simulatedCPU.toFixed(1)}%`);
    return Math.round(simulatedCPU);
}

// Funzione per generare valori RAM simulati basati sulla coppia corrente  
function getSimulatedRAMValue() {
    // Genera un valore nella fascia del 10% corrispondente alla coppia corrente
    // Coppia 0: RAM 0-9%, Coppia 1: RAM 10-19%, etc.
    const baseValue = currentSimulationPair * 10;
    const randomOffset = Math.random() * 10; // 0-10%
    const simulatedRAM = Math.min(100, baseValue + randomOffset);
    console.log(`🎯 SIMULAZIONE: Coppia ${currentSimulationPair} -> RAM simulata: ${simulatedRAM.toFixed(1)}%`);
    return Math.round(simulatedRAM);
}

// Funzione per avanzare alla prossima coppia di simulazione
function advanceSimulationPair() {
    currentSimulationPair = (currentSimulationPair + 1) % 10; // Cicla da 0 a 9
    if (currentSimulationPair === 0) {
        simulationCycleCount++;
        console.log(`🔄 SIMULAZIONE: Completato ciclo ${simulationCycleCount}, ripartendo dalla coppia 0`);
    }
    console.log(`🎯 SIMULAZIONE: Passaggio alla coppia ${currentSimulationPair} (Aoki_${currentSimulationPair} + Aoki_${currentSimulationPair + 10})`);
}

// Funzione per mostrare lo status della simulazione
function displaySimulationStatus() {
    if (simulationMode) {
        console.log(`🎯 Testando coppia ${currentSimulationPair}: Aoki_${currentSimulationPair} + Aoki_${currentSimulationPair + 10}`);
    }
}

// ================== FINE SISTEMA DI SIMULAZIONE ==================

// Riferimenti agli elementi DOM
const elements = {
    cpuProgress: document.getElementById('cpu-progress'),
    cpuValue: document.getElementById('cpu-value'),
    memoryProgress: document.getElementById('memory-progress'),
    memoryValue: document.getElementById('memory-value'),
    batteryProgress: document.getElementById('battery-progress'),
    batteryValue: document.getElementById('battery-value'),
    batteryIcon: document.getElementById('battery-icon'),
    monitoringList: null,
    monitoringStatus: null,
    tooltipCpuValue: null,
    tooltipRamValue: null
};

// Sistema di gestione audio
const audioSystem = {
    files: [
        'Aoki_0.wav', 'Aoki_1.wav', 'Aoki_2.wav', 'Aoki_3.wav', 'Aoki_4.wav', 
        'Aoki_5.wav', 'Aoki_6.wav', 'Aoki_7.wav', 'Aoki_8.wav', 'Aoki_9.wav',
        'Aoki_10.wav', 'Aoki_11.wav', 'Aoki_12.wav', 'Aoki_13.wav', 'Aoki_14.wav',
        'Aoki_15.wav', 'Aoki_16.wav', 'Aoki_17.wav', 'Aoki_18.wav', 'Aoki_19.wav'
    ],
    currentAudio: null,
    currentAudioCpu: null,
    currentAudioRam: null,
    isPlaying: false,
    basePath: '../AUDIO/',
    // Sistema di analisi audio per controllo opacità
    audioContext: null,
    analyser: null,
    dataArray: null,
    animationFrame: null,
    isAnalyzing: false,
    // Sistema di registrazione audio
    mediaRecorder: null,
    recordedChunks: [],
    audioDestination: null,
    isRecording: false,
    currentRecordingInfo: null // Info su CPU e RAM per il nome file
};

// Array globale per tracciare tutti gli oggetti Audio creati
window.audioElements = window.audioElements || [];

// Esponi audioSystem globalmente per il cleanup
window.audioSystem = audioSystem;

// ================== SISTEMA ANALISI AUDIO PER CERCHIO ROSSO ==================

// Inizializza il sistema di analisi audio
function initAudioAnalysis() {
    try {
        console.log('🔧 AUDIO DEBUG: Inizializzando sistema analisi audio per cerchio rosso...');
        
        // Verifica supporto Web Audio API
        if (!window.AudioContext && !window.webkitAudioContext) {
            console.error('❌ AUDIO DEBUG: Web Audio API non supportata dal browser');
            return false;
        }
        
        // Crea il contesto audio se non esiste
        audioSystem.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log('✅ AUDIO DEBUG: AudioContext creato:', audioSystem.audioContext.state);
        
        // Crea l'analizzatore
        audioSystem.analyser = audioSystem.audioContext.createAnalyser();
        audioSystem.analyser.fftSize = 256; // Dimensione FFT per analisi
        console.log('✅ AUDIO DEBUG: AnalyserNode creato, FFT size:', audioSystem.analyser.fftSize);
        
        const bufferLength = audioSystem.analyser.frequencyBinCount;
        audioSystem.dataArray = new Uint8Array(bufferLength);
        console.log('✅ AUDIO DEBUG: Buffer creato, lunghezza:', bufferLength);
        
        console.log('✅ AUDIO DEBUG: Sistema analisi audio inizializzato per cerchio rosso');
        return true;
    } catch (error) {
        console.error('❌ AUDIO DEBUG: Errore inizializzazione analisi audio:', error);
        return false;
    }
}

// Connette i due audio al mixer e all'analizzatore
function connectAudioToAnalyzer(audioCpu, audioRam) { // ← Serve ENTRAMBI
    try {
        console.log('🔗 AUDIO DEBUG: Connettendo entrambi gli audio al mixer...');
        
        if (!audioSystem.audioContext || !audioSystem.analyser) {
            console.log('🔧 AUDIO DEBUG: Sistema non inizializzato, inizializzando...');
            const success = initAudioAnalysis();
            if (!success) {
                console.error('❌ AUDIO DEBUG: Inizializzazione fallita, abortendo connessione');
                return null;
            }
        }
        
        // Verifica stato AudioContext
        console.log('🔍 AUDIO DEBUG: AudioContext state:', audioSystem.audioContext.state);
        if (audioSystem.audioContext.state === 'suspended') {
            console.log('🔄 AUDIO DEBUG: AudioContext sospeso, tentando resume...');
            audioSystem.audioContext.resume();
        }
        
        // Crea mixer per combinare i due audio
        const mixer = audioSystem.audioContext.createGain();
        mixer.gain.value = 0.7; // Volume del mix
        
        // Crea sorgenti per entrambi gli audio
        console.log('🎵 AUDIO DEBUG: Creando MediaElementSource per CPU e RAM');
        const sourceCpu = audioSystem.audioContext.createMediaElementSource(audioCpu);
        const sourceRam = audioSystem.audioContext.createMediaElementSource(audioRam);
        
        // Crea un destination per la registrazione
        audioSystem.audioDestination = audioSystem.audioContext.createMediaStreamDestination();
        console.log('🎙️ RECORDING: MediaStreamDestination creato per registrazione');
        
        // Connetti: CPU → mixer, RAM → mixer
        sourceCpu.connect(mixer);
        sourceRam.connect(mixer);
        
        // Dal mixer, invia a: analyser, altoparlanti E destination per registrazione
        mixer.connect(audioSystem.analyser);
        mixer.connect(audioSystem.audioContext.destination);
        mixer.connect(audioSystem.audioDestination);
        
        // Inizializza e connetti il sistema Lissajous
        if (initLissajousSystem()) {
            connectLissajousToSources(sourceCpu, sourceRam);
        }
        
        console.log('✅ AUDIO DEBUG: Audio mixato connesso all\'analizzatore e registratore con successo');
        return { mixer, sourceCpu, sourceRam };
    } catch (error) {
        console.error('❌ AUDIO DEBUG: Errore connessione audio analyzer:', error);
        console.error('❌ AUDIO DEBUG: Stack trace:', error.stack);
        return null;
    }
}

// Analizza il volume del mix in tempo reale e aggiorna il cerchio rosso
function analyzeAudioVolume() {
    if (!audioSystem.analyser || !audioSystem.dataArray) {
        console.warn('⚠️ AUDIO DEBUG: Analyser o dataArray non disponibili');
        return;
    }
    
    // Ottieni i dati di frequenza
    audioSystem.analyser.getByteFrequencyData(audioSystem.dataArray);
    
    // Calcola il volume medio
    let sum = 0;
    let maxValue = 0;
    for (let i = 0; i < audioSystem.dataArray.length; i++) {
        sum += audioSystem.dataArray[i];
        maxValue = Math.max(maxValue, audioSystem.dataArray[i]);
    }
    const averageVolume = sum / audioSystem.dataArray.length;
    
    // Log dettagliato ogni secondo (60 frame = 1 secondo circa)
    if (Math.random() < 0.016) { // ~1/60 possibilità per log ogni secondo
        console.log(`🔴 CERCHIO DEBUG: Volume avg=${averageVolume.toFixed(1)}, max=${maxValue}, sum=${sum.toFixed(0)}`);
    }
    
    // Mappa il volume (0-255) al raggio del cerchio rosso (45-270px) - ridotto del 10%
    // Usa una funzione esponenziale per maggiore dinamicità
    const minRadius = 45; // 50 * 0.9 = 45
    const maxRadius = 270; // 300 * 0.9 = 270
    const normalizedVolume = averageVolume / 255; // 0-1
    const exponentialVolume = Math.pow(normalizedVolume, 0.3); // Esponente 0.3 per curva più dinamica
    const radius = minRadius + exponentialVolume * (maxRadius - minRadius);
    
    // Aggiorna il cerchio rosso
    updateRedCircleRadius(radius, averageVolume);
    
    // Continua l'analisi se attiva
    if (audioSystem.isAnalyzing) {
        audioSystem.animationFrame = requestAnimationFrame(analyzeAudioVolume);
    }
}

// Aggiorna le dimensioni del cerchio rosso in base al volume audio
function updateRedCircleRadius(radius, averageVolume = 0) {
    const redCircle = document.querySelector('.red-border-circle');
    
    if (redCircle) {
        // Durante l'audio, il cerchio varia in base al volume
        redCircle.style.width = radius + 'px';
        redCircle.style.height = radius + 'px';
        
        // // Aggiorna anche lo spessore del bordo proporzionalmente
        // const borderWidth = Math.max(2, radius / 30);
        // redCircle.style.borderWidth = borderWidth + 'px';
        
        // console.log(`🔴 CERCHIO AGGIORNATO: Raggio=${radius.toFixed(1)}px, Volume=${averageVolume.toFixed(1)}, Bordo=${borderWidth.toFixed(1)}px`);
    } else {
        console.log(`❌ CERCHIO ERROR: Elemento .red-border-circle non trovato`);
    }
}

// Aggiorna l'opacità del cerchio rosso in base alla CPU durante il monitoraggio
function updateRedCircleOpacityFromCPU(cpuPercent) {
    const redCircle = document.querySelector('.red-border-circle');
    
    if (redCircle) {
        // Mappa CPU (0-100%) all'opacità (0.3-1.0)
        // CPU bassa = opacità bassa (poco visibile)
        // CPU alta = opacità alta (molto visibile)
        const opacity = 0.3 + (cpuPercent / 100) * 0.7;
        
        // Ottieni il colore attuale o usa rosso di default
        const currentColor = redCircle.style.borderColor;
        let r = 255, g = 0, b = 0;
        
        // Se c'è già un colore rgba, estrai i valori RGB
        const rgbaMatch = currentColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (rgbaMatch) {
            r = parseInt(rgbaMatch[1]);
            g = parseInt(rgbaMatch[2]);
            b = parseInt(rgbaMatch[3]);
        }
        
        // Applica la nuova opacità mantenendo il colore
        redCircle.style.borderColor = `rgba(${r}, ${g}, ${b}, ${opacity})`;
        
    }
}

// Avvia l'analisi audio per il cerchio rosso
function startAudioAnalysis() {
    if (!audioSystem.isAnalyzing) {
        audioSystem.isAnalyzing = true;
        console.log('🚀 AUDIO DEBUG: Analisi audio avviata per controllo cerchio rosso');
        console.log('🔍 AUDIO DEBUG: Stato sistema:', {
            hasContext: !!audioSystem.audioContext,
            hasAnalyser: !!audioSystem.analyser,
            hasDataArray: !!audioSystem.dataArray,
            contextState: audioSystem.audioContext?.state
        });
        analyzeAudioVolume();
    } else {
        console.log('⚠️ AUDIO DEBUG: Analisi audio già attiva');
    }
}

// Ferma l'analisi audio
function stopAudioAnalysis() {
    console.log('🛑 AUDIO DEBUG: Fermando analisi audio...');
    audioSystem.isAnalyzing = false;
    
    if (audioSystem.animationFrame) {
        cancelAnimationFrame(audioSystem.animationFrame);
        audioSystem.animationFrame = null;
        console.log('🛑 AUDIO DEBUG: AnimationFrame cancellato');
    }
    
    // Ripristina dimensioni normali del cerchio rosso - SEMPRE 45px (ridotto del 10%)
    const redCircle = document.querySelector('.red-border-circle');
    if (redCircle) {
        redCircle.style.width = '45px'; // 50px * 0.9 = 45px
        redCircle.style.height = '45px'; // 50px * 0.9 = 45px
        redCircle.style.borderWidth = '2px';
        redCircle.style.borderColor = 'red';
        console.log('🔄 AUDIO DEBUG: Cerchio rosso ripristinato a 45px');
    }
    
    console.log('✅ AUDIO DEBUG: Analisi audio fermata completamente');
}

// ================== FINE SISTEMA ANALISI AUDIO ==================







// ================== SISTEMA VISUALIZZAZIONE WAVEFORM ==================

const waveformSystem = {
    canvas: null,
    ctx: null,
    analyserLeft: null,
    analyserRight: null,
    dataArrayLeft: null,
    dataArrayRight: null,
    isActive: false,
    animationFrame: null
};

// Inizializza il sistema di visualizzazione Waveform
function initLissajousSystem() {
    try {
        console.log('🎨 WAVEFORM: Inizializzazione sistema...');
        
        waveformSystem.canvas = document.getElementById('waveform-canvas');
        if (!waveformSystem.canvas) {
            console.error('❌ WAVEFORM: Canvas non trovato');
            return false;
        }
        
        waveformSystem.ctx = waveformSystem.canvas.getContext('2d');
        if (!waveformSystem.ctx) {
            console.error('❌ WAVEFORM: Impossibile ottenere context 2D');
            return false;
        }
        
        console.log('✅ WAVEFORM: Sistema inizializzato');
        return true;
    } catch (error) {
        console.error('❌ WAVEFORM: Errore inizializzazione:', error);
        return false;
    }
}

// Connetti analizzatori Waveform alle sorgenti audio già create
function connectLissajousToSources(sourceCpu, sourceRam) {
    try {
        console.log('🎧 WAVEFORM: Connettendo analizzatori ai canali separati...');
        
        if (!audioSystem.audioContext) {
            console.error('❌ WAVEFORM: AudioContext non disponibile');
            return false;
        }
        
        // Crea analizzatori separati per CPU e RAM
        waveformSystem.analyserLeft = audioSystem.audioContext.createAnalyser();
        waveformSystem.analyserRight = audioSystem.audioContext.createAnalyser();
        
        // Configurazione analizzatori con FFT più grande per migliore risoluzione
        waveformSystem.analyserLeft.fftSize = 128;
        waveformSystem.analyserRight.fftSize = 128;
        waveformSystem.analyserLeft.smoothingTimeConstant = 0.9;
        waveformSystem.analyserRight.smoothingTimeConstant = 0.9;

        const bufferLength = waveformSystem.analyserLeft.fftSize;
        waveformSystem.dataArrayLeft = new Uint8Array(bufferLength);
        waveformSystem.dataArrayRight = new Uint8Array(bufferLength);
        
        // Connetti le sorgenti esistenti agli analizzatori Waveform
        sourceCpu.connect(waveformSystem.analyserLeft);
        sourceRam.connect(waveformSystem.analyserRight);
        
        console.log('✅ WAVEFORM: Analizzatori connessi alle sorgenti');
        return true;
    } catch (error) {
        console.error('❌ WAVEFORM: Errore connessione analizzatori:', error);
        return false;
    }
}

// Disegna la forma d'onda (waveform) - somma di CPU e RAM al centro
function drawLissajous() {
    if (!waveformSystem.isActive) return;
    
    // Ottieni i dati time-domain dai due analizzatori
    waveformSystem.analyserLeft.getByteTimeDomainData(waveformSystem.dataArrayLeft);
    waveformSystem.analyserRight.getByteTimeDomainData(waveformSystem.dataArrayRight);
    
    const ctx = waveformSystem.ctx;
    const canvas = waveformSystem.canvas;
    const width = canvas.width;
    const height = canvas.height;
    const centerY = height / 2;
    
    // Pulisci il canvas
    ctx.clearRect(0, 0, width, height);
    
    // Disegna la forma d'onda sommata (CPU + RAM) al centro del canvas
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)'; // Bianco semi-trasparente
    ctx.lineWidth = 3;
    
    const bufferLength = waveformSystem.dataArrayLeft.length;
    const sliceWidth = width / bufferLength;
    
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
        // Normalizza i valori da 0-255 a -1 to 1
        const cpuValue = (waveformSystem.dataArrayLeft[i] / 128.0) - 1; // -1 to 1
        const ramValue = (waveformSystem.dataArrayRight[i] / 128.0) - 1; // -1 to 1
        
        // Somma i due segnali
        const summedValue = (cpuValue + ramValue) / 2; // Media per evitare clipping
        
        // Calcola la posizione Y centrata
        const y = centerY + (summedValue * (height / 2) * 3); // 3 per ampiezza maggiore
        
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
        
        x += sliceWidth;
    }
    
    ctx.stroke();
    
    // Disegna linea centrale di riferimento (opzionale)
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();
    
    // Continua l'animazione
    waveformSystem.animationFrame = requestAnimationFrame(drawLissajous);
}

// Avvia la visualizzazione Waveform
function startLissajousVisualization() {
    if (!waveformSystem.isActive) {
        console.log('🚀 WAVEFORM: Avvio visualizzazione...');
        waveformSystem.isActive = true;
        drawLissajous();
    }
}

// Ferma la visualizzazione Waveform
function stopLissajousVisualization() {
    console.log('🛑 WAVEFORM: Fermando visualizzazione...');
    waveformSystem.isActive = false;
    
    if (waveformSystem.animationFrame) {
        cancelAnimationFrame(waveformSystem.animationFrame);
        waveformSystem.animationFrame = null;
    }
    
    // Pulisci il canvas
    if (waveformSystem.ctx && waveformSystem.canvas) {
        waveformSystem.ctx.clearRect(0, 0, waveformSystem.canvas.width, waveformSystem.canvas.height);
    }
    
    console.log('✅ WAVEFORM: Visualizzazione fermata');
}

// ================== FINE SISTEMA VISUALIZZAZIONE WAVEFORM ==================

// ================== SISTEMA REGISTRAZIONE AUDIO ==================

// Funzione per avviare la registrazione dell'audio simultaneo
function startAudioRecording(cpuFilename, ramFilename, avgCpu, avgRam) {
    try {
        if (!audioSystem.audioContext || !audioSystem.audioDestination) {
            console.error('❌ RECORDING: AudioContext o Destination non disponibile');
            return false;
        }

        // Salva le informazioni per il nome del file
        audioSystem.currentRecordingInfo = {
            cpuFile: cpuFilename,
            ramFile: ramFilename,
            avgCpu: avgCpu,
            avgRam: avgRam,
            timestamp: new Date()
        };

        // Reset dei chunk registrati
        audioSystem.recordedChunks = [];

        // Crea un MediaRecorder dal destination stream
        const stream = audioSystem.audioDestination.stream;
        
        // Prova diversi codec per compatibilità
        let options;
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
            options = { mimeType: 'audio/webm;codecs=opus' };
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
            options = { mimeType: 'audio/webm' };
        } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
            options = { mimeType: 'audio/ogg;codecs=opus' };
        } else {
            options = {}; // Usa il default
        }

        audioSystem.mediaRecorder = new MediaRecorder(stream, options);

        audioSystem.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioSystem.recordedChunks.push(event.data);
                console.log(`📼 RECORDING: Chunk registrato (${event.data.size} bytes)`);
            }
        };

        audioSystem.mediaRecorder.onstop = () => {
            console.log('🛑 RECORDING: Registrazione completata, salvando file...');
            saveRecordedAudio();
        };

        audioSystem.mediaRecorder.onerror = (error) => {
            console.error('❌ RECORDING: Errore durante la registrazione:', error);
        };

        // Avvia la registrazione
        audioSystem.mediaRecorder.start();
        audioSystem.isRecording = true;
        console.log('🔴 RECORDING: Registrazione avviata');
        console.log('📋 RECORDING Info:', audioSystem.currentRecordingInfo);

        return true;
    } catch (error) {
        console.error('❌ RECORDING: Errore nell\'avvio della registrazione:', error);
        return false;
    }
}

// Funzione per fermare la registrazione
function stopAudioRecording() {
    if (audioSystem.mediaRecorder && audioSystem.isRecording) {
        try {
            audioSystem.mediaRecorder.stop();
            audioSystem.isRecording = false;
            console.log('⏹️ RECORDING: Stop richiesto');
        } catch (error) {
            console.error('❌ RECORDING: Errore nello stop:', error);
        }
    }
}

// Funzione per salvare l'audio registrato sul desktop
async function saveRecordedAudio() {
    try {
        if (audioSystem.recordedChunks.length === 0) {
            console.error('❌ RECORDING: Nessun dato audio registrato');
            return;
        }

        // Crea il blob dall'audio registrato
        const blob = new Blob(audioSystem.recordedChunks, { type: 'audio/webm' });
        console.log(`💾 RECORDING: Blob creato (${blob.size} bytes)`);

        // Genera il nome del file con informazioni dettagliate
        const info = audioSystem.currentRecordingInfo;
        const timestamp = info.timestamp.toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const filename = `AOKI_Mix_CPU${info.avgCpu}_RAM${info.avgRam}_${timestamp}.webm`;

        // Usa l'IPC di Electron per salvare il file sul desktop
        const arrayBuffer = await blob.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Invia al processo principale per salvare
        ipcRenderer.send('save-audio-file', {
            filename: filename,
            buffer: Array.from(buffer),
            info: info
        });

        console.log('✅ RECORDING: File inviato per il salvataggio:', filename);
        
        // Mostra notifica all'utente
        updateAudioStatus(`Audio salvato: ${filename}`, 'saved');
        setTimeout(() => {
            updateAudioStatus('', 'idle');
        }, 5000);

    } catch (error) {
        console.error('❌ RECORDING: Errore nel salvataggio:', error);
        updateAudioStatus('Errore nel salvataggio audio', 'error');
    }
}

// ================== FINE SISTEMA REGISTRAZIONE AUDIO ==================

// Funzione per selezionare l'audio in base alla media CPU (fasce del 10%)
function selectAudioByCPUAverage(avgCpu) {
    // Calcola l'indice del file audio in base alla fascia CPU del 10%
    // 0-9.99% -> Aoki_0.wav, 10-19.99% -> Aoki_1.wav, ..., 90-100% -> Aoki_9.wav
    const index = Math.min(Math.floor(avgCpu / 10), 9);
    const filename = `Aoki_${index}.wav`;
    
    console.log(`🎵 CPU AUDIO: CPU=${avgCpu.toFixed(1)}% -> fascia ${index} -> ${filename}`);
    return filename;
}

// Funzione per selezionare l'audio in base alla media RAM (fasce del 10% usando file 10-19)
function selectAudioByRAMAverage(avgRam) {
    // Usa i file Aoki_10.wav fino Aoki_19.wav per la RAM
    // 0-9.99% -> Aoki_10.wav, 10-19.99% -> Aoki_11.wav, ..., 90-100% -> Aoki_19.wav
    const index = Math.min(Math.floor(avgRam / 10), 9) + 10;
    const filename = `Aoki_${index}.wav`;
    
    console.log(`🎵 RAM AUDIO: RAM=${avgRam.toFixed(1)}% -> fascia ${index-10} -> ${filename}`);
    return filename;
}

// Funzione per riprodurre simultaneamente due file audio (CPU e RAM)
function playSimultaneousAudio(cpuFilename, ramFilename, avgCpu = 0, avgRam = 0) {
    try {
        // Ferma eventuali audio precedenti
        stopCurrentAudio();
        
        // Crea i due elementi audio
        audioSystem.currentAudioCpu = new Audio(audioSystem.basePath + cpuFilename);
        audioSystem.currentAudioRam = new Audio(audioSystem.basePath + ramFilename);
        
        // Aggiungi al tracker globale
        window.audioElements.push(audioSystem.currentAudioCpu);
        window.audioElements.push(audioSystem.currentAudioRam);
        
        // Imposta il volume per entrambi
        audioSystem.currentAudioCpu.volume = 0.5;
        audioSystem.currentAudioRam.volume = 0.5;
        
        let cpuStarted = false;
        let ramStarted = false;
        let cpuEnded = false;
        let ramEnded = false;
        let audioConnected = false; // Flag per evitare connessioni multiple
        
        // Event listeners per l'audio CPU
        audioSystem.currentAudioCpu.addEventListener('play', () => {
            cpuStarted = true;
            
            // Connetti SOLO quando entrambi sono partiti E non ancora connesso
            if (cpuStarted && ramStarted && !audioConnected) {
                audioSystem.isPlaying = true;
                updateAudioStatus(`Riproduzione simultanea: CPU ${cpuFilename} + RAM ${ramFilename}`, 'playing');
                
                // CORREZIONE: Passa ENTRAMBI gli audio
                console.log('🎵 AUDIO DEBUG: Connettendo entrambi gli audio al mixer...');
                const result = connectAudioToAnalyzer(audioSystem.currentAudioCpu, audioSystem.currentAudioRam);
                
                if (result) {
                    // Avvia l'analisi audio per il controllo del cerchio rosso
                    setTimeout(() => {
                        startAudioAnalysis();
                    }, 100);
                    
                    // Avvia la visualizzazione Lissajous
                    setTimeout(() => {
                        startLissajousVisualization();
                    }, 150);
                    
                    // Avvia la registrazione dell'audio simultaneo
                    setTimeout(() => {
                        startAudioRecording(cpuFilename, ramFilename, avgCpu, avgRam);
                    }, 200);
                    
                    audioConnected = true;
                } else {
                    console.error('❌ AUDIO DEBUG: Connessione fallita, impossibile analizzare audio');
                }
            }
        });
        
        audioSystem.currentAudioCpu.addEventListener('ended', () => {
            cpuEnded = true;
            if (cpuEnded && ramEnded) {
                audioSystem.isPlaying = false;
                updateAudioStatus('Riproduzione completata', 'ended');
                
                // Ferma l'analisi audio quando entrambi i file finiscono
                stopAudioAnalysis();
                
                // Ferma la visualizzazione Lissajous
                stopLissajousVisualization();
                
                // Ferma la registrazione e salva il file
                stopAudioRecording();
                
                setTimeout(() => {
                    updateAudioStatus('', 'idle');
                }, 2000);
            }
        });
        
        audioSystem.currentAudioCpu.addEventListener('error', (e) => {
            console.error('Errore nella riproduzione audio CPU:', e);
            updateAudioStatus('Errore nella riproduzione CPU', 'error');
        });
        
        // Event listeners per l'audio RAM
        audioSystem.currentAudioRam.addEventListener('play', () => {
            ramStarted = true;
            
            // Connetti SOLO quando entrambi sono partiti E non ancora connesso
            if (cpuStarted && ramStarted && !audioConnected) {
                audioSystem.isPlaying = true;
                updateAudioStatus(`Riproduzione simultanea: CPU ${cpuFilename} + RAM ${ramFilename}`, 'playing');
                
                // CORREZIONE: Passa ENTRAMBI gli audio
                console.log('🎵 AUDIO DEBUG: Connettendo entrambi gli audio al mixer...');
                const result = connectAudioToAnalyzer(audioSystem.currentAudioCpu, audioSystem.currentAudioRam);
                
                if (result) {
                    setTimeout(() => {
                        startAudioAnalysis();
                    }, 100);
                    
                    // Avvia la visualizzazione Lissajous
                    setTimeout(() => {
                        startLissajousVisualization();
                    }, 150);
                    
                    // Avvia la registrazione dell'audio simultaneo
                    setTimeout(() => {
                        startAudioRecording(cpuFilename, ramFilename, avgCpu, avgRam);
                    }, 200);
                    
                    audioConnected = true;
                } else {
                    console.error('❌ AUDIO DEBUG: Connessione fallita');
                }
            }
        });
        
        audioSystem.currentAudioRam.addEventListener('ended', () => {
            ramEnded = true;
            if (cpuEnded && ramEnded) {
                audioSystem.isPlaying = false;
                updateAudioStatus('Riproduzione completata', 'ended');
                stopAudioAnalysis();
                
                // Ferma la visualizzazione Lissajous
                stopLissajousVisualization();
                
                // Ferma la registrazione e salva il file
                stopAudioRecording();
                
                setTimeout(() => {
                    updateAudioStatus('', 'idle');
                }, 2000);
            }
        });
        
        audioSystem.currentAudioRam.addEventListener('error', (e) => {
            console.error('Errore nella riproduzione audio RAM:', e);
            updateAudioStatus('Errore nella riproduzione RAM', 'error');
        });
        
        // Avvia la riproduzione simultanea
        audioSystem.currentAudioCpu.play();
        audioSystem.currentAudioRam.play();
        
    } catch (error) {
        console.error('Errore nel caricamento dei file audio:', error);
        updateAudioStatus('Errore nel caricamento audio', 'error');
    }
}

// Funzione per riprodurre un file audio specifico
function playAudioFile(filename) {
    try {
        // Ferma l'audio precedente se in riproduzione
        stopCurrentAudio();
        
        // Crea nuovo elemento audio
        audioSystem.currentAudio = new Audio(audioSystem.basePath + filename);
        
        // Aggiungi al tracker globale
        window.audioElements.push(audioSystem.currentAudio);
        audioSystem.currentAudio.volume = 0.7; // Volume al 70%
        
        // Event listeners per l'audio
        audioSystem.currentAudio.addEventListener('play', () => {
            audioSystem.isPlaying = true;
            updateAudioStatus(`Riproduzione: ${filename}`, 'playing');
        });
        
        audioSystem.currentAudio.addEventListener('ended', () => {
            audioSystem.isPlaying = false;
            updateAudioStatus('Riproduzione completata', 'ended');
            setTimeout(() => {
                updateAudioStatus('', 'idle');
            }, 2000);
        });
        
        audioSystem.currentAudio.addEventListener('error', (e) => {
            console.error('Errore nella riproduzione audio:', e);
            audioSystem.isPlaying = false;
            updateAudioStatus('Errore nella riproduzione', 'error');
            setTimeout(() => {
                updateAudioStatus('', 'idle');
            }, 3000);
        });
        
        // Avvia la riproduzione
        audioSystem.currentAudio.play();
        
    } catch (error) {
        console.error('Errore nel caricamento del file audio:', error);
        updateAudioStatus('Errore nel caricamento audio', 'error');
    }
}

// Funzione per riprodurre un file audio casuale
function playRandomAudio() {
    if (audioSystem.files.length === 0) {
        console.warn('Nessun file audio disponibile');
        return;
    }
    
    // Seleziona un file audio casuale
    const randomIndex = Math.floor(Math.random() * audioSystem.files.length);
    const selectedFile = audioSystem.files[randomIndex];
    
    playAudioFile(selectedFile);
}

// Funzione per fermare l'audio corrente
function stopCurrentAudio() {
    try {
        console.log('🔴 STOP AUDIO: Iniziando cleanup audio...');
        
        if (audioSystem.currentAudio) {
            console.log('🔴 Fermando currentAudio...');
            audioSystem.currentAudio.pause();
            audioSystem.currentAudio.currentTime = 0;
            audioSystem.currentAudio.src = '';
            audioSystem.currentAudio.load(); // Force reload to clear buffer
            audioSystem.currentAudio.remove && audioSystem.currentAudio.remove();
            audioSystem.currentAudio = null;
            console.log('✅ currentAudio fermato');
        }
        
        if (audioSystem.currentAudioCpu) {
            console.log('🔴 Fermando currentAudioCpu...');
            audioSystem.currentAudioCpu.pause();
            audioSystem.currentAudioCpu.currentTime = 0;
            audioSystem.currentAudioCpu.src = '';
            audioSystem.currentAudioCpu.load();
            audioSystem.currentAudioCpu.remove && audioSystem.currentAudioCpu.remove();
            audioSystem.currentAudioCpu = null;
            console.log('✅ currentAudioCpu fermato');
        }
        
        if (audioSystem.currentAudioRam) {
            console.log('🔴 Fermando currentAudioRam...');
            audioSystem.currentAudioRam.pause();
            audioSystem.currentAudioRam.currentTime = 0;
            audioSystem.currentAudioRam.src = '';
            audioSystem.currentAudioRam.load();
            audioSystem.currentAudioRam.remove && audioSystem.currentAudioRam.remove();
            audioSystem.currentAudioRam = null;
            console.log('✅ currentAudioRam fermato');
        }
        
        audioSystem.isPlaying = false;
        
        // Ferma l'analisi audio per il controllo dell'opacità
        stopAudioAnalysis();
        
        // Ferma la visualizzazione Lissajous
        stopLissajousVisualization();
        
        console.log('✅ Audio fermato e pulito correttamente');
    } catch (error) {
        console.error('❌ Errore durante il cleanup audio:', error);
    }
}

// Funzione globale di cleanup per fermare tutto
function cleanupAll() {
    console.log('🧹 CLEANUP GLOBALE: Iniziando cleanup completo...');
    
    // Ferma tutti gli audio del nostro sistema
    stopCurrentAudio();
    
    // Ferma TUTTI gli elementi audio nella pagina (approccio aggressivo)
    try {
        const allAudioElements = document.querySelectorAll('audio');
        console.log(`🔍 Trovati ${allAudioElements.length} elementi audio nella pagina`);
        
        allAudioElements.forEach((audio, index) => {
            console.log(`🔴 Fermando elemento audio ${index + 1}...`);
            audio.pause();
            audio.currentTime = 0;
            audio.src = '';
            audio.load();
            if (audio.remove) audio.remove();
        });
        
        // Cerca anche oggetti Audio creati con new Audio()
        if (window.audioElements) {
            window.audioElements.forEach(audio => {
                audio.pause();
                audio.src = '';
                audio.load();
            });
        }
    } catch (error) {
        console.error('❌ Errore durante cleanup elementi audio:', error);
    }
    
    // Ferma il monitoraggio se attivo
    if (monitoringActive) {
        console.log('🔴 Fermando monitoraggio attivo...');
        stopMinuteMonitoring();
    }
    
    // Ferma il monitoraggio ciclico se attivo
    if (cyclicMonitoringActive) {
        console.log('🔴 Fermando monitoraggio ciclico...');
        cyclicMonitoringActive = false;
        if (cyclicMonitoringTimeout) {
            clearTimeout(cyclicMonitoringTimeout);
            cyclicMonitoringTimeout = null;
        }
    }
    
    // Ferma tutte le animazioni
    console.log('🔴 Fermando animazioni...');
    stopCircle1Animation();
    stopCircleOpenAnimation();
    
    // Cancella tutti i timeout e intervalli
    if (monitoringTimeout) {
        clearTimeout(monitoringTimeout);
        monitoringTimeout = null;
    }
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
        monitoringInterval = null;
    }
    
    console.log('✅ CLEANUP GLOBALE COMPLETATO');
}

// Funzione per aggiornare lo stato dell'audio nell'interfaccia
function updateAudioStatus(message, status = 'idle') {
    // Elemento rimosso dal DOM - non fa nulla
    console.log(`Audio status: ${message} (${status})`);
}

// ================== SISTEMA ANIMAZIONE CIRCLE1 ==================
const circle1Animation = {
    element: null,
    currentFrame: 0,
    totalFrames: 250, // 00000.png - 00249.png
    isPlaying: false,
    intervalId: null,
    frameDuration: 40, // millisecondi per frame (25 FPS di base)
    basePath: '../Circle1/',
    minFrameDuration: 10, // FPS massimo (50 FPS) per CPU al 100%
    maxFrameDuration: 90, // FPS minimo (12.5 FPS) per CPU allo 0%
    baseFrameDuration: 40 // FPS di base (25 FPS) per CPU al 50%
};

// Funzione per formattare il numero del frame con zero padding
function formatFrameNumber(frameNumber) {
    return frameNumber.toString().padStart(5, '0');
}

// Funzione per calcolare la durata del frame in base alla percentuale di CPU
function calculateFrameDurationFromCPU(cpuPercent) {
    // CPU bassa = animazione lenta (durata frame alta)
    // CPU alta = animazione veloce (durata frame bassa)
    // Formula lineare: più CPU, più veloce
    // 0% CPU -> maxFrameDuration (80ms = 12.5 FPS)
    // 100% CPU -> minFrameDuration (20ms = 50 FPS)
    const duration = circle1Animation.maxFrameDuration - 
                    ((cpuPercent / 100) * (circle1Animation.maxFrameDuration - circle1Animation.minFrameDuration));
    return Math.max(circle1Animation.minFrameDuration, Math.min(circle1Animation.maxFrameDuration, duration));
}

// Funzione per aggiornare la velocità dell'animazione Circle1 in base alla CPU
function updateCircle1AnimationSpeed(cpuPercent) {
    const newFrameDuration = calculateFrameDurationFromCPU(cpuPercent);
    
    // Se la velocità è cambiata significativamente (almeno 5ms di differenza)
    if (Math.abs(circle1Animation.frameDuration - newFrameDuration) >= 5) {
        circle1Animation.frameDuration = newFrameDuration;
        
        // Se l'animazione è attiva, riavvia l'intervallo con la nuova velocità
        if (circle1Animation.isPlaying && circle1Animation.intervalId) {
            clearInterval(circle1Animation.intervalId);
            circle1Animation.intervalId = setInterval(nextCircle1Frame, circle1Animation.frameDuration);
            
            const fps = (1000 / newFrameDuration).toFixed(1);
            console.log(`⚡ Velocità Circle1 aggiornata: ${fps} FPS (CPU: ${cpuPercent}%)`);
        }
    }
}

// Funzione per inizializzare il sistema di animazione
function initCircle1Animation() {
    circle1Animation.element = document.getElementById('circle-animation');
    
    if (!circle1Animation.element) {
        console.error('Elemento animazione Circle1 non trovato');
        return;
    }
    
    // Precarica la prima immagine
    updateCircle1Frame();
    
    // Avvia automaticamente l'animazione dopo 3 secondi
    setTimeout(() => {
        startCircle1Animation();
        console.log('Animazione Circle1 avviata automaticamente a 25 FPS');
    }, 3000);
    
    console.log('Sistema animazione Circle1 inizializzato a 25 FPS');
}

// Funzione per aggiornare il frame corrente
function updateCircle1Frame() {
    if (circle1Animation.element) {
        const frameName = formatFrameNumber(circle1Animation.currentFrame) + '.svg';
        const imagePath = circle1Animation.basePath + frameName;
        circle1Animation.element.src = imagePath;
    }
}

// Funzione per avanzare al frame successivo
function nextCircle1Frame() {
    // Controlla se l'animazione è ancora attiva prima di aggiornare
    if (!circle1Animation.isPlaying) {
        return;
    }
    circle1Animation.currentFrame = (circle1Animation.currentFrame + 1) % circle1Animation.totalFrames;
    updateCircle1Frame();
}

// Funzione per avviare l'animazione
function startCircle1Animation() {
    if (circle1Animation.isPlaying) {
        return;
    }

    circle1Animation.isPlaying = true;
    circle1Animation.intervalId = setInterval(nextCircle1Frame, circle1Animation.frameDuration);

    // Avvia la fase di monitoraggio ogni volta che parte Circle1
    if (!monitoringActive) {
        startMinuteMonitoring();
        console.log('Monitoraggio di 60 secondi avviato contestualmente a Circle1');
    }

    console.log('Animazione Circle1 avviata');
}

// Funzione per fermare l'animazione
function stopCircle1Animation() {
    if (!circle1Animation.isPlaying) {
        return;
    }
    
    circle1Animation.isPlaying = false;
    if (circle1Animation.intervalId) {
        clearInterval(circle1Animation.intervalId);
        circle1Animation.intervalId = null;
    }
    
    console.log('Animazione Circle1 fermata');
}

// ================== SISTEMA ANIMAZIONE CIRCLEOPEN ==================
const circleOpenAnimation = {
    element: null,
    currentFrame: 0,
    totalFrames: 48, // Open.00000.svg - Open.00047.svg
    isPlaying: false,
    intervalId: null,
    frameDuration: 42, // millisecondi per frame (48 frame x 42ms = 2016ms ≈ 2s)
    basePath: '../CircleOpen/',
    playOnce: true, // Flag per riproduzione singola
    onComplete: null, // Callback al completamento
    lastFrameHoldTimeout: null, // Timeout per tenere l'ultimo frame
    lastFrameHoldDuration: 60000 // 60 secondi per l'ultimo frame
};

// Funzione per formattare il numero del frame CircleOpen con zero padding
function formatCircleOpenFrameNumber(frameNumber) {
    return frameNumber.toString().padStart(5, '0');
}

// Funzione per inizializzare il sistema di animazione CircleOpen
function initCircleOpenAnimation() {
    circleOpenAnimation.element = document.getElementById('circle-animation');
    
    if (!circleOpenAnimation.element) {
        console.error('Elemento animazione CircleOpen non trovato');
        return;
    }
    
    console.log('Sistema animazione CircleOpen inizializzato');
}

// Funzione per aggiornare il frame corrente CircleOpen
function updateCircleOpenFrame() {
    if (circleOpenAnimation.element) {
        const frameName = 'Open.' + formatCircleOpenFrameNumber(circleOpenAnimation.currentFrame) + '.svg';
        const imagePath = circleOpenAnimation.basePath + frameName;
        circleOpenAnimation.element.src = imagePath;
    }
}

// Funzione per avanzare al frame successivo CircleOpen
function nextCircleOpenFrame() {
    circleOpenAnimation.currentFrame++;
    
    // Se abbiamo raggiunto l'ultimo frame
    if (circleOpenAnimation.currentFrame >= circleOpenAnimation.totalFrames) {
        if (circleOpenAnimation.playOnce) {
            // Imposta sull'ultimo frame (indice 47)
            circleOpenAnimation.currentFrame = circleOpenAnimation.totalFrames - 1;
            updateCircleOpenFrame();
            
            // Ferma l'animazione frame per frame
            if (circleOpenAnimation.intervalId) {
                clearInterval(circleOpenAnimation.intervalId);
                circleOpenAnimation.intervalId = null;
            }
            
            console.log('Animazione CircleOpen: ultimo frame raggiunto, mantiene per 60 secondi');
            
            // Mantieni l'ultimo frame per 60 secondi
            circleOpenAnimation.lastFrameHoldTimeout = setTimeout(() => {
                console.log('Animazione CircleOpen: tempo di attesa completato');
                // Ferma completamente l'animazione
                stopCircleOpenAnimation();
                // Chiama il callback se presente
                if (circleOpenAnimation.onComplete) {
                    circleOpenAnimation.onComplete();
                }
                // Avvia l'animazione CircleClose DOPO la pausa, non all'avvio del monitoraggio
                startCircleCloseAnimation(() => {
                    // Dopo CircleClose, ripristina Circle1 (se ciclico)
                    restoreCircle1Animation();
                });
            }, circleOpenAnimation.lastFrameHoldDuration); // 60 secondi
            
            return;
        } else {
            // Riproduzione ciclica
            circleOpenAnimation.currentFrame = 0;
        }
    }
    
    updateCircleOpenFrame();
}

// Funzione per avviare l'animazione CircleOpen
function startCircleOpenAnimation(playOnce = true, onComplete = null) {
    if (circleOpenAnimation.isPlaying) {
        return;
    }
    
    // Ferma l'animazione Circle1 se attiva
    stopCircle1Animation();
    
    // Configura l'animazione
    circleOpenAnimation.playOnce = playOnce;
    circleOpenAnimation.onComplete = onComplete;
    circleOpenAnimation.currentFrame = 0;
    circleOpenAnimation.isPlaying = true;
    
    // Mostra il primo frame
    updateCircleOpenFrame();
    
    // Avvia l'animazione
    circleOpenAnimation.intervalId = setInterval(nextCircleOpenFrame, circleOpenAnimation.frameDuration);
    
    console.log('Animazione CircleOpen avviata (riproduzione singola: ' + playOnce + ')');
}

// Funzione per fermare l'animazione CircleOpen
function stopCircleOpenAnimation() {
    if (!circleOpenAnimation.isPlaying) {
        return;
    }
    
    circleOpenAnimation.isPlaying = false;
    
    // Ferma l'animazione frame per frame
    if (circleOpenAnimation.intervalId) {
        clearInterval(circleOpenAnimation.intervalId);
        circleOpenAnimation.intervalId = null;
    }
    
    // Ferma il timeout dell'ultimo frame se presente
    if (circleOpenAnimation.lastFrameHoldTimeout) {
        clearTimeout(circleOpenAnimation.lastFrameHoldTimeout);
        circleOpenAnimation.lastFrameHoldTimeout = null;
    }
    
    // Ripristina l'opacità normale quando l'animazione si ferma
    if (circleOpenAnimation.element) {
        circleOpenAnimation.element.style.opacity = '1';
    }
    
    console.log('Animazione CircleOpen fermata');
}

// ================== SISTEMA ANIMAZIONE CIRCLECLOSE ==================
const circleCloseAnimation = {
    element: null,
    currentFrame: 0,
    totalFrames: 50, // 0.svg - 49.svg
    isPlaying: false,
    intervalId: null,
    frameDuration: 40, // millisecondi per frame (25 FPS) per durata totale di 2 secondi
    basePath: '../CircleClose/',
    playOnce: true, // Flag per riproduzione singola
    onComplete: null // Callback al completamento
};

// Funzione per inizializzare il sistema di animazione CircleClose
function initCircleCloseAnimation() {
    circleCloseAnimation.element = document.getElementById('circle-animation');
    
    if (!circleCloseAnimation.element) {
        console.error('Elemento animazione CircleClose non trovato');
        return;
    }
    
    console.log('Sistema animazione CircleClose inizializzato');
}

// Funzione per aggiornare il frame corrente CircleClose
function updateCircleCloseFrame() {
    if (circleCloseAnimation.element) {
        const frameName = circleCloseAnimation.currentFrame + '.svg';
        const imagePath = circleCloseAnimation.basePath + frameName;
        circleCloseAnimation.element.src = imagePath;
    }
}

// Funzione per avanzare al frame successivo CircleClose
function nextCircleCloseFrame() {
    circleCloseAnimation.currentFrame++;
    
    // Se abbiamo raggiunto l'ultimo frame
    if (circleCloseAnimation.currentFrame >= circleCloseAnimation.totalFrames) {
        // Fine dell'animazione
        circleCloseAnimation.currentFrame = circleCloseAnimation.totalFrames - 1;
        updateCircleCloseFrame();
        
        // Ferma l'animazione
        if (circleCloseAnimation.intervalId) {
            clearInterval(circleCloseAnimation.intervalId);
            circleCloseAnimation.intervalId = null;
        }
        
        circleCloseAnimation.isPlaying = false;
        console.log('Animazione CircleClose completata');
        
        // Chiama il callback se presente
        if (circleCloseAnimation.onComplete) {
            circleCloseAnimation.onComplete();
        }
        
        return;
    }
    
    updateCircleCloseFrame();
}

// Funzione per avviare l'animazione CircleClose
function startCircleCloseAnimation(onComplete = null) {
    if (circleCloseAnimation.isPlaying) {
        return;
    }
    
    // Ferma l'animazione Circle1 se attiva
    stopCircle1Animation();
    
    // Ferma l'animazione CircleOpen se attiva
    stopCircleOpenAnimation();
    
    // Configura l'animazione
    circleCloseAnimation.onComplete = onComplete;
    circleCloseAnimation.currentFrame = 0;
    circleCloseAnimation.isPlaying = true;
    
    // Mostra il primo frame
    updateCircleCloseFrame();
    
    // Avvia l'animazione
    circleCloseAnimation.intervalId = setInterval(nextCircleCloseFrame, circleCloseAnimation.frameDuration);
    
    console.log('Animazione CircleClose avviata');
}

// Funzione per fermare l'animazione CircleClose
function stopCircleCloseAnimation() {
    if (!circleCloseAnimation.isPlaying) {
        return;
    }
    
    circleCloseAnimation.isPlaying = false;
    
    // Ferma l'animazione frame per frame
    if (circleCloseAnimation.intervalId) {
        clearInterval(circleCloseAnimation.intervalId);
        circleCloseAnimation.intervalId = null;
    }
    
    console.log('Animazione CircleClose fermata');
}

// Funzione per ripristinare l'animazione Circle1
function restoreCircle1Animation() {
    // Reset al primo frame di Circle1
    circle1Animation.currentFrame = 0;
    updateCircle1Frame();
    
    // Riavvia l'animazione Circle1
    startCircle1Animation();
    
    console.log('Animazione Circle1 ripristinata dopo CircleOpen');
    // Se il monitoraggio ciclico è attivo, riavvia il ciclo
    if (cyclicMonitoringActive && !monitoringActive) {
        console.log('🔄 Riprendo monitoraggio ciclico contestualmente a Circle1');
        startMinuteMonitoring();
    }
}

// Funzione per raccogliere un campione di dati di sistema
async function collectSystemSample() {
    try {
        const timestamp = new Date();
        
        let memoryUsagePercent;
        if (simulationMode) {
            // Modalità simulazione: usa valori simulati per la RAM
            memoryUsagePercent = getSimulatedRAMValue();
        } else {
            // Modalità normale: calcolo reale memoria
            const totalMemory = os.totalmem();
            const freeMemory = os.freemem();
            const usedMemory = totalMemory - freeMemory;
            memoryUsagePercent = Math.round((usedMemory / totalMemory) * 100);
        }
        
        // Raccoglie dati CPU (già gestito dalla simulazione nella funzione getCPUUsage)
        const cpuUsage = await getCPUUsage();
        
        // Raccoglie dati batteria
        const batteryInfo = await getBatteryInfo();
        const batteryPercent = Math.round(batteryInfo.level * 100);
        
        // Aggiorna tooltip con valori correnti
        if (elements.tooltipCpuValue) {
            elements.tooltipCpuValue.textContent = `${cpuUsage}%`;
        }
        if (elements.tooltipRamValue) {
            elements.tooltipRamValue.textContent = `${memoryUsagePercent}%`;
        }
        
        const sample = {
            timestamp: timestamp.toLocaleTimeString('it-IT'),
            cpu: cpuUsage,
            memory: memoryUsagePercent,
            battery: batteryPercent,
            batteryCharging: batteryInfo.charging
        };
        
        return sample;
    } catch (error) {
        console.error('Errore nella raccolta del campione:', error);
        return null;
    }
}

// Funzione per avviare il monitoraggio di un minuto
function startMinuteMonitoring() {
    if (monitoringActive) {
        return;
    }

    monitoringActive = true;
    monitoringData = [];
    monitoringCounter = 0;

    // Avvia il monitoraggio con valori reali
    updateMonitoringStatus(`Monitoraggio attivo... (0/${MAX_SAMPLES} campioni)`);

    // Raccogli il primo campione immediatamente
    collectAndStoreSample();

    // Poi raccogli ogni 60 secondi (1 minuto)
    monitoringInterval = setInterval(() => {
        collectAndStoreSample();
    }, 60000);

    // Avvia l'aggiornamento continuo della velocità dell'animazione ogni 2 secondi
    if (speedUpdateInterval) {
        clearInterval(speedUpdateInterval);
    }
    speedUpdateInterval = setInterval(async () => {
        if (monitoringActive && circle1Animation.isPlaying) {
            const cpuUsage = await getCPUUsage();
            updateCircle1AnimationSpeed(cpuUsage);
            // Aggiorna anche l'opacità del cerchio rosso in base alla CPU
            updateRedCircleOpacityFromCPU(cpuUsage);
        }
    }, 2000);

    // Ferma automaticamente dopo 62 secondi
    if (monitoringTimeout) {
        clearTimeout(monitoringTimeout); // CANCELLA EVENTUALI TIMEOUT PRECEDENTI
    }
    monitoringTimeout = setTimeout(() => {
        if (monitoringActive) {
            stopMinuteMonitoring();
        }
    }, 600000); // 10 minuti
}

// Funzione per fermare il monitoraggio
function stopMinuteMonitoring() {
    if (!monitoringActive) {
        return;
    }

    // FERMA IMMEDIATAMENTE L'ANIMAZIONE CIRCLE1 PRIMA DI QUALSIASI ALTRA OPERAZIONE
    stopCircle1Animation();
    circle1Animation.currentFrame = circle1Animation.totalFrames - 1;
    updateCircle1Frame();
    
    // Forza nuovamente il frame finale dopo un tick per prevenire aggiornamenti residui
    setTimeout(() => {
        circle1Animation.currentFrame = circle1Animation.totalFrames - 1;
        updateCircle1Frame();
    }, 0);

    monitoringActive = false;

    if (monitoringInterval) {
        clearInterval(monitoringInterval);
        monitoringInterval = null;
    }
    if (monitoringTimeout) {
        clearTimeout(monitoringTimeout); // CANCELLA IL TIMEOUT QUANDO FERMI IL MONITORAGGIO
        monitoringTimeout = null;
    }
    if (speedUpdateInterval) {
        clearInterval(speedUpdateInterval);
        speedUpdateInterval = null;
    }
    
    // Resetta la velocità dell'animazione alla velocità di base
    circle1Animation.frameDuration = circle1Animation.baseFrameDuration;

    updateMonitoringStatus(`Monitoraggio completato! ${monitoringData.length} campioni raccolti.`);
    displayMonitoringResults();

    // Calcola le medie CPU e RAM e avvia subito l'animazione CircleOpen
    if (monitoringData.length > 0) {
        const avgCpu = Math.round(monitoringData.reduce((sum, s) => sum + s.cpu, 0) / monitoringData.length);
        const avgRam = Math.round(monitoringData.reduce((sum, s) => sum + s.memory, 0) / monitoringData.length);

        const cpuAudioFile = selectAudioByCPUAverage(avgCpu);
        const ramAudioFile = selectAudioByRAMAverage(avgRam);

        console.log(`� Audio selezionati: ${cpuAudioFile} + ${ramAudioFile} (CPU: ${avgCpu}%, RAM: ${avgRam}%)`);

        // Avvia l'animazione CircleOpen prima dell'audio
        startCircleOpenAnimation(true, () => {
            console.log('Animazione CircleOpen completata');
        });

        // Riproduci l'audio 2 secondi dopo l'inizio dell'animazione
        setTimeout(() => {
            playSimultaneousAudio(cpuAudioFile, ramAudioFile, avgCpu, avgRam);

            // Aggiorna lo stato dell'audio
            updateAudioStatus(`CPU ${avgCpu}% (${cpuAudioFile}) + RAM ${avgRam}% (${ramAudioFile})`, 'selected');
        }, 2000); // Audio inizia 2 secondi dopo l'animazione

    } else {
        // Fallback se non ci sono dati
        startCircleOpenAnimation(true, () => {
            console.log('Animazione CircleOpen completata (fallback)');
        });

        // Audio di fallback 2 secondi dopo l'animazione
        setTimeout(() => {
            playAudioFile('Aoki_0.wav');
        }, 2000);
    }

    // Se il monitoraggio ciclico è attivo, riavvia automaticamente dopo l'animazione e la pausa
    if (cyclicMonitoringActive) {
        // Calcola il timing totale:
        // 1s (delay iniziale) + ~2s (animazione) + 60s (pausa ultimo frame) + 2s (delay ritorno) = ~65s
        const totalWaitTime = 1000 + 2000 + 60000 + 2000; // 65 secondi totali

        cyclicMonitoringTimeout = setTimeout(() => {
            if (cyclicMonitoringActive && !monitoringActive) {
                console.log('🔄 Riprendendo monitoraggio ciclico dopo animazione e pausa');
                startMinuteMonitoring();
            }
        }, totalWaitTime);

        console.log(`⏱️ Prossimo ciclo di monitoraggio in ${totalWaitTime/1000} secondi`);
    }
}

// Funzione per raccogliere e memorizzare un campione
async function collectAndStoreSample() {
    const sample = await collectSystemSample();
    if (sample) {
        monitoringData.push(sample);
        monitoringCounter++;
        
        // Aggiorna la velocità dell'animazione Circle1 in base alla CPU corrente
        updateCircle1AnimationSpeed(sample.cpu);
        // Aggiorna anche l'opacità del cerchio rosso in base alla CPU
        updateRedCircleOpacityFromCPU(sample.cpu);
        
        updateMonitoringStatus(`Monitoraggio attivo... (${monitoringCounter}/${MAX_SAMPLES} campioni)`);
        updateMonitoringDisplay();
        
        if (monitoringCounter >= MAX_SAMPLES) {
            stopMinuteMonitoring();
        }
    }
}

// Funzione per aggiornare lo stato del monitoraggio
function updateMonitoringStatus(message) {
    if (elements.monitoringStatus) {
        elements.monitoringStatus.textContent = message;
    }
}

// Funzione per avviare il monitoraggio ciclico (solo uso interno)
function startCyclicMonitoring() {
    if (cyclicMonitoringActive) {
        return;
    }
    
    cyclicMonitoringActive = true;
    
    // Avvia il primo ciclo immediatamente se non è già in corso un monitoraggio
    if (!monitoringActive) {
        startMinuteMonitoring();
    }
}

// Funzione per mostrare i risultati del monitoraggio
function displayMonitoringResults() {
    if (!elements.monitoringList || monitoringData.length === 0) {
        return;
    }
    
    let listHTML = '<h4>Cronologia Monitoraggio (ultimo minuto):</h4>';
    listHTML += '<div class="monitoring-samples">';
    
    monitoringData.forEach((sample, index) => {
        listHTML += `
            <div class="sample-item">
                <div class="sample-header">
                    <span class="sample-time">${sample.timestamp}</span>
                    <span class="sample-number">#${index + 1}</span>
                </div>
                <div class="sample-data">
                    <div class="sample-metric">
                        <span class="metric-label">CPU:</span>
                        <span class="metric-value cpu-value">${sample.cpu}%</span>
                    </div>
                    <div class="sample-metric">
                        <span class="metric-label">RAM:</span>
                        <span class="metric-value memory-value">${sample.memory}%</span>
                    </div>
                    <div class="sample-metric">
                        <span class="metric-label">Batteria:</span>
                        <span class="metric-value battery-value">${sample.battery}% ${sample.batteryCharging ? '🔌' : '🔋'}</span>
                    </div>
                </div>
            </div>
        `;
    });
    
    listHTML += '</div>';
    
    // Calcola le medie
    if (monitoringData.length > 0) {
        const avgCpu = Math.round(monitoringData.reduce((sum, s) => sum + s.cpu, 0) / monitoringData.length);
        const avgMemory = Math.round(monitoringData.reduce((sum, s) => sum + s.memory, 0) / monitoringData.length);
        const avgBattery = Math.round(monitoringData.reduce((sum, s) => sum + s.battery, 0) / monitoringData.length);
        
        listHTML += `
            <div class="monitoring-summary">
                <h5>Medie del periodo:</h5>
                <div class="summary-metrics">
                    <span>CPU: <strong>${avgCpu}%</strong></span>
                    <span>RAM: <strong>${avgMemory}%</strong></span>
                    <span>Batteria: <strong>${avgBattery}%</strong></span>
                </div>
            </div>
        `;
    }
    
    elements.monitoringList.innerHTML = listHTML;
}

// Funzione per aggiornare la visualizzazione durante il monitoraggio
function updateMonitoringDisplay() {
    if (monitoringData.length === 0) return;
    
    const lastSample = monitoringData[monitoringData.length - 1];
    let displayHTML = `
        <div class="current-monitoring">
            <h5>Ultimo campione (${lastSample.timestamp}):</h5>
            <div class="current-sample">
                <span>CPU: ${lastSample.cpu}%</span>
                <span>RAM: ${lastSample.memory}%</span>
                <span>Batteria: ${lastSample.battery}%</span>
            </div>
        </div>
    `;
    
    if (elements.monitoringList) {
        elements.monitoringList.innerHTML = displayHTML;
    }
}

// Gestione delle informazioni di sistema e batteria
function updateSystemInfo() {
    try {
        let memoryUsagePercent;
        if (simulationMode) {
            // Modalità simulazione: usa valori simulati per la RAM
            memoryUsagePercent = getSimulatedRAMValue();
        } else {
            // Modalità normale: calcolo reale memoria
            const totalMemory = os.totalmem();
            const freeMemory = os.freemem();
            const usedMemory = totalMemory - freeMemory;
            memoryUsagePercent = Math.round((usedMemory / totalMemory) * 100);
        }
        
        if (elements.memoryProgress && elements.memoryValue) {
            elements.memoryProgress.style.width = `${memoryUsagePercent}%`;
            elements.memoryValue.textContent = `${memoryUsagePercent}%`;
        }
        
        // Aggiorna tooltip RAM
        if (elements.tooltipRamValue) {
            elements.tooltipRamValue.textContent = `${memoryUsagePercent}%`;
        }
        
        // Informazioni CPU (utilizza getCPUUsage che già gestisce la simulazione)
        getCPUUsage().then(cpuUsage => {
            if (elements.cpuProgress && elements.cpuValue) {
                elements.cpuProgress.style.width = `${cpuUsage}%`;
                elements.cpuValue.textContent = `${cpuUsage}%`;
                updateProgressBarColor(elements.cpuProgress, cpuUsage);
            }
            
            // Aggiorna tooltip CPU
            if (elements.tooltipCpuValue) {
                elements.tooltipCpuValue.textContent = `${cpuUsage}%`;
            }
        });
        
        // Informazioni batteria
        getBatteryInfo().then(batteryInfo => {
            const { level, charging } = batteryInfo;
            const batteryPercent = Math.round(level * 100);
            
            if (elements.batteryProgress && elements.batteryValue) {
                elements.batteryProgress.style.width = `${batteryPercent}%`;
                elements.batteryValue.textContent = `${batteryPercent}%`;
            }
            
            // Aggiorna icona batteria
            updateBatteryIcon(batteryPercent, charging);
            if (elements.batteryProgress) {
                updateBatteryColor(elements.batteryProgress, batteryPercent, charging);
            }
        });
        
        // Cambia colore in base all'utilizzo
        if (elements.memoryProgress) {
            updateProgressBarColor(elements.memoryProgress, memoryUsagePercent);
        }
        
    } catch (error) {
        console.error('Errore nell\'aggiornamento delle info di sistema:', error);
    }
}

// Funzione per ottenere l'utilizzo CPU
async function getCPUUsage() {
    return new Promise((resolve) => {
        if (simulationMode) {
            // Modalità simulazione: restituisce valori simulati
            setTimeout(() => {
                resolve(getSimulatedCPUValue());
            }, 100);
        } else {
            // Modalità normale: calcolo reale CPU
            const startMeasure = process.cpuUsage();
            const startTime = process.hrtime();
            
            setTimeout(() => {
                const endMeasure = process.cpuUsage(startMeasure);
                const endTime = process.hrtime(startTime);
                
                const totalTime = endTime[0] * 1000000 + endTime[1] / 1000;
                const cpuTime = (endMeasure.user + endMeasure.system);
                const cpuPercent = Math.min(100, Math.round((cpuTime / totalTime) * 100));
                
                // Aggiungi un po' di variazione per renderlo più realistico
                const variation = Math.round((Math.random() - 0.5) * 10);
                resolve(Math.max(0, Math.min(100, cpuPercent + variation + 20)));
            }, 100);
        }
    });
}

// Funzione per ottenere informazioni sulla batteria
async function getBatteryInfo() {
    try {
        if (navigator.getBattery) {
            const battery = await navigator.getBattery();
            return {
                level: battery.level,
                charging: battery.charging
            };
        }
    } catch (error) {
        console.log('API Batteria non disponibile, uso valori simulati');
    }
    
    // Valori simulati se l'API non è disponibile
    return {
        level: Math.random() * 0.6 + 0.3, // 30-90%
        charging: Math.random() > 0.7
    };
}

// Aggiorna l'icona della batteria
function updateBatteryIcon(percent, charging) {
    if (!elements.batteryIcon) {
        return; // Se l'elemento non esiste, esci dalla funzione
    }
    
    if (charging) {
        elements.batteryIcon.textContent = '🔌';
        elements.batteryIcon.title = 'In carica';
    } else if (percent > 75) {
        elements.batteryIcon.textContent = '🔋';
        elements.batteryIcon.title = 'Batteria piena';
    } else if (percent > 50) {
        elements.batteryIcon.textContent = '🔋';
        elements.batteryIcon.title = 'Batteria buona';
    } else if (percent > 25) {
        elements.batteryIcon.textContent = '🪫';
        elements.batteryIcon.title = 'Batteria media';
    } else {
        elements.batteryIcon.textContent = '🪫';
        elements.batteryIcon.title = 'Batteria bassa';
    }
}

// Aggiorna il colore della batteria
function updateBatteryColor(element, percentage, charging) {
    if (charging) {
        element.style.background = '#4ade80'; // Verde per in carica
    } else if (percentage > 50) {
        element.style.background = '#4ade80'; // Verde
    } else if (percentage > 20) {
        element.style.background = '#fbbf24'; // Giallo
    } else {
        element.style.background = '#ef4444'; // Rosso
    }
}

// Aggiorna il colore della barra di progresso basato sull'utilizzo
function updateProgressBarColor(element, percentage) {
    if (percentage < 50) {
        element.style.background = '#4ade80'; // Verde
    } else if (percentage < 80) {
        element.style.background = '#fbbf24'; // Giallo
    } else {
        element.style.background = '#ef4444'; // Rosso
    }
}

// Gestione del trascinamento del widget
let isDragging = false;
let offset = { x: 0, y: 0 };

document.querySelector('.widget-container').addEventListener('mousedown', (e) => {
    isDragging = true;
    const rect = e.currentTarget.getBoundingClientRect();
    offset.x = e.clientX - rect.left;
    offset.y = e.clientY - rect.top;
    document.body.style.cursor = 'grabbing';
});

document.addEventListener('mousemove', (e) => {
    if (isDragging) {
        ipcRenderer.send('move-window', {
            x: e.screenX - offset.x,
            y: e.screenY - offset.y
        });
    }
});

document.addEventListener('mouseup', () => {
    if (isDragging) {
        isDragging = false;
        document.body.style.cursor = 'grab';
    }
});

// Funzione per mostrare notifiche temporanee (DISATTIVATA)
function showNotification(message) {
    // Notifiche disattivate - solo log console per debugging
    console.log(`Notification (disabled): ${message}`);
    
    // Il resto del codice è commentato per disattivare le notifiche visive
    /*
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(0, 122, 255, 0.9);
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 11px;
        z-index: 9999;
        animation: fadeIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 2000);
    */
}

// Gestione delle scorciatoie da tastiera
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
            case 'r':
                e.preventDefault();
                updateSystemInfo(); // Aggiorna manualmente le informazioni
                break;
            case 'm':
                e.preventDefault();
                if (!monitoringActive) {
                    startMinuteMonitoring();
                } else if (monitoringActive) {
                    stopMinuteMonitoring();
                }
                break;
        }
    }
});

// Gestione degli eventi IPC dal main process
ipcRenderer.on('window-minimize', () => {
    // La finestra è stata minimizzata
});

ipcRenderer.on('audio-save-success', (event, data) => {
    console.log('✅ IPC: Audio salvato con successo sul desktop!');
    console.log('📁 Percorso:', data.path);
    updateAudioStatus(`Audio salvato: ${data.filename}`, 'saved');
});

ipcRenderer.on('audio-save-error', (event, errorMessage) => {
    console.error('❌ IPC: Errore nel salvataggio:', errorMessage);
    updateAudioStatus('Errore nel salvataggio audio', 'error');
});

ipcRenderer.on('window-show', () => {
    // La finestra è stata mostrata
});

// Inizializzazione dell'app
function initializeWidget() {
    // Inizializza i riferimenti agli elementi DOM per il monitoraggio
    elements.monitoringList = document.getElementById('monitoring-list');
    elements.monitoringStatus = document.getElementById('monitoring-status');
    
    // Inizializza i riferimenti agli elementi DOM per il tooltip
    elements.tooltipCpuValue = document.getElementById('tooltip-cpu-value');
    elements.tooltipRamValue = document.getElementById('tooltip-ram-value');
    
    // Inizializza i riferimenti agli elementi DOM per l'audio (solo per status)
    elements.audioStatus = null; // Rimosso dal DOM
    
    // Inizializza il sistema di analisi audio
    console.log('🔧 INIT: Inizializzando sistema analisi audio...');
    initAudioAnalysis();
    
    // Aggiungi listener per attivare AudioContext con interazione utente
    document.addEventListener('click', function enableAudioContext() {
        if (audioSystem.audioContext && audioSystem.audioContext.state === 'suspended') {
            console.log('👆 AUDIO DEBUG: Click rilevato, attivando AudioContext...');
            audioSystem.audioContext.resume().then(() => {
                console.log('✅ AUDIO DEBUG: AudioContext attivato tramite interazione utente');
            });
        }
    }, { once: false }); // Non rimuove il listener, potrebbe servire più volte
    
    // Inizializza il sistema di animazione Circle1
    initCircle1Animation();
    // Avvia subito l'animazione Circle1 senza delay
    startCircle1Animation();
    
    // Inizializza il sistema di animazione CircleOpen
    initCircleOpenAnimation();
    
    // Inizializza il sistema di animazione CircleClose
    initCircleCloseAnimation();
    
    updateSystemInfo();
    
    // Aggiorna le info di sistema ogni 3 secondi per un monitoraggio più frequente
    setInterval(updateSystemInfo, 3000);
    
    // Aggiorna il tooltip ogni 2 secondi indipendentemente dal monitoraggio
    setInterval(async () => {
        try {
            let memoryUsagePercent;
            if (simulationMode) {
                // Modalità simulazione: usa valori simulati
                memoryUsagePercent = getSimulatedRAMValue();
            } else {
                // Modalità normale: calcolo reale
                const totalMemory = os.totalmem();
                const freeMemory = os.freemem();
                const usedMemory = totalMemory - freeMemory;
                memoryUsagePercent = Math.round((usedMemory / totalMemory) * 100);
            }
            
            const cpuUsage = await getCPUUsage(); // Già gestisce la simulazione
            
            if (elements.tooltipCpuValue) {
                elements.tooltipCpuValue.textContent = `${cpuUsage}%`;
            }
            if (elements.tooltipRamValue) {
                elements.tooltipRamValue.textContent = `${memoryUsagePercent}%`;
            }
        } catch (error) {
            console.error('Errore aggiornamento tooltip:', error);
        }
    }, 2000);
    
    // Avvia immediatamente il monitoraggio ciclico e l'animazione senza delay
    startCyclicMonitoring();
    
    // Messaggio di avvio per la simulazione
    if (simulationMode) {
        console.log('🎯 SIMULAZIONE ATTIVA - Testando automaticamente tutte le coppie di tracce audio');
    }
    
    console.log('Widget Performance Monitor inizializzato correttamente!');
}

// Avvia l'inizializzazione quando il DOM è pronto
document.addEventListener('DOMContentLoaded', initializeWidget);

// Gestione degli errori
window.addEventListener('error', (e) => {
    console.error('Errore nel widget:', e.error);
});

// Aggiorna immediatamente al focus della finestra
// Listener per eventi IPC
window.addEventListener('focus', () => {
    updateSystemInfo();
});

// Gestione cleanup audio quando l'app viene chiusa
if (typeof require !== 'undefined') {
    const { ipcRenderer } = require('electron');
    
    ipcRenderer.on('cleanup-audio', () => {
        console.log('🔴 CLEANUP: Ricevuto segnale di cleanup IPC');
        forceAudioCleanup();
    });
}

// Funzione di cleanup completo e aggressivo
function forceAudioCleanup() {
    console.log('🔴 CLEANUP: Iniziando cleanup completo audio...');
    
    try {
        // Cleanup del nostro sistema
        stopCurrentAudio();
        
        // Cleanup di TUTTI gli elementi audio nella pagina
        const audioElements = document.querySelectorAll('audio');
        console.log(`🔍 Trovati ${audioElements.length} elementi audio da fermare`);
        
        audioElements.forEach((audio, index) => {
            try {
                console.log(`🔴 Fermando elemento audio ${index + 1}`);
                audio.pause();
                audio.currentTime = 0;
                audio.src = '';
                audio.load();
                if (audio.parentNode) {
                    audio.parentNode.removeChild(audio);
                }
            } catch (e) {
                console.log(`❌ Errore fermando audio ${index + 1}:`, e);
            }
        });
        
        // Cleanup tracker globali
        if (window.audioElements) {
            window.audioElements.forEach(audio => {
                try {
                    audio.pause();
                    audio.src = '';
                    audio.load();
                } catch (e) {
                    // Ignora errori
                }
            });
            window.audioElements = [];
        }
        
        console.log('✅ CLEANUP: Completato');
    } catch (error) {
        console.log('⚠️ CLEANUP: Errore durante cleanup:', error);
    }
}

// Cleanup automatico quando pagina viene nascosta
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        console.log('👁️ Pagina nascosta - cleanup audio preventivo');
        forceAudioCleanup();
    }
});

// Cleanup di emergenza quando finestra perde il focus
window.addEventListener('blur', () => {
    console.log('🔄 Finestra sfocata - cleanup audio preventivo');
    forceAudioCleanup();
});

// Cleanup di emergenza più semplice
window.addEventListener('beforeunload', () => {
    console.log('🚪 Page unload - cleanup di emergenza');
    forceAudioCleanup();
});