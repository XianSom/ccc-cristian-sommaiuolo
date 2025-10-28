(function () {
  let yourID = 3;
  let friendID = 6;
  let table = "students";

  // Variabili personali
  let personalBattery = 0;
  let personalCpuLoad = 0;
  let personalRam = 0;
  let personalUptime = 0;
  let personalMouse = { x: 0, y: 0 };

  // Variabili amico
  let friendBattery = 0;
  let friendCpuLoad = 0;
  let friendRam = 0;
  let friendUptime = 0;
  let friendMouse = { x: 0, y: 0 };

  // Variabile per il volume master delle frequenze personali
  let personalVolumeMultiplier = 1.0; // Default 100%

  // Motore di sintesi sonora
  let audioContext;
  let oscillators = {};
  let gainNodes = {};
  let lfoOscillators = {}; // Oscillatori per la fluttuazione
  let lfoGains = {}; // Gain per controllare l'intensità della fluttuazione
  let ampModOscillators = {}; // Oscillatori per modulazione di ampiezza
  let ampModGains = {}; // Gain per controllare la modulazione di ampiezza
  let isAudioInitialized = false;

  // Inizializza il motore audio
  function initAudio() {
    if (isAudioInitialized) {
      // Se già inizializzato, controlla se il contesto è sospeso
      if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
          console.log("Audio context resumed");
        });
      }
      return;
    }
    
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Forza la ripresa se sospeso
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      // Frequenze delle note musicali
      const frequencies = {
        // Note personali
        do: 130.82,   // C3 (dimezzata da C4) - personalBattery
        mi: 329.63,   // E4 - personalRam
        sol: 196.00,  // G3 (dimezzata da G4) - personalCpuLoad
        // Note amico
        solFriend: 392.00,  // G4 (dimezzata da G5) - friendBattery
        siFriend: 493.88,   // B4 (dimezzata da B5) - friendCpuLoad
        reFriend: 587.32    // D5 (raddoppiata da D4) - friendRam
      };
      
      // Crea oscillatori e gain nodes per ogni nota
      Object.keys(frequencies).forEach(note => {
        // Oscillatore principale
        oscillators[note] = audioContext.createOscillator();
        oscillators[note].type = 'sine';
        oscillators[note].frequency.setValueAtTime(frequencies[note], audioContext.currentTime);
        
        // Oscillatore LFO per la fluttuazione (vibrato) - più lento e fluido
        lfoOscillators[note] = audioContext.createOscillator();
        lfoOscillators[note].type = 'sine';
        lfoOscillators[note].frequency.setValueAtTime(0.1 + Math.random() * 0.2, audioContext.currentTime); // 0.1-0.3 Hz (molto più lento)
        
        // Gain per controllare l'intensità della fluttuazione - valore medio
        lfoGains[note] = audioContext.createGain();
        lfoGains[note].gain.setValueAtTime(frequencies[note] * 0.005, audioContext.currentTime); // 0.5% di fluttuazione (valore medio tra 0.2% e 0.8%)
        
        // Connessioni per la fluttuazione
        lfoOscillators[note].connect(lfoGains[note]);
        lfoGains[note].connect(oscillators[note].frequency);
        
        // Oscillatore per modulazione di ampiezza (AM)
        ampModOscillators[note] = audioContext.createOscillator();
        ampModOscillators[note].type = 'sine';
        // Frequenza iniziale sarà aggiornata nella funzione updateAudioSynthesis
        ampModOscillators[note].frequency.setValueAtTime(1, audioContext.currentTime);
        
        // Gain per controllare l'intensità della modulazione di ampiezza (±0.3)
        ampModGains[note] = audioContext.createGain();
        ampModGains[note].gain.setValueAtTime(0.3, audioContext.currentTime); // Modulazione ±0.3
        
        // Gain node per controllare il volume principale
        gainNodes[note] = audioContext.createGain();
        gainNodes[note].gain.setValueAtTime(0, audioContext.currentTime);
        
        // Gain node per la modulazione di ampiezza (separato dal controllo volume)
        const ampModulationGain = audioContext.createGain();
        ampModulationGain.gain.setValueAtTime(1, audioContext.currentTime); // Valore base 1
        
        // Connessioni audio con modulazione di ampiezza corretta
        oscillators[note].connect(ampModulationGain);
        ampModulationGain.connect(gainNodes[note]);
        
        // Connessione della modulazione di ampiezza al gain separato
        ampModOscillators[note].connect(ampModGains[note]);
        ampModGains[note].connect(ampModulationGain.gain); // Modula il gain separato
        
        gainNodes[note].connect(audioContext.destination);
        
        // Avvia gli oscillatori
        oscillators[note].start();
        lfoOscillators[note].start();
        ampModOscillators[note].start();
      });
      
      isAudioInitialized = true;
      console.log("Motore audio inizializzato", audioContext.state);
      
      // Avvia immediatamente l'aggiornamento audio
      updateAudioSynthesis();
      
    } catch (error) {
      console.error("Errore nell'inizializzazione audio:", error);
    }
  }

  // Aggiorna i volumi delle note basati sui valori personali e dell'amico
  function updateAudioSynthesis() {
    if (!isAudioInitialized || !audioContext) return;
    
    const now = audioContext.currentTime;
    
    // Funzione esponenziale per mappare i valori (0-100) ai volumi
    // Usa Math.pow per creare una curva esponenziale molto pronunciata
    function exponentialMapping(value, maxVolume, exponent = 3) {
      const normalizedValue = Math.max(0, Math.min(100, value)) / 100; // Clamp 0-1
      return Math.pow(normalizedValue, exponent) * maxVolume;
    }
    
    // Note personali con curva esponenziale (esponente 3) - ridotte del 30%
    // Applica il moltiplicatore del volume dello slider
    const doVolume = exponentialMapping(personalBattery, (0.4 / 3) * personalVolumeMultiplier, 3);
    const miVolume = exponentialMapping(personalRam, (0.4 / 3) * personalVolumeMultiplier, 3);
    const solVolume = exponentialMapping(personalCpuLoad, (0.4 / 3) * personalVolumeMultiplier, 3);
    
    // Note amico con curva esponenziale uguale (esponente 3) - ridotte del 30%
    const solFriendVolume = exponentialMapping(friendBattery, (0.4 / 3) * 0.7, 3);
    const siFriendVolume = exponentialMapping(friendCpuLoad, (0.4 / 3) * 0.7, 3);
    const reFriendVolume = exponentialMapping(friendRam, (0.4 / 3) * 0.7, 3);
    
    // Aggiorna le frequenze dei modulatori di ampiezza basate sulle variabili
    // Mappa i valori 0-100 a frequenze 0.5-10 Hz con curva esponenziale
    function mapToAMFrequency(value) {
      const normalizedValue = Math.max(0, Math.min(100, value)) / 100; // Clamp 0-1
      const exponentialValue = Math.pow(normalizedValue, 2.5); // Curva esponenziale con esponente 2.5
      return 0.5 + (exponentialValue * 9.5); // Range 0.5-10 Hz
    }
    
    // Aggiorna frequenze AM per note personali
    ampModOscillators.do.frequency.setTargetAtTime(mapToAMFrequency(personalBattery), now, 0.1);
    ampModOscillators.mi.frequency.setTargetAtTime(mapToAMFrequency(personalRam), now, 0.1);
    ampModOscillators.sol.frequency.setTargetAtTime(mapToAMFrequency(personalCpuLoad), now, 0.1);
    
    // Aggiorna frequenze AM per note amico
    ampModOscillators.solFriend.frequency.setTargetAtTime(mapToAMFrequency(friendBattery), now, 0.1);
    ampModOscillators.siFriend.frequency.setTargetAtTime(mapToAMFrequency(friendCpuLoad), now, 0.1);
    ampModOscillators.reFriend.frequency.setTargetAtTime(mapToAMFrequency(friendRam), now, 0.1);
    
    // Applica i volumi con transizioni molto smooth e lente
    // Note personali - transizioni più fluide (0.3s invece di 0.1s)
    gainNodes.do.gain.setTargetAtTime(doVolume, now, 0.3);
    gainNodes.mi.gain.setTargetAtTime(miVolume, now, 0.3);
    gainNodes.sol.gain.setTargetAtTime(solVolume, now, 0.3);
    
    // Note amico - transizioni ancora più fluide (0.4s)
    gainNodes.solFriend.gain.setTargetAtTime(solFriendVolume, now, 0.4);
    gainNodes.siFriend.gain.setTargetAtTime(siFriendVolume, now, 0.4);
    gainNodes.reFriend.gain.setTargetAtTime(reFriendVolume, now, 0.4);
  }

  // Inizializza l'audio quando l'utente interagisce con la pagina
  document.addEventListener('click', initAudio);
  document.addEventListener('keydown', initAudio);
  document.addEventListener('mousemove', initAudio);
  document.addEventListener('touchstart', initAudio);
  
  // Tenta l'inizializzazione automatica
  setTimeout(() => {
    initAudio();
  }, 1000);
  
  // Tenta di inizializzare quando la pagina è completamente caricata
  window.addEventListener('load', initAudio);
  document.addEventListener('DOMContentLoaded', initAudio);

  // Funzione per fermare l'audio (opzionale) - con transizioni fluide
  function stopAudio() {
    if (isAudioInitialized && audioContext) {
      Object.keys(gainNodes).forEach(note => {
        gainNodes[note].gain.setTargetAtTime(0, audioContext.currentTime, 0.5); // Fade out più lento
      });
      // Ferma anche gli oscillatori LFO se necessario
      Object.keys(lfoOscillators).forEach(note => {
        try {
          lfoOscillators[note].stop(audioContext.currentTime + 0.5); // Stop ritardato per evitare click
        } catch (e) {
          // Oscillatore già fermato
        }
      });
      // Ferma anche gli oscillatori di modulazione di ampiezza
      Object.keys(ampModOscillators).forEach(note => {
        try {
          ampModOscillators[note].stop(audioContext.currentTime + 0.5); // Stop ritardato per evitare click
        } catch (e) {
          // Oscillatore già fermato
        }
      });
    }
  }

  // Pulisci l'audio quando la finestra si chiude
  window.addEventListener('beforeunload', stopAudio);

  // Event listeners per dati personali
  window.addEventListener("batteryUpdate", (e) => {
    personalBattery = e.detail.percent.toFixed(0);
  });

  window.addEventListener("cpuLoadUpdate", (e) => {
    personalCpuLoad = e.detail.currentLoad.toFixed(1);
  });

  window.addEventListener("ramUpdate", (e) => {
    personalRam = ((e.detail.active / e.detail.total) * 100).toFixed(1);
  });

  window.addEventListener("uptimeUpdate", (e) => {
    personalUptime = e.detail.uptime;
  });

  window.addEventListener("mouseUpdate", (e) => {
    personalMouse = e.detail;
    
    // Mappa la posizione X del mouse (0-larghezza schermo) al range dello slider (0-100)
    // Assumendo una larghezza schermo tipica, mappiamo 0-1920px a 0-100%
    const screenWidth = 1920; // Puoi adattare questo valore
    const mouseXPercent = Math.max(0, Math.min(100, (e.detail.x / screenWidth) * 100));
    
    // Aggiorna lo slider
    const slider = document.getElementById('personal-volume-slider');
    const volumeLabel = document.getElementById('volume-label');
    if (slider && volumeLabel) {
      slider.value = mouseXPercent;
      volumeLabel.textContent = Math.round(mouseXPercent) + '%';
      
      // Aggiorna il moltiplicatore del volume (0-100% -> 0-1)
      personalVolumeMultiplier = mouseXPercent / 100;
    }
  });

  // Connessione Supabase
  const SUPABASE_URL = "https://ukaxvfohnynqjvgzxtkk.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrYXh2Zm9obnlucWp2Z3p4dGtrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0MzU5NzgsImV4cCI6MjA3NjAxMTk3OH0.dZIYwmU-DYSgZFqmpEGXnwb8mm1pYGTU7As9ZrlFWL4";

  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Event listener per lo slider del volume (controllo manuale)
  document.addEventListener('DOMContentLoaded', () => {
    const slider = document.getElementById('personal-volume-slider');
    const volumeLabel = document.getElementById('volume-label');
    
    if (slider && volumeLabel) {
      slider.addEventListener('input', (e) => {
        const sliderValue = parseFloat(e.target.value);
        volumeLabel.textContent = Math.round(sliderValue) + '%';
        personalVolumeMultiplier = sliderValue / 100;
      });
    }
  });

  let channel; // 👈 definita qui, visibile ovunque

  // Funzione per inviare i propri dati
  async function saveData() {
    const input = {
      id: yourID,
      data: {
        cpuLoad: personalCpuLoad,
        battery: personalBattery,
        ram: personalRam,
        uptime: personalUptime,
        mouse: personalMouse,
        heartbeat: Date.now(),
      },
      updated_at: new Date(),
    };

    const { error } = await supabase.from(table).upsert([input]);
    if (error) {
      console.error("Insert error:", error.message);
    } else {
      console.log("Insert success");
    }
  }

  // Funzione per gestire il canale Realtime
  function subscribeRealtime() {
    if (channel) {
      console.warn("Removing old channel before re-subscribing...");
      supabase.removeChannel(channel);
    }

    channel = supabase
      .channel("public:" + table)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: table },
        (payload) => {
          const data = payload.new;
          if (data.id === friendID) {
            friendBattery = data.data.battery;
            friendCpuLoad = data.data.cpuLoad;
            friendRam = data.data.ram;
            friendUptime = data.data.uptime;
            friendMouse = data.data.mouse;
            console.log("Friend data updated:", data.data);
            draw();
          }
        }
      )
      .subscribe((status) => {
        console.log("Realtime channel status:", status);
        if (status === "CLOSED" || status === "CHANNEL_ERROR") {
          console.warn("Realtime disconnected. Reconnecting in 3s...");
          setTimeout(subscribeRealtime, 3000);
        }
      });
  }

  // Inizializza Realtime
  subscribeRealtime();

  // 👇 Ping periodico per tenere vivo il canale
  setInterval(() => {
    if (channel && channel.state === "joined") {
      channel.send({
        type: "broadcast",
        event: "ping",
        payload: { t: Date.now() },
      });
      console.log("Ping sent to keep connection alive");
    }
  }, 20000);

