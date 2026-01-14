const puppeteer = require('puppeteer');
const express = require('express');
const fs = require('fs');
const app = express();

const STATE_FILE = './state.json';
const USER = 'phe1981@gmail.com';
const PASS = process.env.ABONO_PASS || 'fAsHaMp@gZie3g@';

let listaLimpia = []; 
let historialNovedades = []; 
let linksDirectos = []; 
let logEstado = "Iniciando...";
let ultimaActualizacion = "Sin datos";

function saveState() {
  try {
    const data = JSON.stringify({ listaLimpia, historialNovedades, linksDirectos });
    fs.writeFileSync(STATE_FILE, data);
  } catch (e) { console.error("Error guardando estado:", e.message); }
}

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const s = JSON.parse(fs.readFileSync(STATE_FILE));
      listaLimpia = s.listaLimpia || [];
      historialNovedades = s.historialNovedades || [];
      linksDirectos = s.linksDirectos || [];
      console.log("💾 Estado previo recuperado.");
    }
  } catch (e) { console.log("Iniciando sin estado previo."); }
}

async function safeClose(p) {
  if (p && !p.isClosed()) { try { await p.close(); } catch (e) {} }
}

loadState();

async function iniciarMonitor() {
  console.log("🚀 Iniciando Jules V4.2 - Ultra Stable (Anti-Timeout)...");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });
  
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
  // Timeout global más largo para evitar los errores de tus logs
  page.setDefaultNavigationTimeout(120000); 

  try {
    logEstado = "Login...";
    console.log("Accediendo a login...");
    // Usamos 'domcontentloaded' para ser más rápidos y evitar bloqueos por scripts externos
    await page.goto('https://compras.abonoteatro.com/login/', { waitUntil: 'domcontentloaded' });
    
    await page.waitForSelector('#nabonadologin', { visible: true, timeout: 30000 });
    await page.type('#nabonadologin', USER);
    await page.type('#contrasenalogin', PASS);
    
    console.log("Enviando credenciales...");
    await Promise.all([
      page.click('input[value="Entrar"]'),
      page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(e => console.log("Nota: Navegación post-login lenta, continuando..."))
    ]);

    console.log("✅ Sesión iniciada.");

    while (true) {
      logEstado = "Escaneando...";
      await page.goto('https://compras.abonoteatro.com/teatro/', { waitUntil: 'domcontentloaded' });
      
      // Tiempo para que el iframe se digne a cargar
      await new Promise(r => setTimeout(r, 25000)); 

      const frameElement = await page.$('iframe[src*="abonoteatro"], iframe[src*="tribe-events"]');
      if (frameElement) {
        const frame = await frameElement.contentFrame();
        const data = await frame.evaluate(() => {
          const links = Array.from(document.querySelectorAll('.tribe-events-list-event-title a, h3 a')).map(el => el.innerText.trim());
          const options = Array.from(document.querySelectorAll('#select_recinto_event option')).map(el => el.innerText.trim()).filter(n => n.length > 2 && !n.includes("Seleccione"));
          return [...new Set([...links, ...options])];
        });

        if (data && data.length > 0) {
          const nombresActuales = [...new Set(data)];
          const ahoraHora = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

          if (listaLimpia.length === 0) {
            listaLimpia = nombresActuales.map(n => ({ nombre: n }));
            ultimaActualizacion = ahoraHora;
            saveState();
          } else {
            const anteriorNombres = listaLimpia.map(item => item.nombre);
            const detectadosAhora = nombresActuales.filter(n => !anteriorNombres.includes(n));

            if (detectadosAhora.length > 0) {
              historialNovedades.forEach(h => h.nuevo = false);

              for (const nombre of detectadosAhora) {
                console.log(`✨ Novedad: ${nombre}`);
                let p1 = null, p2 = null;
                const ts = Date.now();

                try {
                  const p1Promise = page.waitForEvent('popup', { timeout: 25000 });
                  await frame.evaluate((n) => {
                    const el = Array.from(document.querySelectorAll('.tribe-events-list-event-title a, h3 a')).find(a => a.innerText.trim().toLowerCase() === n.toLowerCase());
                    if (el) el.click();
                  }, nombre);
                  p1 = await p1Promise;

                  if (p1) {
                    await p1.waitForSelector('a.buyBtn', { visible: true, timeout: 20000 });
                    const btns = await p1.$$('a.buyBtn');
                    if (btns.length >= 2) {
                      const p2Promise = p1.waitForEvent('popup', { timeout: 25000 });
                      await btns[1].click();
                      p2 = await p2Promise;
                      if (p2) {
                        await p2.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }).catch(()=>{});
                        linksDirectos.unshift({ nombre, url: p2.url(), hora: ahoraHora });
                      }
                    }
                  }
                } catch (e) { console.log(`⚠️ Link no extraído para ${nombre}`); }
                finally {
                  await safeClose(p2);
                  await safeClose(p1);
                }
                historialNovedades.unshift({ nombre, hora: ahoraHora, timestamp: ts, nuevo: true });
                saveState();
              }
            }
            listaLimpia = nombresActuales.map(n => ({ nombre: n }));
            ultimaActualizacion = ahoraHora;
            saveState();
          }
        }
      }
      
      const espera = Math.floor(Math.random() * (240 - 90 + 1) + 90);
      logEstado = `Espera ${Math.floor(espera/60)}m...`;
      await new Promise(r => setTimeout(r, espera * 1000)); 
    }
  } catch (error) {
    console.error("❌ FALLO EN BUCLE:", error.message);
    if (browser) await browser.close();
    setTimeout(iniciarMonitor, 20000); 
  }
}

