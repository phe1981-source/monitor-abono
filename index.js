const puppeteer = require('puppeteer');
const express = require('express');
const app = express();

const USER = 'phe1981@gmail.com';
const PASS = 'fAsHaMp@gZie3g@';

let memoriaEventos = []; 
let logEstado = "Monitor iniciado.";
let ultimaSincro = "Nunca";

async function escaneoResistente() {
  console.log("Iniciando escaneo...");
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox', 
      '--disable-blink-features=AutomationControlled', // Evita que detecten el robot
      '--disable-dev-shm-usage'
    ]
  });
  
  const page = await browser.newPage();
  
  // User-Agent real para que el servidor no nos bloquee
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  try {
    logEstado = "Paso 1: Login...";
    await page.goto('https://compras.abonoteatro.com/login/', { waitUntil: 'networkidle2' });
    await page.type('#nabonadologin', USER);
    await page.type('#contrasenalogin', PASS);
    await Promise.all([
      page.click('input[value="Entrar"].buyBtn'),
      page.waitForNavigation({ waitUntil: 'networkidle2' })
    ]);

    logEstado = "Paso 2: Cargando cartelera...";
    await page.goto('https://compras.abonoteatro.com/teatro/', { waitUntil: 'networkidle2' });
    
    // Esperamos al iframe
    const frameElement = await page.waitForSelector('iframe', { timeout: 30000 });
    const frame = await frameElement.contentFrame();

    // ESPERA CRÍTICA: Esperamos a que el catálogo dibuje algo, lo que sea
    logEstado = "Paso 3: Esperando contenido real...";
    await new Promise(r => setTimeout(r, 15000)); // 15 segundos de cortesía

    const eventos = await frame.evaluate(() => {
      // Buscamos títulos oficiales O cualquier texto en negrita/enlace que parezca una obra
      const selectores = '.tribe-events-list-event-title, .title, h3, h4, b';
      const items = Array.from(document.querySelectorAll(selectores));
      
      return items
        .map(el => el.innerText.trim())
        .filter(t => t.length > 8 && !t.includes('Ver sesiones') && !t.includes('Abonoteatro'));
    });

    if (eventos.length > 0) {
      memoriaEventos = [...new Set(eventos)];
      ultimaSincro = new Date().toLocaleTimeString();
      logEstado = `Éxito: ${memoriaEventos.length} eventos capturados.`;
    } else {
      logEstado = "Error: El servidor envió una página vacía (Anti-Bot).";
    }

  } catch (error) {
    logEstado = "Fallo: " + error.message;
    console.error(logEstado);
  } finally {
    await browser.close();
  }
}

// Escanear cada 15 minutos
setInterval(escaneoResistente, 900000);
escaneoResistente();

app.get('/', (req, res) => {
  res.send(`
    <body style="font-family:sans-serif; background:#000; color:#fff; padding:20px;">
      <h2 style="color:#B9C800;">Monitor de Diagnóstico Avanzado</h2>
      <p>Estado: <strong style="color:#f1c40f;">${logEstado}</strong></p>
      <p>Sincronizado: ${ultimaSincro}</p>
      <hr>
      <ul>
        ${memoriaEventos.length > 0 
          ? memoriaEventos.map(e => `<li>${e}</li>`).join('') 
          : "<li>Sin datos. Esperando ciclo de 15 min o reinicio...</li>"}
      </ul>
      <script>setTimeout(() => location.reload(), 30000);</script>
    </body>
  `);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log('Servidor activo'));
