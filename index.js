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
let estaCapturando = false; 

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
    }
  } catch (e) {}
}

async function safeClose(p) {
  if (p && !p.isClosed()) { try { await p.close(); } catch (e) {} }
}

loadState();

async function iniciarMonitor() {
  console.log("🚀 Monitor Jules V4.9 Online - Hybrid Mode");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
  });
  
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  async function captureUrlForShow(nombre) {
    estaCapturando = true; 
    let popup1 = null, popup2 = null;
    try {
      const frameElement = await page.$('iframe');
      if (!frameElement) return null;
      const frame = await frameElement.contentFrame();

      const target1Promise = browser.waitForTarget(t => t.opener() === page.target());
      
      const clickExitoso = await frame.evaluate((n) => {
        const links = Array.from(document.querySelectorAll('.tribe-events-list-event-title a, h3 a'));
        const found = links.find(a => a.innerText.trim().toLowerCase().includes(n.toLowerCase()));
        if (found) {
          found.scrollIntoView({ behavior: 'smooth', block: 'center' });
          found.click();
          return true;
        }
        return false;
      }, nombre);

      if (!clickExitoso) return null;

      const target1 = await Promise.race([
        target1Promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout P1')), 15000))
      ]);

      popup1 = await target1.page();
      if (popup1) {
        await popup1.waitForSelector('a.buyBtn', { visible: true, timeout: 10000 });
        const btns = await popup1.$$('a.buyBtn');
        if (btns.length >= 2) {
          const target2Promise = browser.waitForTarget(t => t.opener() === target1);
          await btns[1].click();
          const target2 = await Promise.race([
            target2Promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout P2')), 15000))
          ]);
          popup2 = await target2.page();
          if (popup2) {
            await popup2.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
            return popup2.url();
          }
        }
      }
    } catch (e) {
      console.log(`🛑 Error capturando URL para ${nombre}: ${e.message}`);
    } finally {
      await safeClose(popup2);
      await safeClose(popup1);
      estaCapturando = false; 
    }
    return null;
  }

  try {
    logEstado = "Intentando Login...";
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
      if (!estaCapturando) {
        logEstado = "Escaneando...";
        await page.goto('https://compras.abonoteatro.com/teatro/', { waitUntil: 'domcontentloaded', timeout: 90000 });
        await new Promise(r => setTimeout(r, 20000)); 

        const frameElement = await page.$('iframe');
        if (frameElement) {
          const frame = await frameElement.contentFrame();
          const data = await frame.evaluate(() => {
            const visuales = Array.from(document.querySelectorAll('.tribe-events-list-event-title a, h3 a')).map(el => el.innerText.trim());
            const opciones = Array.from(document.querySelectorAll('#select_recinto_event option')).map(el => el.innerText.trim()).filter(n => n.length > 2 && !n.includes("Seleccione"));
            return [...new Set([...visuales, ...opciones])];
          });

          if (data && data.length > 0) {
            const nombresActuales = [...new Set(data)];
            const ahoraHora = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
            const anteriorNombres = listaLimpia.map(item => item.nombre);
            const detectadosAhora = nombresActuales.filter(n => !anteriorNombres.includes(n));

            if (listaLimpia.length === 0) {
              listaLimpia = nombresActuales.map(n => ({ nombre: n }));
              ultimaActualizacion = ahoraHora;
              saveState();
            } else if (detectadosAhora.length > 0) {
              historialNovedades.forEach(h => h.nuevo = false);
              for (const nombre of detectadosAhora) {
                console.log(`🔔 Novedad detectada: ${nombre}`);
                const finalUrl = await captureUrlForShow(nombre);
                if (finalUrl) {
                  linksDirectos.unshift({ nombre, url: finalUrl, hora: ahoraHora });
                }
                historialNovedades.unshift({ nombre, hora: ahoraHora, timestamp: Date.now(), nuevo: true });
              }
              listaLimpia = nombresActuales.map(n => ({ nombre: n }));
              ultimaActualizacion = ahoraHora;
              saveState();
            }
          }
        }
      }
      const espera = Math.floor(Math.random() * (240 - 180 + 1) + 180);
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
        <div style="text-align:right; margin-bottom:20px;">
            <button id="btnSonido" onclick="toggleSonido()" style="background:#444; color:#fff; border:none; padding:10px 20px; border-radius:10px; cursor:pointer;">🔇 Activar Sonido</button>
        </div>
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
          if (sonidoActivado) { 
            if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); 
            audioCtx.resume(); 
          }
        }
        if (${hayNovedad} && sonidoActivado) {
          if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          const osc = audioCtx.createOscillator();
          const g = audioCtx.createGain();
          osc.connect(g); g.connect(audioCtx.destination);
          osc.frequency.setValueAtTime(880, audioCtx.currentTime);
          g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.5);
          osc.start(); osc.stop(audioCtx.currentTime + 0.5);
        }
        setTimeout(() => location.reload(), 60000);
      </script>
    </body>
  `);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0');
