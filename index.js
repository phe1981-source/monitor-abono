const puppeteer = require('puppeteer');
const express = require('express');
const fs = require('fs');
const { captureUrl } = require('./extractor'); // Importamos la función
const app = express();

const USER = 'phe1981@gmail.com';
const PASS = process.env.ABONO_PASS || 'fAsHaMp@gZie3g@';

let listaLimpia = [], historialNovedades = [], linksDirectos = [];
let logEstado = "Iniciando...", ultimaActualizacion = "Sin datos";
let estaBuscandoURL = false;

async function iniciarMonitor() {
  console.log("🚀 Monitor Jules V5.0 - Arquitectura Separada");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
  });
  
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  try {
    logEstado = "Intentando Login...";
    await page.goto('https://compras.abonoteatro.com/login/', { waitUntil: 'domcontentloaded' });
    
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Aceptar'));
      if (btn) btn.click();
    }).catch(() => {});

    await page.type('#nabonadologin', USER);
    await page.type('#contrasenalogin', PASS);
    await Promise.all([
      page.click('input[value="Entrar"].buyBtn'),
      page.waitForNavigation({ waitUntil: 'domcontentloaded' })
    ]);

    console.log("✅ Login OK");

    while (true) {
      if (!estaBuscandoURL) {
        logEstado = "Escaneando...";
        await page.goto('https://compras.abonoteatro.com/teatro/', { waitUntil: 'domcontentloaded' });
        await new Promise(r => setTimeout(r, 20000)); 

        const frameElement = await page.$('iframe');
        if (frameElement) {
          const frame = await frameElement.contentFrame();
          const data = await frame.evaluate(() => {
            return Array.from(document.querySelectorAll('.tribe-events-list-event-title a')).map(el => el.innerText.trim());
          });

          if (data && data.length > 0) {
            const nombresActuales = [...new Set(data)];
            const ahora = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
            const detectados = nombresActuales.filter(n => !listaLimpia.includes(n));

            if (listaLimpia.length === 0) {
              listaLimpia = nombresActuales;
            } else if (detectados.length > 0) {
              historialNovedades.forEach(h => h.nuevo = false);
              
              for (const nombre of detectados) {
                // 1. MUST: Registrar novedad y activar alarma
                historialNovedades.unshift({ nombre, hora: ahora, nuevo: true });
                console.log(`🔔 ¡NUEVO EVENTO!: ${nombre}`);

                // 2. SHOULD: Intentar capturar link en segundo plano
                estaBuscandoURL = true;
                captureUrl(browser, page, nombre).then(url => {
                  if (url) {
                    linksDirectos.unshift({ nombre, url, hora: ahora });
                  }
                  estaBuscandoURL = false;
                });
              }
              listaLimpia = nombresActuales;
              ultimaActualizacion = ahora;
            }
          }
        }
      }
      const espera = Math.floor(Math.random() * (300 - 180 + 1) + 180);
      logEstado = `Espera ${Math.floor(espera/60)}m...`;
      await new Promise(r => setTimeout(r, espera * 1000)); 
    }
  } catch (error) {
    console.log("❌ Error monitor:", error.message);
    await browser.close();
    setTimeout(iniciarMonitor, 20000); 
  }
}

iniciarMonitor();

// INTERFAZ CON ALARMA SONORA
app.get('/', (req, res) => {
  const hayNovedad = historialNovedades.some(h => h.nuevo);
  res.send(`
    <body style="background:#000; color:#fff; font-family:sans-serif; padding:20px;">
      <div style="max-width:800px; margin:auto; background:#111; padding:30px; border-radius:20px; border:1px solid #333;">
        <div style="text-align:right;"><button id="btnS" onclick="tS()" style="background:#444; color:#fff; border:none; padding:10px; border-radius:8px; cursor:pointer;">Activar Sonido</button></div>
        <h1 style="text-align:center; font-size:4em; color:#B9C800; margin:10px 0;">${listaLimpia.length}</h1>
        <p style="text-align:center;">Estado: ${logEstado} | Sincro: ${ultimaActualizacion}</p>
        <div style="margin-top:30px;">
          <h3 style="color:#00ff00;">🚀 Links Directos</h3>
          ${linksDirectos.map(l => `<a href="${l.url}" target="_blank" style="display:block; color:#fff; background:#004d00; padding:15px; margin-bottom:10px; border-radius:10px; text-decoration:none; text-align:center; font-weight:bold; border:1px solid #00ff00;">${l.nombre}</a>`).join('') || '<p>Esperando links...</p>'}
        </div>
        <div style="margin-top:30px;">
          <h3 style="color:orange;">🔔 Historial</h3>
          ${historialNovedades.map(h => `<p style="${h.nuevo ? 'color:red; font-weight:bold;' : 'color:#888;'}">[${h.hora}] ${h.nombre}</p>`).join('')}
        </div>
      </div>
      <script>
        let sA = sessionStorage.getItem('sA') === 'true';
        let aC;
        function tS() { sA = !sA; sessionStorage.setItem('sA', sA); document.getElementById('btnS').innerText = sA ? '🔊 Activo' : '🔇 Inactivo'; if(sA && !aC) aC = new AudioContext(); }
        if (${hayNovedad} && sA) {
          aC = new (window.AudioContext || window.webkitAudioContext)();
          const o = aC.createOscillator(); const g = aC.createGain();
          o.connect(g); g.connect(aC.destination); o.frequency.value = 880;
          g.gain.exponentialRampToValueAtTime(0.0001, aC.currentTime + 1);
          o.start(); o.stop(aC.currentTime + 1);
        }
        setTimeout(() => location.reload(), 60000);
      </script>
    </body>
  `);
});

app.listen(process.env.PORT || 10000, '0.0.0.0');
