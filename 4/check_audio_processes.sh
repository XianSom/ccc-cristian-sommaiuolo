#!/bin/bash

echo "🔍 Controllo processi audio dopo chiusura app..."

# Verifica processi Electron della nostra app
echo "📱 Processi Electron performance-monitor:"
ps aux | grep -i "performance-monitor" | grep -v grep || echo "Nessuno trovato"

echo ""

# Verifica processi audio generali
echo "🔊 Processi audio attivi:"
ps aux | grep -E "(Audio|audio|coreaudio)" | grep -v grep | head -5

echo ""

# Se vuoi killare eventuali processi rimasti della nostra app:
echo "🧹 Per pulire eventuali processi rimasti, usa:"
echo "pkill -f 'performance-monitor'"