async function updateStats() {
  try {
    const battery = await window.API.getBattery();
    const cpuLoad = await window.API.getCpuLoad();
    const mem = await window.API.getMemory();
    const cpuInfo = await window.API.getCpuInfo();
    const processes = await window.API.getProcesses();
    const timeInfo = await window.API.getTimeInfo();
    

    //Battery
    document.getElementById("battery").innerText = battery.hasBattery
      ? battery.percent.toFixed(0)
      : "N/A";

    //CPU Load
    const cpuPercent = cpuLoad.currentLoad.toFixed(1);
    document.getElementById("cpu").innerText = cpuPercent;

    //RAM Usage
    const ramPercent = ((mem.active / mem.total) * 100).toFixed(1);
    document.getElementById("ram").innerText = ramPercent;

    //CPU Thermometer
    document.getElementById("shape-cpu-thermometer").style.opacity =
      (cpuPercent/400) + 0.75;

    //Uptime
    document.getElementById("uptime").innerText = formatTime(timeInfo.uptime);

    //shape battery
    document.getElementById("shape-battery").style.borderRadius =
      (battery.percent / 2) + "%";

    //shape cpu
    document.getElementById("shape-cpu").style.clipPath = `polygon(50% ${100 - cpuPercent}%, 0% 100%, 100% 100%)`;
    //document.getElementById("shape-cpu").style.borderRadius = `${100 - cpuPercent}%`;


    //shape uptime
    //get hour from uptime
    const hour = Math.floor(timeInfo.uptime / 3600);
    console.log(hour);
    document.getElementById("shape-uptime").style.width = `${
      Math.min(hour * hour, 100)
    }px`;

    //shape ram - rotazione continua proporzionale alla RAM usage
    const ramShape = document.getElementById("shape-ram");
    const rotationSpeed = Math.max(0.5, ramPercent / 10); // velocità minima 0.1s, massima 10s
    ramShape.style.animation = `continuousRotation ${rotationSpeed}s linear infinite`;


    document.getElementById("cpu-thermometer-label").innerText =
    cpuPercent + "%";


    //change all .shape background color in relation of the thermometer
    document.getElementById(
      "shape-cpu-thermometer"
    ).style.backgroundColor = `rgba(255, 255, 255, ${cpuPercent / 100})`;
  } catch (err) {
    console.error("Errore nel caricamento statistiche:", err);
  }

  
}

async function showMouseCoords() {
  const pos = await window.API.getMousePosition();
  console.log(`Mouse: x=${pos.x}, y=${pos.y}`);
  document.getElementById(
    "mouse-coords"
  ).innerText = `X: ${pos.x}, Y: ${pos.y}`;
  //shape mouse - scala proporzionale alla posizione X e Y con origine bottom-left (max 100px)
  const screenWidth = window.screen.width; // larghezza dello schermo
  const screenHeight = window.screen.height; // altezza dello schermo
  const widthPercentage = pos.x / screenWidth; // percentuale della posizione X (0-1)
  const heightPercentage = 1 - (pos.y / screenHeight); // percentuale invertita Y (alto=1, basso=0)
  const scaleXValue = widthPercentage; 
  const scaleYValue = heightPercentage; 
  document.getElementById("shape-mouse").style.transform = `scale(${scaleXValue}, ${scaleYValue})`;
}

function formatTime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hrs.toString().padStart(2, "0")}:${mins
    .toString()
    .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

setInterval(showMouseCoords, 500);
setInterval(updateStats, 1000);

showMouseCoords();
updateStats();
