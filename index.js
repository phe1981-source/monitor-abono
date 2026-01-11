const puppeteer = require('puppeteer');
const express = require('express');
const app = express();

const USER = 'phe1981@gmail.com';
const PASS = 'fAsHaMp@gZie3g@';

// Variables de control
let totalEventos = 0;
let logEstado = "Iniciando secuencia...";
let ultimaActualizacion = "Nunca";

async function cicloAgileEstructurado() {
  console.log("--- Iniciando Nueva Secuencia ---");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1000 });

  try {
    // 1. LOAD PAGE
    logEstado = "Cargando página...";
    await page.goto('https://compras.abonoteatro.com/login/', { waitUntil: 'domcontentloaded', timeout: 60000 });

    // 2. PICTURE BEFORE LOGIN (Desactivado por solicitud)
    // await page.screenshot({ encoding: 'base64' });

    // 3. MANAGER COOKIES
    logEstado = "Gestionando cookies...";
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => 
        b.innerText.includes('Aceptar cookies') || b.innerText.includes('Aceptar')
      );
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 2000));

    // 4. AUTOMATIC LOGIN
    logEstado = "Escribiendo credenciales...";
    await page.type('#nabonadologin', USER);
    await page.type('#contrasenalogin', PASS);

    // 5. CLICK ON ENTRAR
    logEstado = "Pulsando entrar...";
    await Promise.all([
      page.click('input[value="Entrar"].buyBtn'),
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {})
    ]);

    // 6. NAVEGACIÓN A CARTELERA (Obligatorio para que el contador funcione)
    logEstado = "Accediendo a cartelera...";
    await page.goto('https://compras.abonoteatro.com/teatro/', { waitUntil: 'domcontentloaded' }).catch(() => {});
    
    // Espera para que el iframe cargue los datos
    await new Promise(r => setTimeout(r, 10000)); 

    // 7. COUNT VENUES
    logEstado = "Contando eventos reales...";
    const frameElement = await page.$('iframe');
    if (frameElement) {
      const frame = await frameElement.contentFrame();
      await frame.waitForSelector('.tribe-events-list-event-title', { timeout: 15000 }).catch(() => {});

      totalEventos = await frame.evaluate(() => {
        // Solo contamos títulos con enlace (evita el menú desplegable de recintos)
        const titulosCartelera = document.querySelectorAll('.tribe-events-list-event-title a, .event-wrapper h3 a');
        return titulosCartelera.length;
      });
    }
    
    logEstado = "Secuencia completada.";
    ultimaActualizacion = new Date().toLocaleTimeString('es-ES');

  } catch (error) {
    logEstado = "Error: " + error.message;
  } finally {
    await browser.close();
  }
}

// Ejecutar cada 10 minutos
setInterval(cicloAgileEstructurado, 600000);
cicloAgileEstructurado();

// Interfaz minimalista sin imágenes
app.get('/', (req, res) => {
  res.send(`
    <body style="background:#000; color:#fff; font-family:monospace; padding:40px; text-align:center;">
      <div style="max-width:500px; margin:auto; border:2px solid #B9C800; border-radius:20px; padding:30px; background:#111;">
        <h2 style="color:#B9C800;">MONITOR AGILE</h2>
        <hr style="border:0; border-top:1px solid #333; margin:20px 0;">
        <p style="font-size:1.2em;">Estado: <span style="color:#fff;">${logEstado}</span></p>
        <div style="margin:40px 0;">
          <p style="font-size:1em; color:#888; margin-bottom:0;">EVENTOS ACTIVOS</p>
          <p style="font-size:5em; font-weight:bold; color:#B9C800; margin:0;">${totalEventos}</p>
        </div>
        <p style="color:#444;">Última actualización: ${ultimaActualizacion}</p>
      </div>
      <script>setTimeout(() => location.reload(), 30000);</script>
    </body>
  `);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log('Monitor Agile desplegado'));
