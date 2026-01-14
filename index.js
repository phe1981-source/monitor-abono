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
      console.log("💾 Estado cargado.");
    }
  } catch (e) {}
}

async function safeClose(p) {
  if (p && !p.isClosed()) { try { await p.close(); } catch (e) {} }
}

loadState();

async function iniciarMonitor() {
  console.log("🚀 Iniciando Jules V4.8.1 - Fix Syntax...");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  async function captureUrlForShow(nombre) {
    estaCapturando = true; 
    let popup1 = null, popup2 = null;
    try {
      console.log(`🔎 Capturando URL para: ${nombre}...`);
      const frameElement = await page.$('iframe');
      if (!frameElement) return null;
      const frame = await frameElement.contentFrame();

      const target1Promise = new Promise(resolve => browser.once('targetcreated', resolve));
      const clickExitoso = await frame.evaluate((n) => {
        const links = Array.from(document.querySelectorAll('a'));
        const found = links.find(a => a.innerText.trim().toLowerCase().includes(n.toLowerCase()));
        if (found) { found.scrollIntoView(); found.click(); return true; }
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
          const target2Promise = new Promise(resolve => browser.once('targetcreated', resolve));
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
      console.log(`🛑 Fallo en captura: ${e.message}`);
      await page.reload({ waitUntil: 'networkidle2' }).catch(() => {});
    } finally {
      await safeClose(popup2);
      await safeClose(popup1);
      estaCapturando = false; 
    }
    return null;
  }

  try {
    logEstado = "Login...";
    await page.goto('https://compras.abonoteatro.com/login/', { waitUntil: 'networkidle2', timeout: 90000 });
    await page.type('#nabonadologin', USER);
    await page.type('#contrasenalogin', PASS);
    await Promise.all([
      page.click('input[value="Entrar"].buyBtn'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 90000 })
    ]);

    while (true) {
      if (!estaCapturando) {
        logEstado = "Escaneando...";
        await page.goto('https://compras.abonoteatro.com/teatro/', { waitUntil: 'networkidle2', timeout: 90000 });
        await new Promise(r => setTimeout(r, 10000)); 

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
            const detectadosAhora = nombresActuales.filter(n => !listaLimpia.some(item => item.nombre === n));

            // Test con LOSER si existe
            if (nombresActuales.some(n => n.toUpperCase().includes("LOSER"))) {
                await captureUrlForShow("LOSER");
            }

            if (listaLimpia.length === 0) {
              listaLimpia = nombresActuales.map(n => ({ nombre: n }));
              saveState();
            } else if (detectadosAhora.length > 0) {
              historialNovedades.forEach(h => h.nuevo = false);
              for (const nombre of detectadosAhora) {
                const finalUrl = await captureUrlForShow(nombre);
                linksDirectos.unshift({ nombre, url: finalUrl || '#', hora: ahoraHora });
                historialNovedades.unshift({ nombre, hora: ahoraHora, timestamp: Date.now(), nuevo: true });
              }
              listaLimpia = nombresActuales.map(n => ({ nombre: n }));
              ultimaActualizacion = ahoraHora;
              saveState();
            }
          }
        }
      }
      const espera = Math.floor(Math.random() * (240 - 120 + 1) + 120);
      logEstado = `Espera ${Math.floor(espera/60)}m...`;
      await new Promise(r => setTimeout(r, espera * 1000)); 
    }
  } catch (error) {
    console.log("❌ ERROR:", error.message);
    if (browser) await browser.close();
    setTimeout(iniciarMonitor, 30000); 
  }
}

iniciarMonitor();

app.get('/', (req, res) => {
  res.send(`
    <body style="background:#000; color:#fff; font-family:sans-serif; padding:20px;">
      <div style="max-width:800px; margin:auto; background:#0a0a0a; padding:30px; border-radius:20px; border:1px solid #222;">
        <header style="text-align:center; margin-bottom:40px;">
          <div style="font-size:5em; font-weight:bold; color:#B9C800;">${listaLimpia.length}</div>
          <p>Estado: ${logEstado} | Sincro: ${ultimaActualizacion}</p>
        </header>
        <section style="margin-bottom:30px;">
          <h3 style="color:#00ff00;">🚀 Links Directos</h3>
          ${linksDirectos.map(l => `<div style="margin-bottom:10px;"><a href="${l.url}" target="_blank" style="display:block; color:#fff; background:#004d00; padding:12px; border-radius:8px; text-decoration:none;">${l.nombre} [${l.hora}]</a></div>`).join('') || '<p>Nada por ahora.</p>'}
        </section>
      </div>
      <script>setTimeout(() => location.reload(), 60000);</script>
    </body>
  `);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0');
