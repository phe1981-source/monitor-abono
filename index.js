const puppeteer = require('puppeteer');
const express = require('express');
const { realizarLogin } = require('./auth');
const { extraerLinkCompra } = require('./extractor');
const { enviarNotificacion } = require('./notificaciones');

const app = express();

let listaLimpia = []; 

// 7. Servidor Ultra-Ligero: Solo responde "OK" para Keep-Alive en Render
app.get('/', (req, res) => {
    res.send('OK');
});

// RUTA DE TEST: Simula que un evento es nuevo
app.get('/test-deteccion', (req, res) => {
    if (listaLimpia.length > 0) {
        // Guardamos el nombre del primero para el log
        const eventoPrueba = listaLimpia[0];
        
        // Lo eliminamos de la lista actual (el bot pensará que ha desaparecido y vuelto a aparecer)
        listaLimpia = listaLimpia.filter(nombre => nombre !== eventoPrueba);
        
        console.log(`🧪 [TEST] Simulacro iniciado: He borrado "${eventoPrueba}" de la memoria.`);
        res.send(`✅ Simulacro iniciado. En el próximo escaneo (en 60-120s), el bot detectará "${eventoPrueba}" como un evento nuevo y te enviará el Telegram.`);
    } else {
        res.send("❌ La lista todavía está vacía. Espera a que el bot haga el primer escaneo real.");
    }
});

async function iniciarMonitor() {
    console.log("🚀 [SISTEMA] Monitor Modular V4.0 (RAM Optimized) Iniciado");
    
    // 3. Notificación de "Vida" (Heartbeat): Enviamos pulso al arrancar
    await enviarNotificacion("✅ SISTEMA OK");

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // 1. Blindaje de Memoria RAM: Bloqueamos imágenes, CSS y fuentes para ahorrar recursos
    await page.setRequestInterception(true);
    page.on('request', (req) => {
        if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
            req.abort();
        } else {
            req.continue();
        }
    });

    try {
        await realizarLogin(page);

        while (true) {
            console.log(`📡 [SCAN] --- CICLO: ${new Date().toLocaleTimeString()} ---`);
            await page.goto('https://compras.abonoteatro.com/teatro/', { waitUntil: 'domcontentloaded', timeout: 90000 });
            await new Promise(r => setTimeout(r, 15000)); 

            const frameElement = await page.$('iframe');
            const frame = frameElement ? await frameElement.contentFrame() : null;

            if (!frame || frame.isDetached()) continue;

            const nombresActuales = await frame.evaluate(() => {
                const els = Array.from(document.querySelectorAll('.tribe-events-list-event-title a, h3 a, .tribe-events-calendar-list__event-title a'));
                const opts = Array.from(document.querySelectorAll('#select_recinto_event option')).filter(o => o.innerText && !o.innerText.includes('--'));
                return [...new Set([...els.map(e=>e.innerText.trim()), ...opts.map(o=>o.innerText.trim())])].filter(n => n.length > 2);
            }).catch(() => []);

            if (listaLimpia.length > 0) {
                const detectadosAhora = nombresActuales.filter(n => !listaLimpia.includes(n));
                for (const nombre of detectadosAhora) {
                    try {
                        // 4 y 5. Inteligencia VIP y Mensajes Directos (Lógica en extractor.js)
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

// 6. Invisibilidad (Antiban): Espera aleatoria de 60-180 segundos (1 a 3 min)
            const espera = Math.floor(Math.random() * (180 - 60 + 1) + 60);
            console.log(`⏱️ Próximo escaneo en ${espera} segundos.`);
            await new Promise(r => setTimeout(r, espera * 1000));
        }
    } catch (e) { 
        console.error("❌ Error:", e.message);
        if (browser) await browser.close();
        setTimeout(iniciarMonitor, 30000); 
    }
}

// 2. Autolimpieza Diaria (Mantenimiento): Reinicio a las 06:00 AM (España)
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
        console.log("🕒 [SISTEMA] Reinicio preventivo (06:00 AM). Cerrando proceso...");
        process.exit(0);
    }, calcularMs());
}

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Servidor activo en puerto ${PORT}`);
    iniciarMonitor();
    programarReinicio();
});
