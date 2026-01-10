const puppeteer = require('puppeteer');
const express = require('express');
const app = express();

const USER = 'phe1981@gmail.com';
const PASS = 'fAsHaMp@gZie3g@';

let memoriaEventos = []; 
let novedadesDetectadas = [];
let ultimaVez = "Iniciando...";
let browser, page;

async function iniciarRobot() {
  browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--single-process']
  });
  page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  await realizarLogin();
  
  // Escaneo cada 1 minuto
  setInterval(escanearCartelera, 60 * 1000);
  escanearCartelera(); 
}

async function realizarLogin() {
  try {
    console.log("Realizando Login inicial...");
    await page.goto('https://compras.abonoteatro.com/login/', { waitUntil: 'networkidle2' });
    await page.type('#nabonadologin', USER);
    await page.type('#contrasenalogin', PASS);
    await Promise.all([
      page.click('input[value="Entrar"].buyBtn'),
      page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {})
    ]);
    console.log("Sesión iniciada.");
  } catch (e) {
    console.error("Error en login:", e.message);
  }
}

async function escanearCartelera() {
  try {
    console.log(`[${new Date().toLocaleTimeString()}] Comprobando cambios...`);
    await page.goto('https://compras.abonoteatro.com/eventos/', { waitUntil: 'networkidle2' });

    // Si nos saca al login, volvemos a entrar
    if (page.url().includes('login')) {
      await realizarLogin();
      return;
    }

    const carteleraActual = await page.evaluate(() => {
      const elementos = Array.from(document.querySelectorAll('.tribe-events-list-photo-event-wrap, .type-tribe_events, .event-item, h3'));
      return elementos.map(e => e.innerText.trim()).filter(t => t.length > 2);
    });

    // DETECTAR CAMBIOS
    if (memoriaEventos.length > 0) {
      // Buscamos qué textos hay ahora que no estaban en la memoria
      const nuevos = carteleraActual.filter(titulo => !memoriaEventos.includes(titulo));
      
      if (nuevos.length > 0) {
        nuevos.forEach(n => {
          if (!novedadesDetectadas.find(nov => nov.titulo === n)) {
            novedadesDetectadas.unshift({ titulo: n, fecha: new Date().toLocaleTimeString() });
          }
        });
        console.log("¡Novedades detectadas!", nuevos);
      }
    }

    memoriaEventos = carteleraActual;
    ultimaVez = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });

  } catch (error) {
    console.error("Error en escaneo:", error.message);
  }
}

iniciarRobot();

app.get('/', (req, res) => {
  res.send(`
    <body style="font-family: sans-serif; background: #000; color: #fff; padding: 20px;">
      <h2 style="color: #B9C800;">Alarma de Cambios Abonoteatro 🔔</h2>
      <p>Última revisión: <strong>${ultimaVez}</strong></p>
      
      ${novedadesDetectadas.length > 0 ? `
        <div style="background: #f1c40f; color: #000; padding: 15px; border-radius: 10px; margin-bottom: 20px;">
          <h3 style="margin-top:0;">⚠️ ¡ALERTA: CAMBIO DETECTADO!</h3>
          <ul>
            ${novedadesDetectadas.map(n => `<li><strong>${n.titulo}</strong> (Visto a las ${n.fecha})</li>`).join('')}
          </ul>
          <a href="/limpiar" style="display:inline-block; margin-top:10px; padding:8px; background:#000; color:#fff; text-decoration:none; border-radius:5px;">Borrar Alertas</a>
        </div>
      ` : `<p style="color: #666;">No hay cambios nuevos. Vigilando cada minuto...</p>`}

      <div style="background: #222; padding: 15px; border-radius: 10px;">
        <h3>Lista completa actual (${memoriaEventos.length} elementos)</h3>
        <ul style="font-size: 0.8em; color: #ccc;">
          ${memoriaEventos.map(e => `<li>${e}</li>`).join('')}
        </ul>
      </div>
    </body>
  `);
});

app.get('/limpiar', (req, res) => { novedadesDetectadas = []; res.redirect('/'); });

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log('Vigilante sin filtros activo'));
