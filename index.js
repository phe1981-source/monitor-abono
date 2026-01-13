const puppeteer = require('puppeteer');
const express = require('express');
const path = require('path');
const app = express();

const USER = 'phe1981@gmail.com';
const PASS = process.env.ABONO_PASS;

app.use('/debug', express.static(__dirname));

let listaLimpia = []; 
let historialNovedades = []; 
let linksDirectos = []; 
let logEstado = "Iniciando...";
let ultimaActualizacion = "Sin datos";

async function iniciarMonitor() {
  console.log("🚀 Iniciando Bot V2.3 - Tiempos de espera ampliados...");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  try {
    logEstado = "Login en proceso...";
    // Aumentamos timeout a 90s y usamos 'domcontentloaded' para ir más rápido
    await page.goto('https://compras.abonoteatro.com/login/', { waitUntil: 'domcontentloaded', timeout: 90000 });
    
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Aceptar'));
      if (btn) btn.click();
    }).catch(() => {});

    await page.type('#nabonadologin', USER);
    await page.type('#contrasenalogin', PASS);
    await Promise.all([
      page.click('input[value="Entrar"].buyBtn'),
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 90000 })
    ]);

    console.log("✅ Login completado.");

    while (true) {
      logEstado = "Escaneando cartelera...";
      await page.goto('https://compras.abonoteatro.com/teatro/', { waitUntil: 'domcontentloaded', timeout: 90000 });
      
      const frameElement = await page.waitForSelector('iframe', { timeout: 60000 });
      const frame = await frameElement.contentFrame();

      const data = await frame.evaluate(() => {
        return Array.from(document.querySelectorAll('.tribe-events-list-event-title a, h3 a'))
          .map(el => el.innerText.trim())
          .filter(n => n !== "");
      });

      if (data && data.length > 0) {
        const nombresActuales = [...new Set(data)];
        const ahoraHora = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

        if (listaLimpia.length === 0) {
          listaLimpia = nombresActuales.map(n => ({ nombre: n }));
          ultimaActualizacion = ahoraHora;
        } else {
          const anteriorNombres = listaLimpia.map(item => item.nombre);
          const detectados = nombresActuales.filter(n => !anteriorNombres.includes(n));

          for (const nombre of detectados) {
            console.log(`🔎 Novedad: ${nombre}`);
            const screenshotName = `debug_${Date.now()}.png`;
            
            try {
              await frame.evaluate((n) => {
                const link = Array.from(document.querySelectorAll('a')).find(a => a.innerText.includes(n));
                if (link) {
                   const btn = link.closest('.tribe-events-calendar-list__event-details')?.querySelector('.buyBtn') || 
                             link.closest('.content')?.querySelector('.buyBtn') || link;
                   if (btn) btn.click();
                }
              }, nombre);

              await new Promise(r => setTimeout(r, 8000)); 
              await page.screenshot({ path: screenshotName });

              const pages = await browser.pages();
              for (const p of pages) {
                if (p.url().includes('shoppad') || p.url().includes('checkout')) {
                  linksDirectos.unshift({ nombre, url: p.url(), hora: ahoraHora });
                }
              }

              historialNovedades.unshift({ nombre, hora: ahoraHora, nuevo: true, debugImg: `/debug/${screenshotName}` });
            } catch (e) { console.log("Error captura:", e.message); }
          }
          listaLimpia = nombresActuales.map(n => ({ nombre: n }));
          ultimaActualizacion = ahoraHora;
        }
      }
      
      logEstado = "Esperando ciclo...";
      await new Promise(r => setTimeout(r, 180000));
    }
  } catch (error) {
    console.log("❌ ERROR:", error.message);
    logEstado = "Error de tiempo. Reiniciando...";
    if (browser) await browser.close();
    setTimeout(iniciarMonitor, 15000);
  }
}

iniciarMonitor();

app.get('/', (req, res) => {
  const hayNovedad = historialNovedades.some(h => h.nuevo);
  res.send(`
    <body style="background:#000; color:#fff; font-family:sans-serif; padding:20px;">
      <div style="max-width:800px; margin:auto; background:#111; padding:20px; border-radius:15px; border:1px solid #333;">
        <div style="text-align:right;">
          <button id="btnSonido" onclick="toggleSonido()" style="background:#444; color:#fff; border:none; padding:10px 20px; border-radius:10px; cursor:pointer;">🔇 Activar Sonido</button>
        </div>
        <h1 style="color:#B9C800; text-align:center; font-size:5em; margin:10px 0;">\${listaLimpia.length}</h1>
        <p style="text-align:center; color:#888;">\${logEstado} | Sincro: \${ultimaActualizacion}</p>
        <h3 style="color:#00ff00;">🚀 LINKS DE COMPRA</h3>
        <div style="background:#001a00; padding:15px; border-radius:10px; border:1px solid #00ff00; min-height:60px;">
          \${linksDirectos.map(l => \`<a href="\${l.url}" target="_blank" style="display:block; color:#fff; background:#004d00; padding:15px; margin:5px 0; border-radius:8px; text-decoration:none; text-align:center; font-weight:bold;">\${l.nombre} [\${l.hora}]</a>\`).join('') || '<p style="text-align:center;">Esperando...</p>'}
        </div>
        <h3 style="color:#ff4400; margin-top:30px;">🔔 HISTORIAL</h3>
        <div style="background:#0a0a0a; border:1px solid #222; border-radius:10px; padding:10px;">
          \${historialNovedades.map(h => \`
            <div style="padding:10px; border-bottom:1px solid #222; display:flex; justify-content:space-between;">
              <span style="\${h.nuevo ? 'color:#ff4400; font-weight:bold;' : 'color:#ccc;'}">[\${h.hora}] \${h.nombre}</span>
              \${h.debugImg ? \`<a href="\${h.debugImg}" target="_blank" style="color:#00acee; font-size:0.8em;">Ver Debug</a>\` : ''}
            </div>
          \`).join('')}
        </div>
      </div>
      <script>
        let sonidoActivado = sessionStorage.getItem('sonidoLocal') === 'true';
        let audioCtx = null;
        function toggleSonido() {
          sonidoActivado = !sonidoActivado;
          sessionStorage.setItem('sonidoLocal', sonidoActivado);
          document.getElementById('btnSonido').innerText = sonidoActivado ? '🔊 Sonido Activo' : '🔇 Activar Sonido';
          if (sonidoActivado && !audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (\${hayNovedad} && sonidoActivado) {
          const osc = new (window.AudioContext || window.webkitAudioContext)().createOscillator();
          osc.connect(new (window.AudioContext || window.webkitAudioContext)().destination);
          osc.start(); setTimeout(() => osc.stop(), 200);
        }
        setTimeout(() => location.reload(), 60000);
      </script>
    </body>
  `);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log('Servidor iniciado en puerto ' + PORT));
