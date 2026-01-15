const puppeteer = require('puppeteer');
const express = require('express');
const { extraerLinkCompra } = require('./extractor');
const app = express();

const USER = 'phe1981@gmail.com';
const PASS = process.env.ABONO_PASS;

let listaLimpia = []; 
let linksDirectos = []; 
let totalEventosCartelera = 0;
let ultimaActualizacion = "Sin datos";
let horaProximaReal = "Calculando...";
let logEstado = "Iniciando...";

async function iniciarMonitor() {
    console.log("🚀 [SISTEMA] Monitor V3.6 - Sonido Inteligente + Trazabilidad");
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    try {
        console.log("🔑 [VERBOSE] Accediendo a Login...");
        await page.goto('https://compras.abonoteatro.com/login/', { waitUntil: 'networkidle2' });
        await page.type('#nabonadologin', USER);
        await page.type('#contrasenalogin', PASS);
        await Promise.all([page.click('input[value="Entrar"]'), page.waitForNavigation()]);
        console.log("✅ [VERBOSE] Login Correcto.");

        while (true) {
            console.log(`📡 [SCAN] --- INICIO CICLO: ${new Date().toLocaleTimeString()} ---`);
            await page.goto('https://compras.abonoteatro.com/teatro/', { waitUntil: 'domcontentloaded' });
            
            console.log("⏱️ [VERBOSE] Esperando 20s para estabilidad de servidor lento...");
            await new Promise(r => setTimeout(r, 20000)); 

            const frameElement = await page.$('iframe');
            const frame = frameElement ? await frameElement.contentFrame() : null;

            if (!frame || frame.isDetached()) {
                console.log("⚠️ [ALERTA] Frame no detectado o descolgado. Reintentando...");
                continue; 
            }

            console.log("🔍 [VERBOSE] Extrayendo eventos visuales y desplegables...");
            const nombresActuales = await frame.evaluate(() => {
                const visuales = Array.from(document.querySelectorAll('.tribe-events-list-event-title a, h3 a'))
                                      .map(el => el.innerText.trim());
                const select = Array.from(document.querySelectorAll('#select_recinto_event option'))
                                    .map(el => el.innerText.trim())
                                    .filter(n => n && !n.includes('--'));
                return [...new Set([...visuales, ...select])].filter(n => n.length > 2);
            }).catch(() => []);

            totalEventosCartelera = nombresActuales.length;
            const oraSincro = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

            if (listaLimpia.length > 0) {
                const detectadosAhora = nombresActuales.filter(n => !listaLimpia.includes(n));
                
                if(detectadosAhora.length > 0) {
                    console.log(`🔔 [DETECCION] ${detectadosAhora.length} novedades encontradas!`);
                    for (const nombre of detectadosAhora) {
                        const item = { nombre, hora: oraSincro, nuevo: true, url: 'https://compras.abonoteatro.com/teatro/' };
                        linksDirectos.unshift(item);
                        
                        // PRIORIDAD BAJA: Si el extractor falla, no detiene el ciclo
                        console.log(`🧪 [EXTRACTOR] Buscando link para: ${nombre}`);
                        try {
                            const linkInfo = await extraerLinkCompra(browser, page, frame, nombre);
                            if (linkInfo.exito) item.url = linkInfo.url;
                        } catch (err) { console.log(`❌ [VERBOSE] Error extractor en ${nombre}`); }
                    }
                }
            } else {
                console.log(`📦 [SISTEMA] Carga inicial: ${totalEventosCartelera} obras en memoria.`);
            }
            
            listaLimpia = [...nombresActuales];
            ultimaActualizacion = oraSincro;

            const espera = Math.floor(Math.random() * (240 - 180 + 1) + 180);
            horaProximaReal = new Date(Date.now() + (espera * 1000)).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
            console.log(`😴 [VERBOSE] Fin ciclo. Próximo en ${Math.floor(espera/60)} min (${horaProximaReal})`);
            await new Promise(r => setTimeout(r, espera * 1000));
        }
    } catch (e) { 
        console.error("❌ [CRITICAL] Error en monitor:", e.message);
        if (browser) await browser.close();
        setTimeout(iniciarMonitor, 30000); 
    }
}

// SIMULACRO
app.get('/test-alarma', (req, res) => {
    const item = { nombre: "Simulacro " + Math.floor(Math.random()*99), hora: new Date().toLocaleTimeString(), nuevo: true, url: '#' };
    linksDirectos.unshift(item);
    res.send("OK");
});

app.get('/', (req, res) => {
    const hayNovedad = linksDirectos.some(l => l.nuevo);
    res.send(`
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
            ${linksDirectos.map(l => `<a href="${l.url}" target="_blank" class="link-card">🎯 ${l.nombre} <span class="hora">${l.hora}</span></a>`).join('') || '<p style="color:#222; text-align:center;">Esperando novedades...</p>'}
        </div>

        <script>
            let audioEnabled = sessionStorage.getItem('audioActive') === 'true';
            const btn = document.getElementById('btnAudio');
            
            function toggleAudio() {
                audioEnabled = !audioEnabled;
                sessionStorage.setItem('audioActive', audioEnabled);
                updateUI();
                if(audioEnabled) playSound(440); // Modalidad Test
            }

            function updateUI() {
                btn.innerText = audioEnabled ? '🔊 SONIDO MONITOR ACTIVO' : '🔇 ACTIVAR SONIDO INTELIGENTE';
                btn.className = audioEnabled ? 'btn-audio active' : 'btn-audio';
            }

            function playSound(freq) {
                const ctx = new (window.AudioContext || window.webkitAudioContext)();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain); gain.connect(ctx.destination);
                osc.frequency.value = freq;
                gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.5);
                osc.start(); osc.stop(ctx.currentTime + 1.5);
            }

            // Lógica de disparo único
            let ultimoEventoAudio = localStorage.getItem('ultimoEventoAudio');
            let hayNuevos = ${hayNovedad};
            let eventoActual = "${linksDirectos.length > 0 ? linksDirectos[0].nombre : ''}";

            if (audioEnabled) {
                updateUI();
                // Modalidad Alerta (Tono agudo 880Hz)
                if (hayNuevos && eventoActual !== ultimoEventoAudio) {
                    playSound(880);
                    localStorage.setItem('ultimoEventoAudio', eventoActual);
                }
            }

            setTimeout(() => location.reload(), 60000);
        </script>
    </body>
    </html>
    `);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 [SISTEMA] Interfaz lista en puerto ${PORT}`);
    iniciarMonitor();
});
