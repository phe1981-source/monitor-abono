const puppeteer = require('puppeteer');
const express = require('express');
const { captureUrl } = require('./extractor'); 
const app = express();

const USER = 'phe1981@gmail.com';
const PASS = process.env.ABONO_PASS || 'fAsHaMp@gZie3g@';

let listaLimpia = [], historialNovedades = [], linksDirectos = [];
let logEstado = "Iniciando...", ultimaActualizacion = "Sin datos";
let estaBuscandoURL = false;

async function iniciarMonitor() {
  console.log("🚀 Monitor Jules V5.2 - Motor Ayer Restaurado");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled']
  });
  
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  // Aumentamos el timeout global a 120 segundos para Render
  await page.setDefaultNavigationTimeout(120000); 

  try {
    logEstado = "Login...";
    console.log("⏳ Accediendo a login...");
    await page.goto('https://compras.abonoteatro.com/login/', { waitUntil: 'networkidle2' });
    
    await page.type('#nabonadologin', USER);
    await page.type('#contrasenalogin', PASS);
    await page.click('input[value="Entrar"].buyBtn');
    
    // Esperamos al iframe que confirma que estamos dentro
    await page.waitForSelector('iframe', { timeout: 120000 });
    console.log("✅ Login exitoso (Motor ayer)");

    while (true) {
      if (!estaBuscandoURL) {
        logEstado = "Escaneando...";
        await page.goto('https://compras.abonoteatro.com/teatro/', { waitUntil: 'domcontentloaded' });
        
        // Pausa de seguridad para que cargue el contenido interno (Legacy)
        await new Promise(r => setTimeout(r, 20000)); 

        const frameElement = await page.$('iframe');
        if (frameElement) {
          const frame = await frameElement.contentFrame();
          const nombresActuales = await frame.evaluate(() => {
            const items = document.querySelectorAll('.tribe-events-list-event-title a, h3 a, .tribe-events-calendar-list__event-title a');
            return [...new Set(Array.from(items).map(el => el.innerText.trim()))].filter(n => n.length > 1);
          });

          if (nombresActuales.length > 0) {
            const ahora = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
            const detectados = nombresActuales.filter(n => !listaLimpia.includes(n));

            if (listaLimpia.length === 0) {
              listaLimpia = nombresActuales;
              ultimaActualizacion = ahora;
            } else if (detectados.length > 0) {
              historialNovedades.forEach(h => h.nuevo = false);
              
              for (const nombre of detectados) {
                historialNovedades.unshift({ nombre, hora: ahora, nuevo: true });
                console.log(`🔔 NUEVO: ${nombre}`);

                estaBuscandoURL = true;
                captureUrl(browser, page, nombre).then(url => {
                  if (url) linksDirectos.unshift({ nombre, url, hora: ahora });
                  estaBuscandoURL = false;
                }).catch(() => { estaBuscandoURL = false; });
              }
              listaLimpia = nombresActuales;
              ultimaActualizacion = ahora;
            }
          }
        }
      }
      const espera = Math.floor(Math.random() * (240 - 150 + 1) + 150);
      logEstado = `Espera ${Math.floor(espera/60)}m...`;
      await new Promise(r => setTimeout(r, espera * 1000)); 
    }
  } catch (error) {
    console.log("❌ Error monitor:", error.message);
    await browser.close().catch(() => {});
    setTimeout(iniciarMonitor, 20000); 
  }
}

iniciarMonitor();

// DASHBOARD CON ALARMA
app.get('/', (req, res) => {
  const hayNovedad = historialNovedades.some(h => h.nuevo);
  res.send(`
    <body style="background:#000; color:#fff; font-family:sans-serif; padding:20px;">
      <div style="max-width:800px; margin:auto; background:#111; padding:30px; border-radius:20px; border:1px solid #333;">
        <div style="text-align:right;"><button id="btnS" onclick="tS()" style="background:#444; color:#fff; border:none; padding:10px; border-radius:8px; cursor:pointer;">Activar Sonido</button></div>
        <h1 style="text-align:center; font-size:4.5em; color:#B9C800; margin:10px 0;">${listaLimpia.length}</h1>
        <p style="text-align:center; color:#888;">Estado: <b style="color:#fff;">${logEstado}</b> | Sincro: ${ultimaActualizacion}</p>
        
        <div style="margin-top:30px;">
          <h3 style="color:#00ff00; border-bottom:1px solid #222; padding-bottom:10px;">🚀 Links Directos</h3>
          ${linksDirectos.map(l => `<a href="${l.url}" target="_blank" style="display:block; color:#fff; background:#004d00; padding:15px; margin-bottom:10px; border-radius:10px; text-decoration:none; text-align:center; font-weight:bold; border:1px solid #00ff00;">${l.nombre}</a>`).join('') || '<p style="color:#555;">Esperando novedades...</p>'}
        </div>

        <div style="margin-top:30px;">
          <h3 style="color:orange; border-bottom:1px solid #222; padding-bottom:10px;">🔔 Historial</h3>
          <div style="max-height:250px; overflow-y:auto;">
            ${historialNovedades.map(h => `<p style="${h.nuevo ? 'color:#ff4444; font-weight:bold;' : 'color:#888;'}">[${h.hora}] ${h.nombre}</p>`).join('')}
          </div>
        </div>
      </div>
      <script>
        let sA = sessionStorage.getItem('sA') === 'true';
        let aC;
        function tS() { sA = !sA; sessionStorage.setItem('sA', sA); document.getElementById('btnS').innerText = sA ? '🔊 Activo' : '🔇 Inactivo'; if(sA && !aC) aC = new AudioContext(); }
        if (sA) { document.getElementById('btnS').innerText = '🔊 Activo'; document.getElementById('btnS').style.background = '#00ff00'; }
        if (${hayNovedad} && sA) {
          aC = new (window.AudioContext || window.webkitAudioContext)();
          const o = aC.createOscillator(); const g = aC.createGain();
          o.connect(g); g.connect(aC.destination); o.frequency.value = 880;
          g.gain.exponentialRampToValueAtTime(0.0001, aC.currentTime + 1);
          o.start(); o.stop(aC.currentTime + 1);
        }
        setTimeout(() => location.reload(), 30000);
      </script>
    </body>
  `);
});

app.listen(process.env.PORT || 10000, '0.0.0.0');
