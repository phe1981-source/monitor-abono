const puppeteer = require('puppeteer');
const express = require('express');
const app = express();

const USER = 'phe1981@gmail.com';
const PASS = 'fAsHaMp@gZie3g@';

let memoriaEventos = []; 
let logEstado = "Monitor listo.";

async function escaneoSimple() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--single-process']
  });
  const page = await browser.newPage();
  
  try {
    logEstado = "Paso 1: Login...";
    await page.goto('https://compras.abonoteatro.com/login/', { waitUntil: 'networkidle2' });
    await page.type('#nabonadologin', USER);
    await page.type('#contrasenalogin', PASS);
    await page.click('input[value="Entrar"].buyBtn');
    await page.waitForNavigation();

    logEstado = "Paso 2: Entrando en Cartelera...";
    await page.goto('https://compras.abonoteatro.com/teatro/', { waitUntil: 'networkidle2' });
    
    // Esperamos 10 segundos fijos. Sin condiciones. Que cargue lo que quiera.
    logEstado = "Esperando carga total (10 seg)...";
    await new Promise(r => setTimeout(r, 10000));

    const frameElement = await page.$('iframe');
    const frame = await frameElement.contentFrame();

    // EXTRACCIÓN UNIVERSAL: Sacamos todos los enlaces y negritas (donde suelen estar los títulos)
    const eventos = await frame.evaluate(() => {
      const todos = Array.from(document.querySelectorAll('a, b, h2, h3, h4, .tribe-events-list-event-title'));
      return todos
        .map(el => el.innerText.trim())
        .filter(texto => texto.length > 10 && !texto.includes('Ver sesiones') && !texto.includes('Comprar'));
    });

    memoriaEventos = [...new Set(eventos)];
    logEstado = `Éxito: ${memoriaEventos.length} elementos encontrados.`;

  } catch (error) {
    logEstado = "Error: " + error.message;
  } finally {
    await browser.close();
  }
}

// Escanear cada 10 minutos
setInterval(escaneoSimple, 600000);
escaneoSimple();

app.get('/', (req, res) => {
  res.send(`
    <body style="font-family:sans-serif; background:#000; color:#fff; padding:20px;">
      <h2>Monitor Simplificado</h2>
      <p>Estado: <strong>${logEstado}</strong></p>
      <hr>
      <ul style="font-size:0.8em;">
        ${memoriaEventos.length > 0 
          ? memoriaEventos.map(e => `<li>${e}</li>`).join('') 
          : "<li>Buscando... refresca en 1 minuto.</li>"}
      </ul>
      <script>setTimeout(() => location.reload(), 30000);</script>
    </body>
  `);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log('Monitor activo'));