iniciarMonitor();

app.get('/', (req, res) => {
  const hayNovedad = historialNovedades.some(h => h.nuevo);
  res.send(`
    <body style="background:#000; color:#fff; font-family:sans-serif; padding:20px;">
      <div style="max-width:800px; margin:auto; background:#0a0a0a; padding:30px; border-radius:20px; border:1px solid #222;">
        <div style="text-align:right; margin-bottom:20px;"><button id="btnSonido" onclick="toggleSonido()" style="background:#444; color:#fff; border:none; padding:10px 20px; border-radius:10px; cursor:pointer;">🔇 Inactivo</button></div>
        <header style="text-align:center; margin-bottom:40px;">
          <div style="color:#B9C800; font-size:1.1em; text-transform:uppercase;">Eventos</div>
          <div style="font-size:6em; font-weight:bold; color:#B9C800;">${listaLimpia.length}</div>
          <p>Estado: ${logEstado} | Sincro: ${ultimaActualizacion}</p>
        </header>
        <section style="margin-bottom:30px;">
          <h3 style="color:#00ff00; border-left:4px solid #00ff00; padding-left:10px;">🚀 Links Pasarela</h3>
          <div style="background:#001a00; border:1px solid #00ff00; padding:20px; border-radius:12px;">
            ${linksDirectos.slice(0, 5).map(l => `<div style="margin-bottom:10px;"><a href="${l.url}" target="_blank" style="display:block; color:#fff; font-weight:bold; background:#004d00; padding:12px; border-radius:8px; text-align:center; text-decoration:none; border:1px solid #00ff00;">${l.nombre} [${l.hora}]</a></div>`).join('') || '<p>Esperando...</p>'}
          </div>
        </section>
        <section>
          <h3 style="color:#ff4400; border-left:4px solid #ff4400; padding-left:10px;">🔔 Historial</h3>
          <div style="background:#111; padding:20px; border-radius:12px; max-height:200px; overflow-y:auto;">
            ${historialNovedades.map(h => `<p style="${h.nuevo ? 'color:#ff0000; font-weight:bold;' : 'color:orange;'}">[${h.hora}] ${h.nombre}</p>`).join('')}
          </div>
        </section>
      </div>
      <script>
        let sonidoActivado = sessionStorage.getItem('sonidoLocal') === 'true';
        let audioCtx;
        const uPitada = localStorage.getItem('uPitada');
        const tsActual = "${historialNovedades.length > 0 ? historialNovedades[0].timestamp : ''}";

        function updateBtn() {
            const btn = document.getElementById('btnSonido');
            btn.innerText = sonidoActivado ? '🔊 Activo' : '🔇 Inactivo';
            btn.style.background = sonidoActivado ? '#00ff00' : '#444';
        }
        updateBtn();

        function toggleSonido() {
          sonidoActivado = !sonidoActivado;
          sessionStorage.setItem('sonidoLocal', sonidoActivado);
          updateBtn();
          if (sonidoActivado && !audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }

        if (${hayNovedad} && sonidoActivado && uPitada !== tsActual) {
          if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          audioCtx.resume().then(() => {
            const osc = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            osc.connect(g); g.connect(audioCtx.destination);
            osc.frequency.setValueAtTime(880, audioCtx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.5);
            osc.start(); osc.stop(audioCtx.currentTime + 0.5);
            localStorage.setItem('uPitada', tsActual);
          });
        }
        setTimeout(() => location.reload(), 60000);
      </script>
    </body>
  `);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0');
