// interfaz.js
function generarHTML(linksDirectos, totalEventosCartelera, ultimaActualizacion, horaProximaReal) {
    const hayNovedad = linksDirectos.some(l => l.nuevo);
    return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { background: #050505; color: #eee; font-family: sans-serif; text-align: center; padding: 15px; }
            .card { background: #0a0a0a; border-radius: 20px; border: 1px solid #222; padding: 20px; margin-bottom: 15px; }
            .btn-audio { width: 100%; padding: 15px; border-radius: 12px; border: none; font-weight: bold; cursor: pointer; background: #222; color: #888; margin-bottom: 10px; }
            .btn-audio.active { background: #B9C800; color: #000; box-shadow: 0 0 15px rgba(185,200,0,0.2); }
            .alert-main { font-size: 7em; font-weight: 900; color: #ff0033; margin: 0; line-height: 1; }
            .link-card { display: block; background: #001a00; color: #00ff00; padding: 12px; border-radius: 10px; text-decoration: none; margin-top: 8px; border: 1px solid #003300; text-align: left; font-size: 0.9em; }
            .hora { color: #555; float: right; font-size: 0.8em; }
            .info-grid { display: flex; justify-content: space-around; margin-top: 20px; font-size: 0.8em; border-top: 1px solid #111; padding-top: 15px; }
        </style>
    </head>
    <body>
        <button id="btnAudio" class="btn-audio" onclick="toggleAudio()">🔇 ACTIVAR SONIDO INTELIGENTE</button>
        <div class="card">
            <div style="color:#555; font-size:0.7em; letter-spacing:2px;">ALARMAS DETECTADAS</div>
            <div class="alert-main">${linksDirectos.filter(l => l.nuevo).length}</div>
            <div class="info-grid">
                <div><div style="color:#555">EVENTOS</div><div style="color:#B9C800">${totalEventosCartelera}</div></div>
                <div><div style="color:#555">SINCRO</div><div>${ultimaActualizacion}</div></div>
                <div><div style="color:#555">SIGUIENTE</div><div style="color:#00ff00">${horaProximaReal}</div></div>
            </div>
        </div>
        <div style="text-align:left;">
            <h3 style="color:#555; font-size:0.8em; margin-left:10px;">🚀 HISTORIAL DE NOVEDADES</h3>
            ${linksDirectos.map(l => `<a href="${l.url}" target="_blank" class="link-card">🎯 ${l.nombre} <span class="hora">${l.hora}</span></a>`).join('') || '<p style="color:#222; text-align:center;">Vigilando...</p>'}
        </div>
        <script>
            let audioEnabled = sessionStorage.getItem('audioActive') === 'true';
            const btn = document.getElementById('btnAudio');
            function toggleAudio() {
                audioEnabled = !audioEnabled;
                sessionStorage.setItem('audioActive', audioEnabled);
                updateUI();
                if(audioEnabled) playSound(440);
            }
            function updateUI() {
                btn.innerText = audioEnabled ? '🔊 SONIDO MONITOR ACTIVO' : '🔇 ACTIVAR SONIDO INTELIGENTE';
                btn.className = audioEnabled ? 'btn-audio active' : 'btn-audio';
            }
            function playSound(freq) {
                try {
                    const ctx = new (window.AudioContext || window.webkitAudioContext)();
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.connect(gain); gain.connect(ctx.destination);
                    osc.frequency.value = freq;
                    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.5);
                    osc.start(); osc.stop(ctx.currentTime + 1.5);
                } catch(e) {}
            }
            let ultimoEventoAudio = localStorage.getItem('ultimoEventoAudio');
            let hayNuevos = ${hayNovedad};
            let eventoActual = "${linksDirectos.length > 0 ? linksDirectos[0].nombre : ''}";
            if (audioEnabled) {
                updateUI();
                if (hayNuevos && eventoActual !== ultimoEventoAudio) {
                    playSound(880);
                    localStorage.setItem('ultimoEventoAudio', eventoActual);
                }
            }
            setTimeout(() => location.reload(), 60000);
        </script>
    </body>
    </html>
    `;
}

module.exports = { generarHTML };