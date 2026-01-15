const puppeteer = require('puppeteer');
const express = require('express');
const app = express();

// Configurazione
const USER = 'phe1981@gmail.com';
const PASS = process.env.ABONO_PASS || 'fAsHaMp@gZie3g@';

// Variabili di stato
let listaLimpia = []; 
let historialNovedades = []; 
let linksDirectos = []; 
let totalEventosCartelera = 0;
let novedadesUltimaLectura = 0; // Per il (+1) o (0)
let ultimaActualizacion = "Sin datos";
let logEstado = "Iniciando...";
let horaProximaReal = "Calculando...";

function obtenerEsperaAleatoria(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

async function iniciarMonitor() {
    console.log("🚀 [SISTEMA] Avvio Monitor Ibrido V3.3 - Stabilità + Nuova UI");
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    try {
        logEstado = "Login...";
        console.log("🔑 [LOGIN] Accediendo a la página...");
        await page.goto('https://compras.abonoteatro.com/login/', { waitUntil: 'networkidle2', timeout: 90000 });
        
        // Accettazione cookie (dal vecchio codice)
        await page.evaluate(() => {
            const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Aceptar'));
            if (btn) btn.click();
        }).catch(() => {});

        console.log("📝 [LOGIN] Inserimento credenziali...");
        await page.type('#nabonadologin', USER);
        await page.type('#contrasenalogin', PASS);
        
        await Promise.all([
            page.click('input[value="Entrar"].buyBtn'),
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 90000 })
        ]);

        console.log("✅ [LOGIN] Successo.");

        while (true) {
            logEstado = "Scansione...";
            const oraAttuale = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            console.log(`\n📡 [SCAN] --- CICLO: ${oraAttuale} ---`);
            
            await page.goto('https://compras.abonoteatro.com/teatro/', { waitUntil: 'domcontentloaded', timeout: 90000 });
            
            // Attesa stabilità iframe (fondamentale per non leggere vuoto)
            console.log("⏱️ [SCAN] Attesa stabilità (20s)...");
            await new Promise(r => setTimeout(r, 20000)); 

            const frameElement = await page.$('iframe');
            if (frameElement) {
                const frame = await frameElement.contentFrame();
                const nombresActuales = await frame.evaluate(() => {
                    const visuales = Array.from(document.querySelectorAll('.tribe-events-list-event-title a, h3 a, .tribe-events-calendar-list__event-title a'))
                        .map(el => el.innerText.trim());
                    const opciones = Array.from(document.querySelectorAll('#select_recinto_event option'))
                        .map(el => el.innerText.trim())
                        .filter(n => n !== "" && n !== "-- Seleccione --");
                    return [...new Set([...visuales, ...opciones])].filter(n => n.length > 2);
                });

                totalEventosCartelera = nombresActuales.length;
                const oraSincro = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

                if (listaLimpia.length === 0) {
                    console.log("📦 [SISTEMA] Caricamento lista iniziale...");
                    listaLimpia = [...nombresActuales];
                    novedadesUltimaLectura = 0;
                } else {
                    const detectadosAhora = nombresActuales.filter(n => !listaLimpia.includes(n));
                    novedadesUltimaLectura = detectadosAhora.length;

                    if (novedadesUltimaLectura > 0) {
                        console.log(`🔔 [ALERTA] Rilevate ${novedadesUltimaLectura} novità!`);
                        for (const nombre of detectadosAhora) {
                            const item = { nombre, hora: oraSincro, nuevo: true };
                            historialNovedades.unshift(item);
                            // Link generico (l'estrattore andrebbe integrato qui come funzione esterna)
                            linksDirectos.unshift({ ...item, url: 'https://compras.abonoteatro.com/teatro/' });
                        }
                    }
                    listaLimpia = [...nombresActuales];
                }
                ultimaActualizacion = oraSincro;
            }

            const espera = obtenerEsperaAleatoria(180, 240);
            logEstado = `Pausa (${Math.floor(espera/60)}m)`;
            horaProximaReal = new Date(Date.now() + (espera * 1000)).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
            console.log(`😴 [DORMI] Prossimo invio: ${horaProximaReal}`);
            await new Promise(r => setTimeout(r, espera * 1000));
        }
    } catch (error) {
        console.error("❌ [ERRORE CRITICO]:", error.message);
        if (browser) await browser.close();
        setTimeout(iniciarMonitor, 30000); // Riavvio dopo 30s
    }
}

// --- SERVER EXPRESS ---

