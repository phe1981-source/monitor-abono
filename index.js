// index.js
const puppeteer = require('puppeteer');
const express = require('express');
const { realizarLogin } = require('./auth');
const { generarHTML } = require('./interfaz');
const { extraerLinkCompra } = require('./extractor');

const app = express();
let listaLimpia = []; 
let linksDirectos = []; 
let totalEventosCartelera = 0;
let ultimaActualizacion = "Sin datos";
let horaProximaReal = "Calculando...";

async function iniciarMonitor() {
    console.log("🚀 [SISTEMA] Monitor Modular V3.7 Iniciado");
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    try {
        await realizarLogin(page); // Usamos el login de referencia

        while (true) {
            console.log(`📡 [SCAN] --- CICLO: ${new Date().toLocaleTimeString()} ---`);
            await page.goto('https://compras.abonoteatro.com/teatro/', { waitUntil: 'domcontentloaded', timeout: 90000 });
            await new Promise(r => setTimeout(r, 20000)); 

            const frameElement = await page.$('iframe');
            const frame = frameElement ? await frameElement.contentFrame() : null;

            if (!frame || frame.isDetached()) continue;

            const nombresActuales = await frame.evaluate(() => {
                const els = Array.from(document.querySelectorAll('.tribe-events-list-event-title a, h3 a, .tribe-events-calendar-list__event-title a'));
                const opts = Array.from(document.querySelectorAll('#select_recinto_event option')).filter(o => o.innerText && !o.innerText.includes('--'));
                return [...new Set([...els.map(e=>e.innerText.trim()), ...opts.map(o=>o.innerText.trim())])].filter(n => n.length > 2);
            }).catch(() => []);

            totalEventosCartelera = nombresActuales.length;
            const oraSincro = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

            if (listaLimpia.length > 0) {
                const detectadosAhora = nombresActuales.filter(n => !listaLimpia.includes(n));
                for (const nombre of detectadosAhora) {
                    const item = { nombre, hora: oraSincro, nuevo: true, url: 'https://compras.abonoteatro.com/teatro/' };
                    linksDirectos.unshift(item);
                    try {
                        const linkInfo = await extraerLinkCompra(browser, page, frame, nombre);
                        if (linkInfo.exito) item.url = linkInfo.url;
                    } catch (err) { console.log(`❌ Error extractor: ${nombre}`); }
                }
            }
            
            listaLimpia = [...nombresActuales];
            ultimaActualizacion = oraSincro;

            const espera = Math.floor(Math.random() * (240 - 180 + 1) + 180);
            horaProximaReal = new Date(Date.now() + (espera * 1000)).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
            await new Promise(r => setTimeout(r, espera * 1000));
        }
    } catch (e) { 
        console.error("❌ Error:", e.message);
        if (browser) await browser.close();
        setTimeout(iniciarMonitor, 30000); 
    }
}

app.get('/', (req, res) => res.send(generarHTML(linksDirectos, totalEventosCartelera, ultimaActualizacion, horaProximaReal)));
app.get('/test-alarma', (req, res) => {
    linksDirectos.unshift({ nombre: "Simulacro OK", hora: new Date().toLocaleTimeString(), nuevo: true, url: '#' });
    res.send("OK");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Servidor en puerto ${PORT}`);
    iniciarMonitor();
});