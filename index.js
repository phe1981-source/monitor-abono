const puppeteer = require('puppeteer');
const express = require('express');
const { realizarLogin } = require('./auth');
const { extraerLinkCompra } = require('./extractor');
const { enviarNotificacion } = require('./notificaciones');

const app = express();
let listaLimpia = []; 

app.get('/', (req, res) => res.send('OK'));

app.get('/test-deteccion', (req, res) => {
    if (listaLimpia.length > 0) {
        const eventoPrueba = listaLimpia[0];
        listaLimpia = listaLimpia.filter(nombre => nombre !== eventoPrueba);
        res.send(`✅ Simulacro: "${eventoPrueba}" se detectará como nuevo en el próximo ciclo activo.`);
    } else {
        res.send("❌ Espera al primer escaneo real.");
    }
});

async function iniciarMonitor() {
    console.log("🚀 [SISTEMA] Monitor V4.1 (Modo Nocturno Inteligente) Iniciado");
    await enviarNotificacion("✅ SISTEMA ONLINE");

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    await page.setRequestInterception(true);
    page.on('request', (req) => {
        if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) req.abort();
        else req.continue();
    });

    try {
        await realizarLogin(page);

        while (true) {
            const ahora = new Date();
            const ahoraES = new Date(ahora.toLocaleString("en-US", {timeZone: "Europe/Madrid"}));
            const hora = ahoraES.getHours();

            // LÓGICA DE ESCANEO SEGÚN HORA (23h a 06h descansa)
            if (hora >= 23 || hora < 6) {
                console.log(`🌙 [NOCHE] ${ahoraES.toLocaleTimeString()} - Suspendido para parecer humano.`);
            } else {
                console.log(`📡 [SCAN] --- CICLO: ${ahoraES.toLocaleTimeString()} ---`);
                try {
                    await page.goto('https://compras.abonoteatro.com/teatro/', { waitUntil: 'domcontentloaded', timeout: 90000 });
                    await new Promise(r => setTimeout(r, 15000)); 

                    const frameElement = await page.$('iframe');
                    const frame = frameElement ? await frameElement.contentFrame() : null;

                    if (frame && !frame.isDetached()) {
                        const nombresActuales = await frame.evaluate(() => {
                            const els = Array.from(document.querySelectorAll('.tribe-events-list-event-title a, h3 a, .tribe-events-calendar-list__event-title a'));
                            const opts = Array.from(document.querySelectorAll('#select_recinto_event option')).filter(o => o.innerText && !o.innerText.includes('--'));
                            return [...new Set([...els.map(e=>e.innerText.trim()), ...opts.map(o=>o.innerText.trim())])].filter(n => n.length > 2);
                        }).catch(() => []);

                        if (listaLimpia.length > 0) {
                            const detectadosAhora = nombresActuales.filter(n => !listaLimpia.includes(n));
                            for (const nombre of detectadosAhora) {
                                try {
                                    const linkInfo = await extraerLinkCompra(browser, page, frame, nombre);
                                    if (linkInfo.exito) {
                                        await enviarNotificacion(linkInfo.mensajeFormateado);
                                    } else {
                                        await enviarNotificacion(`${nombre}\n🏛️ Revisa en la web\n🔗 https://compras.abonoteatro.com/teatro/`);
                                    }
                                } catch (err) {
                                    console.log(`❌ Error extractor: ${nombre}`);
                                }
                            }
                        }
                        listaLimpia = [...nombresActuales];
                    }
                } catch (err) {
                    console.log("⚠️ Error en ciclo:", err.message);
                }
            }

            // ESPERA ALEATORIA (60-180s) - Siempre activa para que el proceso no muera
            const espera = Math.floor(Math.random() * (180 - 60 + 1) + 60);
            console.log(`⏱️ Próximo paso en ${espera} segundos.`);
            await new Promise(r => setTimeout(r, espera * 1000));
        }
    } catch (e) {
        console.error("❌ Error Crítico:", e.message);
        if (browser) await browser.close();
        setTimeout(iniciarMonitor, 30000); 
    }
}

function programarReinicio() {
    const calcularMs = () => {
        const ahora = new Date();
        const ahoraES = new Date(ahora.toLocaleString("en-US", {timeZone: "Europe/Madrid"}));
        let target = new Date(ahoraES);
        target.setHours(6, 0, 0, 0);
        if (ahoraES >= target) target.setDate(target.getDate() + 1);
        return target - ahoraES;
    };
    setTimeout(() => {
        console.log("🕒 [SISTEMA] Reinicio preventivo (06:00 AM).");
        process.exit(0);
    }, calcularMs());
}

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Servidor activo en puerto ${PORT}`);
    iniciarMonitor();
    programarReinicio();
});