app.get('/', (req, res) => {
    const hayNovedad = historialNovedades.some(h => h.nuevo);
    const numAlertas = historialNovedades.length;
    
    res.send(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { background: #050505; color: #eee; font-family: sans-serif; text-align: center; padding: 15px; margin: 0; }
            .container { max-width: 500px; margin: auto; }
            .card { background: #0a0a0a; border-radius: 25px; border: 1px solid #222; padding: 25px; margin-bottom: 15px; position: relative; }
            
            /* Botón de Audio Estilo Toggle */
            .btn-audio { 
                width: 100%; padding: 12px; border-radius: 12px; border: none; font-weight: bold; 
                cursor: pointer; margin-bottom: 15px; transition: 0.3s;
                background: #222; color: #888;
            }
            .btn-audio.active { background: #B9C800; color: #000; box-shadow: 0 0 15px rgba(185, 200, 0, 0.3); }

            .alert-main { font-size: 8em; font-weight: 900; color: #ff0033; line-height: 1; margin: 5px 0; }
            .label { color: #555; text-transform: uppercase; font-size: 0.75em; letter-spacing: 2px; }
            .pulso-box { display: flex; justify-content: space-around; background: #111; padding: 15px; border-radius: 15px; margin-top: 20px; border: 1px solid #222; }
            .pulso-val { font-size: 1.8em; font-weight: bold; color: #B9C800; }
            .link-card { display: block; background: #002200; color: #00ff00; padding: 15px; border-radius: 12px; text-decoration: none; margin-top: 10px; border: 1px solid #004400; font-weight: bold; font-size: 0.9em; }
            .status { font-size: 0.8em; color: #444; margin-top: 15px; }
        </style>
    </head>
    <body>
        <div class="container">
            <button id="btnAudio" class="btn-audio" onclick="toggleAudio()">🔇 AUDIO DESACTIVADO</button>

            <div class="card">
                <div class="label">Alertas Detectadas</div>
                <div class="alert-main">${numAlertas}</div>
                
                <div class="pulso-box">
                    <div>
                        <div class="label" style="font-size:0.6em">Total Obras</div>
                        <div class="pulso-val">${totalEventosCartelera}</div>
                    </div>
                    <div>
                        <div class="label" style="font-size:0.6em">Sincro</div>
                        <div class="pulso-val" style="color:#fff; font-size:1.1em; margin-top:5px;">${ultimaActualizacion}</div>
                    </div>
                </div>
            </div>

            <div style="text-align:left;">
                <h3 class="label" style="margin-left:10px;">🚀 Links Pata Negra</h3>
                ${linksDirectos.map(l => `<a href="${l.url}" target="_blank" class="link-card">🎯 ${l.nombre}</a>`).join('') || '<p style="color:#222; text-align:center;">Vigilando...</p>'}
            </div>
            
            <div class="status">Próximo escaneo: <span style="color:#00ff00">${horaProximaReal}</span></div>
        </div>

        <script>
            let audioEnabled = sessionStorage.getItem('audioActive') === 'true';
            const btn = document.getElementById('btnAudio');

            function toggleAudio() {
                audioEnabled = !audioEnabled;
                sessionStorage.setItem('audioActive', audioEnabled);
                updateBtn();
                if(audioEnabled) playSound(true); // Test de confirmación
            }

            function updateBtn() {
                btn.innerText = audioEnabled ? '🔊 ALERTAS ACTIVAS' : '🔇 AUDIO DESACTIVADO';
                btn.className = audioEnabled ? 'btn-audio active' : 'btn-audio';
            }

            function playSound(isTest = false) {
                try {
                    const ctx = new (window.AudioContext || window.webkitAudioContext)();
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.connect(gain); gain.connect(ctx.destination);
                    osc.type = 'sine';
                    osc.frequency.value = isTest ? 440 : 880; // Más agudo para alerta real
                    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1);
                    osc.start(); osc.stop(ctx.currentTime + 1);
                } catch(e) {}
            }

            if (${hayNovedad} && audioEnabled) {
                playSound();
            }

            updateBtn();
            setTimeout(() => location.reload(), 60000);
        </script>
    </body>
    </html>
    `);
});

// ROUTE DI SIMULACRO
app.get('/test-alarma', (req, res) => {
    const nombreSimulado = "Simulacro: Opera " + Math.floor(Math.random() * 99);
    novedadesUltimaLectura = 1; 
    const item = { 
        nombre: nombreSimulado, 
        hora: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }), 
        nuevo: true 
    };
    historialNovedades.unshift(item);
    linksDirectos.unshift({ ...item, url: 'https://compras.abonoteatro.com/teatro/' });
    
    console.log("⚠️ [SIMULACRO] Triggered via URL");
    res.send(`<h1>Simulacro OK</h1><p>Añadido: ${nombreSimulado}</p><a href="/">Volver</a>`);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Server UI attivo sulla porta ${PORT}`);
});

iniciarMonitor();
