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
  } catch (e) {}
}

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const s = JSON.parse(fs.readFileSync(STATE_FILE));
      listaLimpia = s.listaLimpia || [];
      historialNovedades = s.historialNovedades || [];
      linksDirectos = s.linksDirectos || [];
      console.log("💾 Estado cargado.");
    }
  } catch (e) {}
}

async function safeClose(p) {
  if (p && !p.isClosed()) { try { await p.close(); } catch (e) {} }
}

loadState();

async function iniciarMonitor() {
  console.log("🚀 Iniciando Jules V4.4 - Debug Visual & Auto-Retry...");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  try {
    logEstado = "Login...";
    await page.goto('https://compras.abonoteatro.com/login/', { waitUntil: 'networkidle2', timeout: 90000 });
    
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Aceptar'));
      if (btn) btn.click();
    }).catch(() => {});

    await page.type('#nabonadologin', USER);
    await page.type('#contrasenalogin', PASS);
    
    await Promise.all([
      page.click('input[value="Entrar"].buyBtn'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 90000 })
    ]);

    // FUNCIÓN MODULAR CON REINTENTOS Y DEBUG VISUAL
    async function captureUrlForShow(nombre, isTest = false, frame, attempt = 1) {
      let popup1 = null, popup2 = null;
      const ts = Date.now();
      const prefix = isTest ? `TEST_${nombre}` : nombre;

      try {
        console.log(`🔎 [Intento ${attempt}] Iniciando captura para: ${nombre}...`);
        
        // Screenshot 1: Antes de buscar el título
        await page.screenshot({ path: `debug_${prefix}_1_buscando.png` });

        const p1Promise = browser.waitForTarget(t => t.opener() === page.target(), {timeout: 30000});
        
        const found = await frame.evaluate((n) => {
            const el = Array.from(document.querySelectorAll('.tribe-events-list-event-title a, h3 a'))
                             .find(a => a.innerText.trim().toLowerCase().includes(n.toLowerCase()));
            if (el) {
                el.scrollIntoView();
                el.click();
                return true;
            }
            return false;
        }, nombre);

        if (!found) {
            console.log(`⚠️ No se encontró el elemento para ${nombre}`);
            return null;
        }

        // Screenshot 2: Justo después del clic
        await page.screenshot({ path: `debug_${prefix}_2_click_nombre.png` });

        const target1 = await p1Promise;
        popup1 = await target1.page();

        if (popup1) {
            console.log(`✅ Popup 1 detectado para ${nombre}`);
            await popup1.waitForSelector('a.buyBtn', { visible: true, timeout: 20000 });
            
            // Screenshot 3: Popup 1 cargado
            await popup1.screenshot({ path: `debug_${prefix}_3_popup1.png` });

            const btns = await popup1.$$('a.buyBtn');
            if (btns.length >= 2) {
                const p2Promise = browser.waitForTarget(t => t.opener() === target1, {timeout: 30000});
                await btns[1].click();
                
                const target2 = await p2Promise;
                popup2 = await target2.page();
                
                if (popup2) {
                    console.log(`✅ Popup 2 (Pasarela) detectado`);
                    await popup2.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
                    
                    // Screenshot 4: URL Final
                    await popup2.screenshot({ path: `debug_${prefix}_4_final.png` });
                    
                    const finalUrl = popup2.url();
                    return finalUrl;
                }
            }
        }
      } catch (e) {
          console.log(`🛑 Error en Intento ${attempt} para ${nombre}: ${e.message}`);
          if (attempt < 3) {
              console.log(`🔄 Reintentando en 5 segundos...`);
              await new Promise(r => setTimeout(r, 5000));
              return await captureUrlForShow(nombre, isTest, frame, attempt + 1);
          }
      } finally {
          await safeClose(popup2);
          await safeClose(popup1);
      }
      return null;
    }

    while (true) {
      logEstado = "Escaneando...";
      await page.goto('https://compras.abonoteatro.com/teatro/', { waitUntil: 'networkidle2', timeout: 90000 });
      await new Promise(r => setTimeout(r, 15000)); 

      const frameElement = await page.$('iframe');
      if (frameElement) {
        const frame = await frameElement.contentFrame();
        const data = await frame.evaluate(() => {
          const visuales = Array.from(document.querySelectorAll('.tribe-events-list-event-title a, h3 a')).map(el => el.innerText.trim());
          const opciones = Array.from(document.querySelectorAll('#select_recinto_event option'))
                                .map(el => el.innerText.trim()).filter(n => n.length > 2 && !n.includes("Seleccione"));
          return [...new Set([...visuales, ...opciones])];
        });

        if (data && data.length > 0) {
          const nombresActuales = [...new Set(data)];
          const ahoraHora = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
          const anteriorNombres = listaLimpia.map(item => item.nombre);
          const detectadosAhora = nombresActuales.filter(n => !anteriorNombres.includes(n));

          // MODO PRUEBA "LOSER"
          if (nombresActuales.some(n => n.toUpperCase().includes("LOSER"))) {
              console.log("🧪 Ejecutando prueba de flujo para LOSER...");
              await captureUrlForShow("LOSER", true, frame);
          }

          if (listaLimpia.length === 0) {
            listaLimpia = nombresActuales.map(n => ({ nombre: n }));
            saveState();
          } else if (detectadosAhora.length > 0) {
            historialNovedades.forEach(h => h.nuevo = false);
            for (const nombre of detectadosAhora) {
              const finalUrl = await captureUrlForShow(nombre, false, frame);
              if (finalUrl) {
                linksDirectos.unshift({ nombre, url: finalUrl, hora: ahoraHora });
                historialNovedades.unshift({ nombre, hora: ahoraHora, timestamp: Date.now(), nuevo: true });
              }
            }
            listaLimpia = nombresActuales.map(n => ({ nombre: n }));
            ultimaActualizacion = ahoraHora;
            saveState();
          }
        }
      }
      const espera = Math.floor(Math.random() * (240 - 120 + 1) + 120);
      logEstado = `Espera ${Math.floor(espera/60)}m...`;
      await new Promise(r => setTimeout(r, espera * 1000)); 
    }
  } catch (error) {
    console.log("❌ ERROR CRÍTICO:", error.message);
    if (browser) await browser.close();
    setTimeout(iniciarMonitor, 30000); 
  }
}

