const puppeteer = require('puppeteer');
const express = require('express');
const { extraerLinkCompra } = require('./extractor'); 
const app = express();

// Variables de Estado
let historialNovedades = []; 
let linksDirectos = []; 
let totalEventosCartelera = 0; // INDICADOR DE PULSO
let ultimaActualizacion = "Iniciando...";
let proximoEscaneo = "Calculando...";
let horaProximaReal = "Calculando...";

function obtenerEsperaAleatoria(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

// --- RUTA DE TEST ---
app.get('/test-alarma', (req, res) => {
    console.log("[SISTEMA] 🚨 Forzando alarma de prueba...");
    const testItem = { 
        nombre: "TEST DE SISTEMA OK", 
        hora: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }), 
        nuevo: true 
    };
    historialNovedades.unshift(testItem);
    linksDirectos.unshift({ ...testItem, url: "https://google.com" });
    res.send("<script>alert('Alarma enviada al Dashboard'); window.location.href='/'</script>");
});

async function iniciarMonitor() {
    console.log("[SISTEMA] 🚀 Arrancando navegador...");
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    let listaPrevia = [];

    try {
        while (true) {
            console.log(`\n[SISTEMA] 🕒 --- NUEVO CICLO: ${new Date().toLocaleTimeString()} ---`);
            
            console.log("[SISTEMA] 🌐 Accediendo a cartelera...");
            await page.goto('https://compras.abonoteatro.com/teatro/', { waitUntil: 'networkidle2' });
            
            // Detectar Frame
            const frameElement = await page.$('iframe[src*="programacion"]');
            const frame = frameElement ? await frameElement.contentFrame() : page;

            // Extraer eventos actuales
            const nombresActuales = await frame.evaluate(() => {
                return Array.from(document.querySelectorAll('.tribe-events-list-event-title, h3'))
                            .map(el => el.innerText.trim())
                            .filter(txt => txt.length > 0);
            });

            totalEventosCartelera = nombresActuales.length;
            console.log(`[SISTEMA] 📊 Eventos totales detectados: ${totalEventosCartelera}`);

            // Lógica de Novedades
            for (let nombre of nombresActuales) {
                if (listaPrevia.length > 0 && !listaPrevia.includes(nombre)) {
                    console.log(`[SISTEMA] ✨ ¡NOVEDAD DETECTADA!: ${nombre}`);
                    const infoLink = await extraerLinkCompra(browser, page, frame, nombre);
                    
                    const item = { 
                        nombre, 
                        hora: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }), 
                        nuevo: true 
                    };
                    historialNovedades.unshift(item);
                    if (infoLink) linksDirectos.unshift({ ...item, url: infoLink.url });
                }
            }

            listaPrevia = [...nombresActuales];
            ultimaActualizacion = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

            // Tiempo de espera: 90s a 240s (4min)
            const espera = obtenerEsperaAleatoria(90, 240);
            const ahora = new Date();
            const proximaFecha = new Date(ahora.getTime() + (espera * 1000));
            
            horaProximaReal = proximaFecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
            proximoEscaneo = `${Math.floor(espera/60)}m ${espera%60}s`;

            console.log(`[SISTEMA] ✅ Ciclo finalizado. Espera: ${proximoEscaneo}. Próxima lectura: ${horaProximaReal}`);
            await new Promise(r => setTimeout(r, espera * 1000));
        }
    } catch (error) {
        console.error("[SISTEMA] 🔥 ERROR:", error.message);
        setTimeout(iniciarMonitor, 30000);
    }
}

iniciarMonitor();

// --- INTERFAZ DASHBOARD ---
app.get('/', (req, res) => {
    const hayNovedad = historialNovedades.some(h => h.nuevo);
    res.send(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { background: #050505; color: #eee; font-family: sans-serif; text-align: center; padding: 15px; margin: 0; }
            .container { max-width: 600px; margin: auto; }
            .main-counter { padding: 30px; background: #0a0a0a; border-radius: 20px; border: 1px solid #222; margin-bottom: 15px; }
            .pulso-val { font-size: 3.5em; color: #B9C800; font-weight: 900; margin: 10px 0; }
            .alert-val { font-size: 2em; font-weight: bold; color: #fff; }
            .status-bar { display: flex; gap: 8px; margin-bottom: 15px; }
            .status-item { background: #111; padding: 12px; border-radius: 10px; flex: 1; border: 1px solid #222; font-size: 0.8em; }
            .label { color: #555; text-transform: uppercase; font-size: 0.7em; letter-spacing: 1px; }
            .box { background: #0a0a0a; border: 1px solid #222; padding: 15px; border-radius: 15px; text-align: left; margin-bottom: 15px; }
            .link-card { display: block; background: #001a00; color: #00ff00; padding: 15px; border-radius: 10px; text-decoration: none; margin-bottom: 8px; border: 1px solid #004400; font-weight: bold; font-size: 0.9em; }
            .btn-audio { width: 100%; padding: 15px; border-radius: 10px; border: none; font-weight: bold; cursor: pointer; background: #222; color: #888; margin-bottom: 15px; }
        </style>
    </head>
    <body>
        <div class="container">
            <button id="btnAudio" class="btn-audio" onclick="toggleAudio()">🔇 AUDIO DESACTIVADO</button>

            <div class="main-counter">
                <div class="label">Eventos en Cartelera (Pulso)</div>
                <div class="pulso-val">${totalEventosCartelera}</div>
                <div class="label">Alertas Detectadas</div>
                <div class="alert-val">${historialNovedades.length} <span style="color:#ff0033">(+${historialNovedades.filter(h => h.nuevo).length})</span></div>
            </div>

            <div class="status-bar">
                <div class="status-item"><div class="label">Última</div><div style="font-weight:bold">${ultimaActualizacion}</div></div>
                <div class="status-item"><div class="label">Próxima</div><div style="color:#00ff00; font-weight:bold">${horaProximaReal}</div></div>
                <div class="status-item"><div class="label">Espera</div><div style="color:#B9C800; font-weight:bold">${proximoEscaneo}</div></div>
            </div>

            <div class="box">
                <h3 style="color:#444; font-size: 0.7em; margin-top:0;">🚀 PATA NEGRA (LINKS DIRECTOS)</h3>
                ${linksDirectos.map(l => `<a href="${l.url}" target="_blank" class="link-card">🎯 ${l.nombre}</a>`).join('') || '<p style="color:#333; font-size:0.8em;">Escaneando...</p>'}
            </div>
        </div>

        <script>
            let audioEnabled = sessionStorage.getItem('audio') === 'true';
            const btn = document.getElementById('btnAudio');
            function toggleAudio() {
                audioEnabled = !audioEnabled;
                sessionStorage.setItem('audio', audioEnabled);
                updateBtn();
            }
            function updateBtn() {
                btn.innerText = audioEnabled ? '🔊 AUDIO ACTIVO' : '🔇 AUDIO DESACTIVADO';
                btn.style.background = audioEnabled ? '#B9C800' : '#222';
                btn.style.color = audioEnabled ? '#000' : '#888';
            }
            if (${hayNovedad} && audioEnabled) {
                new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg').play().catch(()=>{});
            }
            updateBtn();
            setTimeout(() => location.reload(), 60000);
        </script>
    </body>
    </html>
    `);
});

app.listen(10000, '0.0.0.0');