// Funzione per creare tutti i cerchi sovrapposti in un unico SVG
  function createOverlappedCircles() {
    const container = document.getElementById("circles-container");
    
    // Definisce il range uniforme per tutti i cerchi
    const minRadius = 20;  // Raggio minimo per tutti i cerchi
    const maxRadius = 240; // Raggio massimo per tutti i cerchi
    const radiusRange = maxRadius - minRadius;
    
    // Funzione per rimappare i valori (0-100) al range uniforme di raggi
    function mapToRadiusRange(value) {
      const normalizedValue = Math.max(0, Math.min(100, value)) / 100; // Clamp 0-1
      return minRadius + (normalizedValue * radiusRange);
    }
    
    // Calcola i raggi per i dati personali e dell'amico
    const personalBatteryRadius = mapToRadiusRange(personalBattery);
    const personalCpuRadius = mapToRadiusRange(personalCpuLoad);
    const personalRamRadius = mapToRadiusRange(personalRam);
    const friendBatteryRadius = mapToRadiusRange(friendBattery);
    const friendCpuRadius = mapToRadiusRange(friendCpuLoad);
    const friendRamRadius = mapToRadiusRange(friendRam);
    
    // Verifica se l'SVG esiste già, altrimenti crealo
    let svg = container.querySelector('svg');
    if (!svg) {
      // Crea l'SVG iniziale con tutti i cerchi
      container.innerHTML = `
        <svg width="600" height="600" viewBox="0 0 600 600">
          <!-- Cerchi personali -->
          <circle id="personal-battery" cx="300" cy="300" r="${personalBatteryRadius}" 
                  fill="none" stroke="rgba(255, 255, 255, 1)" 
                  stroke-width="2.1" opacity="1"/>
          <circle id="personal-cpu" cx="300" cy="300" r="${personalCpuRadius}" 
                  fill="none" stroke="rgba(255, 255, 255, 1)" 
                  stroke-width="1.4" opacity="1"/>
          <circle id="personal-ram" cx="300" cy="300" r="${personalRamRadius}" 
                  fill="none" stroke="rgba(255, 255, 255, 1)" 
                  stroke-width="0.7" opacity="1"/>
          
          <!-- Cerchi dell'amico -->
          <circle id="friend-battery" cx="300" cy="300" r="${friendBatteryRadius}" 
                  fill="none" stroke="rgba(255, 255, 255, 1)" 
                  stroke-width="2.1" opacity="0.5"/>
          <circle id="friend-cpu" cx="300" cy="300" r="${friendCpuRadius}" 
                  fill="none" stroke="rgba(255, 255, 255, 1)" 
                  stroke-width="1.4" opacity="0.5"/>
          <circle id="friend-ram" cx="300" cy="300" r="${friendRamRadius}" 
                  fill="none" stroke="rgba(255, 255, 255, 1)" 
                  stroke-width="0.7" opacity="0.5"/>
          
          <!-- Legenda -->
          <text id="personal-legend" x="300" y="540" text-anchor="middle" fill="white" font-size="12" opacity="0.8">
            Personal: B:${Math.round(personalBattery)}% C:${Math.round(personalCpuLoad)}% R:${Math.round(personalRam)}%
          </text>
          <text id="friend-legend" x="300" y="560" text-anchor="middle" fill="white" font-size="12" opacity="0.6">
            Friend: B:${Math.round(friendBattery)}% C:${Math.round(friendCpuLoad)}% R:${Math.round(friendRam)}%
          </text>
        </svg>
      `;
    } else {
      // Aggiorna solo i raggi e le legende dei cerchi esistenti per transizioni fluide
      const personalBatteryCircle = svg.querySelector('#personal-battery');
      const personalCpuCircle = svg.querySelector('#personal-cpu');
      const personalRamCircle = svg.querySelector('#personal-ram');
      const friendBatteryCircle = svg.querySelector('#friend-battery');
      const friendCpuCircle = svg.querySelector('#friend-cpu');
      const friendRamCircle = svg.querySelector('#friend-ram');
      const personalLegend = svg.querySelector('#personal-legend');
      const friendLegend = svg.querySelector('#friend-legend');
      
      // Aggiorna i raggi gradualmente
      if (personalBatteryCircle) personalBatteryCircle.setAttribute('r', personalBatteryRadius);
      if (personalCpuCircle) personalCpuCircle.setAttribute('r', personalCpuRadius);
      if (personalRamCircle) personalRamCircle.setAttribute('r', personalRamRadius);
      if (friendBatteryCircle) friendBatteryCircle.setAttribute('r', friendBatteryRadius);
      if (friendCpuCircle) friendCpuCircle.setAttribute('r', friendCpuRadius);
      if (friendRamCircle) friendRamCircle.setAttribute('r', friendRamRadius);
      
      // Aggiorna le legende
      if (personalLegend) {
        personalLegend.textContent = `Personal: B:${Math.round(personalBattery)}% C:${Math.round(personalCpuLoad)}% R:${Math.round(personalRam)}%`;
      }
      if (friendLegend) {
        friendLegend.textContent = `Friend: B:${Math.round(friendBattery)}% C:${Math.round(friendCpuLoad)}% R:${Math.round(friendRam)}%`;
      }
    }
  }

// Disegno dati sullo schermo
  function draw() {
    if (personalRam && friendRam && friendMouse && personalMouse) {
      // Crea tutti i cerchi sovrapposti
      createOverlappedCircles();
      
      // Aggiorna la sintesi sonora
      updateAudioSynthesis();
      
      document.getElementById("you-coords").innerText =
        personalMouse.x + ", " + personalMouse.y + "; ";
      document.getElementById("friend-coords").innerText =
        friendMouse.x + ", " + friendMouse.y;
    }
  }

  // Salva dati periodicamente - frequenza aumentata per animazioni meno scattose
  setInterval(saveData, 100);
  
  // Chiamata iniziale per disegnare i cerchi
  draw();
})();