iniciarMonitor();

app.get('/', (req, res) => {
  const hayNovedad = historialNovedades.some(h => h.nuevo);
  res.send(`
    <body style="background:#000; color:#fff; font-family:sans-serif; padding:20px;">
      <div style="max-width:800px; margin:auto; background:#0a0a0a; padding:30px; border-radius:20px; border:1px solid #222;">
        <div style="text-align:right; margin-bottom:20px;"><button id="btnSonido" onclick="toggleSonido()" style="background:#444; color:#fff; border:none; padding:10px 20px; border-radius:10px; cursor:pointer;">🔇 Activar Sonido</button></div>
        <header style="text-align:center; margin-bottom:40px;">
          <div style="color:#B9C800; font-size:1.1em; text-transform:uppercase;">Eventos Totales</div>
          <div style="font-size:6em; font-weight:bold; color:#B9C800;">${listaLimpia.length}</div>
          <p>Estado: ${logEstado} | Sincro: ${ultimaActualizacion}</p>
        </header>
        <section style="margin-bottom:30px;">
          <h3 style="color:#00ff00; border-left:4px solid #00ff00; padding-left:10px;">🚀 Links Directos</h3>
          <div style="background:#001a00; border:1px solid #00ff00; padding:20px; border-radius:12px;">
            ${linksDirectos.map(l => `<div style="margin-bottom:10px;"><a href="${l.url}" target="_blank" style="display:block; color:#fff; font-weight:bold; background:#004d00; padding:12px; border-radius:8px; text-align:center; text-decoration:none; border:1px solid #00ff00;">${l.nombre} [${l.hora}]</a></div>`).join('') || '<p>Esperando novedades...</p>'}
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
        const ultimaPitada = localStorage.getItem('uPitada');
        const syncTimestamp = "${ultimaActualizacion}";

        function updateBtn() {
            const btn = document.getElementById('btnSonido');
            btn.innerText = sonidoActivado ? '🔊 Sonido Activo' : '🔇 Activar Sonido';
            btn.style.background = sonidoActivado ? '#00ff00' : '#444';
        }
        updateBtn();

        function toggleSonido() {
          sonidoActivado = !sonidoActivado;
          sessionStorage.setItem('sonidoLocal', sonidoActivado);
          updateBtn();
          if (sonidoActivado && !audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }

        if (${hayNovedad} && sonidoActivado && ultimaPitada !== syncTimestamp) {
          if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          const osc = audioCtx.createOscillator();
          const g = audioCtx.createGain();
          osc.connect(g); g.connect(audioCtx.destination);
          osc.frequency.setValueAtTime(880, audioCtx.currentTime);
          g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.5);
          osc.start(); osc.stop(audioCtx.currentTime + 0.5);
          localStorage.setItem('uPitada', syncTimestamp);
        }
        setTimeout(() => location.reload(), 60000);
      </script>
    </body>
  `);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0');
