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

async function iniciarMonitor() {
    console.log("🚀 [SISTEMA] Monitor V3.6 - Sonido Inteligente + Trazabilidad");
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    try {
        await page.goto('https://compras.abonoteatro.com/login/', { waitUntil: 'networkidle2' });
        await page.type('#nabonadologin', USER);
        await page.type('#contrasenalogin', PASS);
        await Promise.all([page.click('input[value="Entrar"]'), page.waitForNavigation()]);

        while (true) {
            await page.goto('https://compras.abonoteatro.com/teatro/', { waitUntil: 'domcontentloaded' });
            await new Promise(r => setTimeout(r, 20000)); 

            const frameElement = await page.$('iframe');
            if (frameElement) {
                const frame = await frameElement.contentFrame();
                const nombresActuales = await frame.evaluate(() => {
                    const visuales = Array.from(document.querySelectorAll('.tribe-events-list-event-title a, h3 a')).map(el => el.innerText.trim());
                    return [...new Set(visuales)].filter(n => n.length > 2);
                });

                totalEventosCartelera = nombresActuales.length;
                const oraSincro = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

                if (listaLimpia.length > 0) {
                    const detectadosAhora = nombresActuales.filter(n => !listaLimpia.includes(n));
                    
                    for (const nombre of detectadosAhora) {
                        // REGISTRO INMEDIATO (No bloqueante)
                        const item = { nombre, hora: oraSincro, nuevo: true, url: 'https://compras.abonoteatro.com/teatro/' };
                        linksDirectos.unshift(item);
                        
                        // INTENTO DE EXTRACCIÓN (Secundario)
                        const linkInfo = await extraerLinkCompra(browser, page, frame, nombre);
                        if (linkInfo.exito) item.url = linkInfo.url;
                    }
                }
                listaLimpia = [...nombresActuales];
                ultimaActualizacion = oraSincro;
            }
            const espera = Math.floor(Math.random() * (240 - 180 + 1) + 180);
            horaProximaReal = new Date(Date.now() + (espera * 1000)).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
            await new Promise(r => setTimeout(r, espera * 1000));
        }
    } catch (e) { setTimeout(iniciarMonitor, 30000); }
}

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
            .btn-audio { width: 100%; padding: 12px; border-radius: 10px; border: none; font-weight: bold; cursor: pointer; background: #222; color: #888; }
            .btn-audio.active { background: #B9C800; color: #000; }
            .alert-main { font-size: 6em; font-weight: 900; color: #ff0033; margin: 0; }
            .link-card { display: block; background: #001a00; color: #00ff00; padding: 12px; border-radius: 10px; text-decoration: none; margin-top: 8px; border: 1px solid #003300; text-align: left; font-size: 0.9em; }
            .hora { color: #555; float: right; font-size: 0.8em; }
        </style>
    </head>
    <body>
        <button id="btnAudio" class="btn-audio" onclick="toggleAudio()">🔇 AUDIO DESACTIVADO</button>
        <div class="card">
            <div style="color:#555; font-size:0.7em; letter-spacing:2px;">ALERTAS ACTIVAS</div>
            <div class="alert-main">${linksDirectos.filter(l => l.nuevo).length}</div>
            <div style="display:flex; justify-content:space-around; margin-top:15px; color:#B9C800; font-weight:bold;">
                <div>Obras: ${totalEventosCartelera}</div>
                <div style="color:#eee">Sincro: ${ultimaActualizacion}</div>
            </div>
        </div>
        <div style="text-align:left;">
            <h3 style="color:#555; font-size:0.8em;">🚀 HISTORIAL Y LINKS PATA NEGRA</h3>
            ${linksDirectos.map(l => `<a href="${l.url}" target="_blank" class="link-card">🎯 ${l.nombre} <span class="hora">${l.hora}</span></a>`).join('')}
        </div>
        <script>
            let audioEnabled = sessionStorage.getItem('audioActive') === 'true';
            const btn = document.getElementById('btnAudio');
            
            // Lógica para que el BIP solo suene UNA VEZ por evento nuevo
            let ultimoEventoAudio = localStorage.getItem('ultimoEventoAudio');
            let eventoActual = "${linksDirectos.length > 0 ? linksDirectos[0].nombre : ''}";

            function toggleAudio() {
                audioEnabled = !audioEnabled;
                sessionStorage.setItem('audioActive', audioEnabled);
                btn.innerText = audioEnabled ? '🔊 ALERTAS ACTIVAS' : '🔇 AUDIO DESACTIVADO';
                btn.className = audioEnabled ? 'btn-audio active' : 'btn-audio';
            }

            function playSound() {
                const ctx = new (window.AudioContext || window.webkitAudioContext)();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain); gain.connect(ctx.destination);
                osc.frequency.value = 880;
                gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1);
                osc.start(); osc.stop(ctx.currentTime + 1);
            }

            if (audioEnabled) {
                btn.innerText = '🔊 ALERTAS ACTIVAS'; btn.className = 'btn-audio active';
                if (${hayNovedad} && eventoActual !== ultimoEventoAudio) {
                    playSound();
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
app.listen(PORT, '0.0.0.0', () => iniciarMonitor());
