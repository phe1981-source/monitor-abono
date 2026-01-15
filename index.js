const puppeteer = require('puppeteer');
const express = require('express');
const { extraerLinkCompra } = require('./extractor'); 
const app = express();

const USER = 'phe1981@gmail.com';
const PASS = process.env.ABONO_PASS;

let listaLimpia = []; 
let historialNovedades = []; 
let linksDirectos = []; 
let totalEventosCartelera = 0;
let ultimaActualizacion = "Iniciando...";
let horaProximaReal = "Calculando...";

function obtenerEsperaAleatoria(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

async function iniciarMonitor() {
    console.log("🚀 [SISTEMA] Arrancando con prioridad en Alertas...");
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    try {
        console.log("🔑 [LOGIN] Accediendo...");
        await page.goto('https://compras.abonoteatro.com/login/', { waitUntil: 'networkidle2' });
        await page.type('#nabonadologin', USER);
        await page.type('#contrasenalogin', PASS);
        await Promise.all([
            page.click('input[value="Entrar"].buyBtn'),
            page.waitForNavigation({ waitUntil: 'networkidle2' })
        ]);

        while (true) {
            console.log(`\n📡 [SCAN] --- CICLO: ${new Date().toLocaleTimeString()} ---`);
            await page.goto('https://compras.abonoteatro.com/teatro/', { waitUntil: 'domcontentloaded' });
            await new Promise(r => setTimeout(r, 20000)); 

            const frameElement = await page.$('iframe');
            if (frameElement) {
                const frame = await frameElement.contentFrame();
                const nombresActuales = await frame.evaluate(() => {
                    const visuales = Array.from(document.querySelectorAll('.tribe-events-list-event-title a, h3 a'))
                        .map(el => el.innerText.trim());
                    return [...new Set(visuales)].filter(n => n.length > 2);
                });

                totalEventosCartelera = nombresActuales.length;

                if (listaLimpia.length > 0) {
                    for (const nombre of nombresActuales) {
                        if (!listaLimpia.includes(nombre)) {
                            const infoLink = await extraerLinkCompra(browser, page, frame, nombre);
                            const item = { nombre, hora: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }), nuevo: true };
                            historialNovedades.unshift(item);
                            if (infoLink) linksDirectos.unshift({ ...item, url: infoLink.url });
                        }
                    }
                }
                listaLimpia = [...nombresActuales];
                ultimaActualizacion = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
            }

            const espera = obtenerEsperaAleatoria(120, 240);
            horaProximaReal = new Date(Date.now() + (espera * 1000)).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
            await new Promise(r => setTimeout(r, espera * 1000));
        }
    } catch (error) {
        console.error("❌ ERROR:", error.message);
        setTimeout(iniciarMonitor, 30000);
    }
}

iniciarMonitor();

app.get('/', (req, res) => {
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
            .card { background: #0a0a0a; border-radius: 25px; border: 1px solid #222; padding: 25px; margin-bottom: 15px; }
            .alert-main { font-size: 8em; font-weight: 900; color: #ff0033; line-height: 1; margin: 5px 0; }
            .label { color: #555; text-transform: uppercase; font-size: 0.75em; letter-spacing: 2px; }
            .pulso-box { display: flex; justify-content: space-around; background: #111; padding: 15px; border-radius: 15px; margin-top: 20px; border: 1px solid #222; }
            .pulso-val { font-size: 1.8em; font-weight: bold; color: #B9C800; }
            .link-card { display: block; background: #002200; color: #00ff00; padding: 15px; border-radius: 12px; text-decoration: none; margin-top: 10px; border: 1px solid #004400; font-weight: bold; }
            .status { font-size: 0.8em; color: #444; margin-top: 10px; }
        </style>
    </head>
    <body>
        <div class="container">
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
                        <div class="pulso-val" style="color:#fff; font-size:1.2em; margin-top:5px;">${ultimaActualizacion}</div>
                    </div>
                </div>
            </div>

            <div style="text-align:left;">
                <h3 class="label" style="margin-left:10px;">🚀 Links Pata Negra</h3>
                ${linksDirectos.map(l => `<a href="${l.url}" target="_blank" class="link-card">🎯 ${l.nombre}</a>`).join('') || '<p style="color:#222; text-align:center;">Vigilando...</p>'}
            </div>
            
            <div class="status">Próximo escaneo: <span style="color:#00ff00">${horaProximaReal}</span></div>
        </div>
        <script>setTimeout(() => location.reload(), 60000);</script>
    </body>
    </html>
    `);
});

app.listen(10000, '0.0.0.0');
