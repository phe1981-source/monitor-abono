const puppeteer = require('puppeteer');
const express = require('express');
const app = express();

const USER = 'phe1981@gmail.com';
const PASS = 'fAsHaMp@gZie3g@';

let memoriaEventos = []; 
let novedadesDetectadas = [];
let ultimaVez = "Iniciando...";
let escaneosRealizados = 0;
let browser, page;
let estaEscaneando = false;

async function iniciarRobot() {
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--single-process']
    });
    page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await realizarLogin();
    
    setInterval(escanearCartelera, 60 * 1000);
    escanearCartelera(); 
  } catch (e) {
    console.error("Error inicial:", e.message);
  }
}

async function realizarLogin() {
  try {
    console.log("Haciendo login...");
    await page.goto('https://compras.abonoteatro.com/login/', { waitUntil: 'networkidle2' });
    await page.type('#nabonadologin', USER);
    await page.type('#contrasenalogin', PASS);
    await Promise.all([
      page.click('input[value="Entrar"].buyBtn'),
      page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {})
    ]);
  } catch (e) { console.error("Error login:", e.message); }
}

async function escanearCartelera() {
  if (estaEscaneando) return;
  estaEscaneando = true;

  try {
    console.log(`[${new Date().toLocaleTimeString()}] Escaneando con Auto-Scroll...`);
    await page.goto('https://compras.abonoteatro.com/eventos/', { waitUntil: 'domcontentloaded' });

    if (page.url().includes('login')) {
      await realizarLogin();
      estaEscaneando = false;
      return;
    }

    // --- FUNCIÓN DE AUTO-SCROLL ---
    // Baja la página para que carguen todos los eventos "ocultos"
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        let distance = 400;
        let timer = setInterval(() => {
          let scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });

    const carteleraActual = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('h3, .entry-title, .event-title'));
      return items.map(i => i.innerText.trim()).filter(t => t.length > 3);
    });

    if (memoriaEventos.length > 0) {
      const nuevos = carteleraActual.filter(titulo => !memoriaEventos.includes(titulo));
      nuevos.forEach(n => {
        if (!novedadesDetectadas.find(nov => nov.titulo === n)) {
          novedadesDetectadas.unshift({ titulo: n, fecha: new Date().toLocaleTimeString() });
        }
      });
    }

    memoriaEventos = carteleraActual;
    ultimaVez = new Date().toLocaleTimeString();
    escaneosRealizados++;
    console.log(`Escaneo completado: ${memoriaEventos.length} eventos encontrados.`);

  } catch (error) {
    console.error("Error escaneo:", error.message);
  } finally {
    estaEscaneando = false;
  }
}

iniciarRobot();

app.get('/', (req, res) => {
  if (memoriaEventos.length === 0) {
    return res.send('<body style="background:#111;color:#fff;text-align:center;padding-top:50px;"><h2>Conectando y haciendo Scroll... ⏱️</h2><script>setTimeout(()=>location.reload(),8000)</script></body>');
  }

  res.send(`
    <body style="font-family: sans-serif; background: #000; color: #fff; padding: 20px;">
      <div style="border-bottom: 2px solid #B9C800; padding-bottom: 10px; margin-bottom: 20px;">
        <h2 style="color: #B9C800; margin:0;">Vigilante Abonoteatro 🔔</h2>
        <p style="margin:5px 0; color:#aaa;">Último chequeo: <strong>${ultimaVez}</strong></p>
        <p style="margin:0; font-size: 1.2em; color: #fff;">
          📊 Cartelera Actual: <strong style="color:#B9C800; font-size:1.5em;">${memoriaEventos.length}</strong> eventos detectados.
        </p>
      </div>
      
      ${novedadesDetectadas.length > 0 ? `
        <div style="background: #f1c40f; color: #000; padding: 15px; border-radius: 10px; margin-bottom: 20px; border: 4px solid #fff;">
          <h3 style="margin:0;">⚠️ ¡ALERTA: NUEVOS EVENTOS!</h3>
          <ul style="margin:10px 0;">
            ${novedadesDetectadas.map(n => `<li><strong>${n.titulo}</strong></li>`).join('')}
          </ul>
          <a href="/limpiar" style="display:inline-block; background:#000; color:#fff; padding:8px 15px; text-decoration:none; border-radius:5px; font-weight:bold;">MARCAR COMO VISTOS</a>
        </div>
      ` : `<p style="color: #666; border: 1px dashed #444; padding: 10px; border-radius: 5px;">Vigilando cada minuto... No hay novedades.</p>`}

      <div style="background: #111; padding: 15px; border-radius: 10px; border: 1px solid #333;">
        <h3 style="color:#B9C800; margin-top:0;">Lista Completa</h3>
        <ul style="font-size: 0.8em; color: #ccc; column-count: 2; list-style-type: square;">
          ${memoriaEventos.map(e => `<li>${e}</li>`).join('')}
        </ul>
      </div>
      
      <script>setTimeout(() => { location.reload(); }, 30000);</script>
    </body>
  `);
});

app.get('/limpiar', (req, res) => { novedadesDetectadas = []; res.redirect('/'); });

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log('Monitor con Auto-Scroll activo'));
