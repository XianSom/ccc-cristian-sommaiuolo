#!/bin/bash

# Script di installazione per Widget Desktop Aoki
# Compatibile con macOS, Linux e Windows (Git Bash)

echo "🚀 Installazione Widget Desktop Aoki"
echo "====================================="

# Controlla se Node.js è installato
if ! command -v node &> /dev/null; then
    echo "❌ Node.js non è installato. Scaricalo da: https://nodejs.org"
    exit 1
fi

# Controlla se npm è installato
if ! command -v npm &> /dev/null; then
    echo "❌ npm non è installato. Installa Node.js per includere npm"
    exit 1
fi

echo "✅ Node.js $(node --version) trovato"
echo "✅ npm $(npm --version) trovato"
echo ""

# Installa le dipendenze
echo "📦 Installazione dipendenze..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ Dipendenze installate correttamente"
else
    echo "❌ Errore durante l'installazione delle dipendenze"
    exit 1
fi

echo ""
echo "🎉 Installazione completata!"
echo ""
echo "Per avviare il widget:"
echo "  npm start"
echo ""
echo "Altri comandi utili:"
echo "  npm run dev      - Avvia in modalità sviluppo"
echo "  npm run build    - Crea build per distribuzione"
echo ""
echo "Scorciatoie da tastiera:"
echo "  Cmd/Ctrl + N    - Note rapide"
echo "  Cmd/Ctrl + Q    - Chiudi widget"
echo "  Cmd/Ctrl + H    - Minimizza widget"
echo ""
echo "Il widget sarà posizionato in alto a destra e sarà sempre visibile!"
echo "Puoi trascinarlo in qualsiasi posizione sul desktop."
echo ""
echo "Per maggiori informazioni, leggi il file README.md"