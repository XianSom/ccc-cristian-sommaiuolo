(function () {
  function updateClock() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();

    // Calcola le posizioni basate sui valori temporali
    // Container dimensions - rectangle dimensions per calcolare il range di movimento
    const containerWidth = 500;
    const containerHeight = 500;
    
    // Dimensioni specifiche per ogni quadrato
    const hoursSize = 240;
    const minutesSize = 200;
    const secondsSize = 160;
    
    // Range di movimento per ogni quadrato
    const hoursRangeX = containerWidth - hoursSize; // 260px di movimento possibile
    const minutesRangeX = containerWidth - minutesSize; // 300px di movimento possibile
    const secondsRangeX = containerWidth - secondsSize; // 340px di movimento possibile

    // Posizioni basate sui valori temporali - movimento da sinistra verso destra
    const hoursX = (hours / 23) * hoursRangeX; // 0-23 ore: da sinistra a destra
    const hoursY = 50; // Posizione fissa per le ore (parte superiore)
    
    const minutesX = (minutes / 59) * minutesRangeX; // 0-59 minuti: da sinistra a destra
    const minutesY = 150; // Posizione fissa per i minuti (centro)
    
    const secondsX = (seconds / 59) * secondsRangeX; // 0-59 secondi: da sinistra a destra
    const secondsY = 250; // Posizione fissa per i secondi (parte inferiore)

    // Applica le posizioni ai rettangoli
    document.getElementById("hours-rect").style.left = `${hoursX}px`;
    document.getElementById("hours-rect").style.top = `${hoursY}px`;
    
    document.getElementById("minutes-rect").style.left = `${minutesX}px`;
    document.getElementById("minutes-rect").style.top = `${minutesY}px`;
    
    document.getElementById("seconds-rect").style.left = `${secondsX}px`;
    document.getElementById("seconds-rect").style.top = `${secondsY}px`;

    //every minute show notification
    if(seconds === 0) {
      showNotification("System Monitor", "Un minuto è passato!");
    }
  }

  window.addEventListener("cpuLoadUpdate", (e) => {
    const data = e.detail;
    let wrap = document.querySelector(".wrap");
    let dataValue = map(data.currentLoad, 0, 100, 0, 40);
    wrap.style.gap = `${dataValue}px`;
  });

  window.addEventListener("batteryUpdate", (e) => {
    const battery = e.detail;
    if (battery.hasBattery) {
      // Mappa la percentuale della batteria (0-100) agli angoli (1-179 gradi)
      const batteryPercent = battery.percent;
      const baseAngle = map(batteryPercent, 0, 100, 1, 179);
      
      // Calcola angoli leggermente diversi per ogni quadrato mantenendo il rapporto
      const hoursAngle = baseAngle;
      const minutesAngle = baseAngle + 1;
      const secondsAngle = baseAngle + 2;
      
      // Aggiorna gli angoli dei gradienti
      document.getElementById("hours-rect").style.backgroundImage = `repeating-linear-gradient(
        ${hoursAngle}deg,
        transparent,
        transparent 5px,
        white 5px,
        white 6px
      )`;
      
      document.getElementById("minutes-rect").style.backgroundImage = `repeating-linear-gradient(
        ${minutesAngle}deg,
        transparent,
        transparent 5px,
        white 5px,
        white 6px
      )`;
      
      document.getElementById("seconds-rect").style.backgroundImage = `repeating-linear-gradient(
        ${secondsAngle}deg,
        transparent,
        transparent 5px,
        white 5px,
        white 6px
      )`;
    }
  });

  //create a map function from 0 to 360
  function map(value, min, max, minOut, maxOut) {
    return ((value - min) / (max - min)) * (maxOut - minOut) + minOut;
  }


  function showNotification(title, body) {
    if (Notification.permission === "granted") {
      new Notification(title, {
        body: body,
      });
    }
  }

  updateClock();
  setInterval(updateClock, 1000);
})();
