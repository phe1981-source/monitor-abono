const puppeteer = require('puppeteer');
const express = require('express');
const { captureUrl } = require('./extractor'); // Asegúrate de que el archivo se llame extractor.js
const app = express();

const USER = 'phe1981@gmail.com';
const PASS = process.env.ABONO_PASS; // Usa la variable que configuraste en la imagen

let listaLimpia = []; 
let historialNovedades = []; 
let linksDirectos = []; 
let logEstado = "Iniciando...";
let ultimaActualizacion = "Sin datos";

async function iniciarMonitor() {
  console.log("🚀 Monitor arrancando...");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
  });
  
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

  try {
    logEstado = "Realizando Login...";
    await page.goto('https://compras.abonoteatro.com/login/', { waitUntil: 'networkidle2' });
    
    await page.type('#nabonadologin', USER);
    await page.type('#contrasenalogin', PASS);
    await Promise.all([
      page.click('input[value="Entrar"].buyBtn'),
      page.waitForNavigation({ waitUntil: 'networkidle2' })
    ]);

    console.log("✅ Sesión iniciada.");

    while (true) {
      logEstado = "Escaneando cartelera...";
      await page.goto('https://compras.abonoteatro.com/teatro/', { waitUntil: 'networkidle2' });
      
      // Esperar a que el iframe cargue realmente los datos
      await page.waitForSelector('iframe');
      const frameElement = await page.$('iframe');
      const frame = await frameElement.contentFrame();
      
      // Espera de seguridad para que el JS interno del iframe renderice los títulos
      await frame.waitForSelector('a', { timeout: 15000 }).catch(() => {});

      const nombresActuales = await frame.evaluate(() => {
        return Array.from(document.querySelectorAll('.tribe-events-list-event-title a, h3 a'))
          .map(el => el.innerText.trim())
          .filter(n => n.length > 3);
      });

      if (nombresActuales.length > 0) {
        const ahoraHora = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

        if (listaLimpia.length === 0) {
          listaLimpia = nombresActuales.map(n => ({ nombre: n }));
          ultimaActualizacion = ahoraHora;
        } else {
          const anteriorNombres = listaLimpia.map(item => item.nombre);
          const detectados = nombresActuales.filter(n => !anteriorNombres.includes(n));

          if (detectados.length > 0) {
            historialNovedades.forEach(h => h.nuevo = false);
            for (const nombre of detectados) {
              console.log(`✨ Nueva entrada: ${nombre}`);
              
              // LLAMADA A TU EXTRACTOR MODULAR
              const urlDirecta = await captureUrl(browser, page, nombre);
              
              if (urlDirecta) {
                linksDirectos.unshift({ nombre, url: urlDirecta, hora: ahoraHora });
              }
              historialNovedades.unshift({ nombre, hora: ahoraHora, nuevo: true });
            }
          }
          listaLimpia = nombresActuales.map(n => ({ nombre: n }));
          ultimaActualizacion = ahoraHora;
        }
      } else {
        logEstado = "⚠️ Cartelera no detectada (0)";
      }

      // Espera aleatoria entre 2 y 4 minutos para evitar bloqueos
      const espera = Math.floor(Math.random() * (240 - 120 + 1) + 120);
      logEstado = `Siguiente escaneo en ${Math.floor(espera/60)}m`;
      await new Promise(r => setTimeout(r, espera * 1000));
    }
  } catch (error) {
    console.error("❌ Error en el monitor:", error.message);
    await browser.close();
    setTimeout(iniciarMonitor, 20000); // Reintentar tras 20 seg
  }
}

iniciarMonitor();

// --- INTERFAZ WEB ---
app.get('/', (req, res) => {
  const hayNovedad = historialNovedades.some(h => h.nuevo);
  res.send(`
    <body style="background:#000; color:#fff; font-family:sans-serif; padding:20px; display:flex; justify-content:center;">
      <div style="width:100%; max-width:600px; background:#0f0f0f; border:1px solid #222; border-radius:15px; padding:25px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
        
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
          <span style="color:#B9C800; font-weight:bold; letter-spacing:1px;">MONITOR ACTIVO</span>
          <button id="btnSonido" onclick="toggleSonido()" style="background:#333; color:#fff; border:none; padding:8px 15px; border-radius:8px; cursor:pointer; font-size:12px;">
            🔇 SONIDO DESACTIVADO
          </button>
        </div>

        <div style="text-align:center; margin-bottom:30px;">
          <div style="font-size:5em; font-weight:bold; color:#B9C800; margin:0;">${listaLimpia.length}</div>
          <div style="color:#666; font-size:14px; margin-top:-10px;">Eventos Detectados</div>
          <div style="background:#1a1a1a; margin-top:15px; padding:10px; border-radius:10px; font-size:13px;">
            <span style="color:#888;">Estado:</span> ${logEstado} <br>
            <span style="color:#888;">Sincro:</span> ${ultimaActualizacion}
          </div>
        </div>

        <div style="margin-bottom:25px;">
          <h4 style="color:#00ff00; margin-bottom:10px; font-size:14px;">🚀 COMPRA DIRECTA</h4>
          ${linksDirectos.length > 0 ? linksDirectos.map(l => `
            <a href="${l.url}" target="_blank" style="text-decoration:none; display:block; background:#004400; color:#fff; padding:15px; border-radius:10px; border:1px solid #00ff00; font-weight:bold; text-align:center; margin-bottom:10px;">
              ${l.nombre} <br> <span style="font-size:10px; opacity:0.6;">Detectado a las ${l.hora}</span>
            </a>
          `).join('') : '<div style="color:#444; text-align:center; padding:10px; border:1px dashed #333; border-radius:10px;">No hay links nuevos todavía</div>'}
        </div>

        <div>
          <h4 style="color:#ff6600; margin-bottom:10px; font-size:14px;">🔔 ÚLTIMOS CAMBIOS</h4>
          <div style="background:#111; border-radius:10px; padding:10px; max-height:150px; overflow-y:auto; font-size:13px;">
            ${historialNovedades.map(h => `
              <div style="padding:8px 0; border-bottom:1px solid #222; ${h.nuevo ? 'color:#00ff00; font-weight:bold;' : 'color:#999;'}">
                [${h.hora}] ${h.nombre}
              </div>
            `).join('') || '<div style="color:#333;">Historial vacío</div>'}
          </div>
        </div>

      </div>

      <script>
        let sonidoActivo = sessionStorage.getItem('sonido') === 'true';
        let audioCtx;

        function updateUI() {
          const btn = document.getElementById('btnSonido');
          btn.innerText = sonidoActivo ? '🔊 SONIDO ACTIVO' : '🔇 SONIDO DESACTIVADO';
          btn.style.background = sonidoActivo ? '#B9C800' : '#333';
          btn.style.color = sonidoActivo ? '#000' : '#fff';
        }
        updateUI();

        function toggleSonido() {
          sonidoActivo = !sonidoActivo;
          sessionStorage.setItem('sonido', sonidoActivo);
          updateUI();
          if (sonidoActivo) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            beep();
          }
        }

        function beep() {
          if (!sonidoActivo || !audioCtx) return;
          const v = audioCtx.createOscillator();
          const u = audioCtx.createGain();
          v.connect(u);
          v.frequency.value = 880;
          u.connect(audioCtx.destination);
          v.start();
          setTimeout(() => v.stop(), 150);
        }

        if (${hayNovedad} && sonidoActivo) {
          audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          setTimeout(beep, 500);
        }

        setTimeout(() => location.reload(), 45000);
      </script>
    </body>
  `);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Monitor listo en puerto ${PORT}`));
