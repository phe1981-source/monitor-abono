const puppeteer = require('puppeteer');
const express = require('express');
const app = express();

// --- CONFIGURACIÓN ---
const USER = 'phe1981@gmail.com';
const PASS = 'fAsHaMp@gZie3g@';

let memoriaEventos = []; 
let novedadesDetectadas = [];
let ultimaVez = "Iniciando...";
let escaneosRealizados = 0;
let browser, page;
let estaEscaneando = false;

// --- MOTOR DEL ROBOT ---
async function iniciarRobot() {
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--single-process']
    });
    page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    await realizarLogin();
    
    // Ciclo de 1 minuto
    setInterval(escanearCartelera, 60 * 1000);
    escanearCartelera(); 
  } catch (e) {
    console.error("Error al iniciar navegador:", e.message);
  }
}

async function realizarLogin() {
  try {
    console.log("Haciendo login inicial...");
    await page.goto('https://compras.abonoteatro.com/login/', { waitUntil: 'networkidle2' });
    await page.type('#nabonadologin', USER);
    await page.type('#contrasenalogin', PASS);
    await Promise.all([
      page.click('input[value="Entrar"].buyBtn'),
      page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {})
    ]);
    console.log("Sesión activa.");
  } catch (e) {
    console.error("Fallo en login:", e.message);
  }
}

async function escanearCartelera() {
  if (estaEscaneando) return;
  estaEscaneando = true;

  try {
    console.log(`[${new Date().toLocaleTimeString()}] Escaneando...`);
    await page.goto('https://compras.abonoteatro.com/eventos/', { waitUntil: 'networkidle2' });

    if (page.url().includes('login')) {
      console.log("Sesión caducada, re-logueando...");
      await realizarLogin();
      estaEscaneando = false;
      return;
    }

    const carteleraActual = await page.evaluate(() => {
      // Selector amplio para capturar cualquier cambio de texto en la lista
      const items = Array.from(document.querySelectorAll('.tribe-events-list-photo-event-wrap, .event-item, h3, .entry-title'));
      return items.map(i => i.innerText.trim()).filter(t => t.length > 3);
    });

    if (memoriaEventos.length > 0) {
      const nuevos = carteleraActual.filter(titulo => !memoriaEventos.includes(titulo));
      if (nuevos.length > 0) {
        nuevos.forEach(n => {
          if (!novedadesDetectadas.find(nov => nov.titulo === n)) {
            novedadesDetectadas.unshift({ titulo: n, fecha: new Date().toLocaleTimeString() });
          }
        });
      }
    }

    memoriaEventos = carteleraActual;
    ultimaVez = new Date().toLocaleTimeString();
    escaneosRealizados++;

  } catch (error) {
    console.error("Error en escaneo:", error.message);
  } finally {
    estaEscaneando = false;
  }
}

iniciarRobot();

// --- INTERFAZ WEB ---
app.get('/', (req, res) => {
  if (memoriaEventos.length === 0) {
    return res.send(`
      <body style="font-family:sans-serif; background:#111; color:#fff; text-align:center; padding-top:50px;">
        <h2>Iniciando Vigilante Total... ⏱️</h2>
        <p>Conectando con Abonoteatro. Por favor, espera...</p>
        <script>setTimeout(() => { location.reload(); }, 10000);</script>
      </body>
    `);
  }

  res.send(`
    <body style="font-family: sans-serif; background: #000; color: #fff; padding: 20px;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h2 style="color: #B9C800; margin:0;">Alarma de Cambios 🔔</h2>
        <span style="background:#333; padding:5px 10px; border-radius:15px; font-size:0.8em;">Vueltas: ${escaneosRealizados}</span>
      </div>
      <p style="font-size:0.9em; color:#888;">Actualizado: ${ultimaVez}</p>
      
      ${novedadesDetectadas.length > 0 ? `
        <div style="background: #f1c40f; color: #000; padding: 15px; border-radius: 10px; margin-bottom: 20px; border: 4px solid #fff;">
          <h3 style="margin:0;">⚠️ ¡NUEVO EVENTO DETECTADO!</h3>
          <ul style="margin:10px 0;">
            ${novedadesDetectadas.map(n => `<li><strong>${n.titulo}</strong></li>`).join('')}
          </ul>
          <a href="/limpiar" style="display:inline-block; background:#000; color:#fff; padding:8px 15px; text-decoration:none; border-radius:5px; font-weight:bold;">BORRAR AVISO</a>
        </div>
      ` : `<p style="color: #666; border: 1px dashed #444; padding: 10px; border-radius: 5px;">Vigilando cada minuto... No hay cambios.</p>`}

      <div style="background: #111; padding: 15px; border-radius: 10px; border: 1px solid #333;">
        <h3>Cartelera Actual (${memoriaEventos.length})</h3>
        <ul style="font-size: 0.8em; color: #ccc; line-height:1.4;">
          ${memoriaEventos.map(e => `<li>${e}</li>`).join('')}
        </ul>
      </div>
      
      <script>setTimeout(() => { location.reload(); }, 30000);</script>
    </body>
  `);
});

app.get('/limpiar', (req, res) => {
  novedadesDetectadas = [];
  res.redirect('/');
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log('Servidor corregido y activo'));
