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
    const totalAlertas = historialNovedades.length;
    
    // Logica del badge 5(+1) o (0)
    let badgeExtra = "";
    if (novedadesUltimaLectura > 0) {
        badgeExtra = `<span style="color:#00ff00; font-size:0.4em; vertical-align:middle; margin-left:10px;">(+${novedadesUltimaLectura})</span>`;
    } else {
        badgeExtra = `<span style="color:#444; font-size:0.4em; vertical-align:middle; margin-left:10px;">(0)</span>`;
    }

    res.send(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Monitor Abono</title>
        <style>
            body { background: #050505; color: #eee; font-family: -apple-system, BlinkMacSystemFont, sans-serif; text-align: center; padding: 15px; margin: 0; }
            .container { max-width: 500px; margin: auto; }
            .card { background: #0a0a0a; border-radius: 30px; border: 1px solid #151515; padding: 30px; margin-bottom: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
            .alert-main { font-size: 7.5em; font-weight: 900; color: #ff0033; line-height: 1; margin: 10px 0; letter-spacing: -5px; }
            .label { color: #555; text-transform: uppercase; font-size: 0.7em; letter-spacing: 2px; font-weight: bold; }
            .pulso-box { display: flex; justify-content: space-around; background: #111; padding: 20px; border-radius: 20px; margin-top: 25px; border: 1px solid #1a1a1a; }
            .pulso-val { font-size: 1.8em; font-weight: bold; color: #B9C800; }
            .link-card { display: block; background: #001a00; color: #00ff00; padding: 18px; border-radius: 15px; text-decoration: none; margin-top: 12px; border: 1px solid #003300; font-weight: bold; transition: 0.3s; }
            .link-card:active { transform: scale(0.98); background: #002500; }
            .status { font-size: 0.8em; color: #333; margin-top: 20px; }
            .dot { height: 8px; width: 8px; background-color: #ff0033; border-radius: 50%; display: inline-block; margin-right: 5px; animation: blink 1s infinite; }
            @keyframes blink { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="card">
                <div class="label"><span class="dot"></span>Live Alertas (12h)</div>
                <div class="alert-main">${totalAlertas}${badgeExtra}</div>
                
                <div class="pulso-box">
                    <div>
                        <div class="label" style="font-size:0.55em">Cartelera</div>
                        <div class="pulso-val">${totalEventosCartelera}</div>
                    </div>
                    <div>
                        <div class="label" style="font-size:0.55em">Sincro</div>
                        <div class="pulso-val" style="color:#fff; font-size:1.3em; margin-top:4px;">${ultimaActualizacion}</div>
                    </div>
                </div>
                <div style="margin-top:15px; font-size:0.7em; color:#222;">Sistema: ${logEstado}</div>
            </div>

            <div style="text-align:left;">
                <h3 class="label" style="margin-left:15px; margin-bottom:10px;">🚀 Links Pata Negra</h3>
                ${linksDirectos.map(l => `<a href="${l.url}" target="_blank" class="link-card">🎯 ${l.nombre} <span style="float:right; font-size:0.7em; opacity:0.5;">${l.hora}</span></a>`).join('') || '<p style="color:#111; text-align:center; margin-top:20px;">Vigilando el teatro...</p>'}
            </div>
            
            <div class="status">Próximo escaneo: <span style="color:#444">${horaProximaReal}</span></div>
        </div>
        <script>
            // Refresh automatico ogni 60 secondi
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
