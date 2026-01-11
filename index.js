const puppeteer = require('puppeteer');
const express = require('express');
const app = express();

const USER = 'phe1981@gmail.com';
const PASS = 'fAsHaMp@gZie3g@';

let imgAntes = ""; 
let imgDespues = "";
let totalEventos = 0;
let logEstado = "Iniciando secuencia...";

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

    // 2. PICTURE BEFORE LOGIN
    logEstado = "Captura 1: Antes del login...";
    imgAntes = await page.screenshot({ encoding: 'base64' });

    // 3. MANAGER COOKIES
    logEstado = "Gestionando cookies...";
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => 
        b.innerText.includes('Aceptar cookies') || b.innerText.includes('Aceptar')
      );
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 2000));

    // 4. AUTOMATIC LOGIN (Enter user and pass)
    logEstado = "Escribiendo credenciales...";
    await page.type('#nabonadologin', USER);
    await page.type('#contrasenalogin', PASS);

    // 5. CLICK ON ENTRAR
    logEstado = "Pulsando entrar...";
    await Promise.all([
      page.click('input[value="Entrar"].buyBtn'),
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => console.log("Navegación lenta, continuando..."))
    ]);

    // 6. PICTURE AFTER LOGIN
    logEstado = "Accediendo a cartelera...";
    // Intentamos ir a la cartelera directamente por si el login nos dejó en la home
    await page.goto('https://compras.abonoteatro.com/teatro/', { waitUntil: 'domcontentloaded' }).catch(() => {});
    await new Promise(r => setTimeout(r, 10000)); // Espera necesaria para el catálogo
    
    logEstado = "Captura 2: Después del login...";
    imgDespues = await page.screenshot({ encoding: 'base64' });

    // 7. AFTER PICTURE, COUNT VENUES
    logEstado = "Contando eventos...";
    const frameElement = await page.$('iframe');
    if (frameElement) {
      const frame = await frameElement.contentFrame();
      totalEventos = await frame.evaluate(() => {
        return document.querySelectorAll('.tribe-events-list-event-title').length;
      });
    }
    
    logEstado = "Secuencia completada.";

  } catch (error) {
    logEstado = "Error en secuencia: " + error.message;
    // Captura de pantalla del error si es posible
    try { if(!imgDespues) imgDespues = await page.screenshot({ encoding: 'base64' }); } catch(e) {}
  } finally {
    await browser.close();
  }
}

// Ejecutar cada 10 minutos
setInterval(cicloAgileEstructurado, 600000);
cicloAgileEstructurado();

app.get('/', (req, res) => {
  res.send(`
    <body style="background:#000; color:#fff; font-family:monospace; padding:20px; text-align:center;">
      <h2 style="color:#B9C800;">Monitor Agile: Secuencia de 7 Pasos</h2>
      <div style="background:#111; padding:10px; border:1px solid #333; margin-bottom:20px;">
        <p>Estado: <strong>${logEstado}</strong></p>
        <p style="font-size:2em;">Eventos: <span style="color:#B9C800;">${totalEventos}</span></p>
      </div>
      
      <div style="display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
        <div style="flex:1; min-width:400px;">
          <h3>1. Foto Antes</h3>
          ${imgAntes ? `<img src="data:image/png;base64,${imgAntes}" style="width:100%; border:2px solid #444;">` : "<p>Cargando...</p>"}
        </div>
        <div style="flex:1; min-width:400px;">
          <h3>2. Foto Después</h3>
          ${imgDespues ? `<img src="data:image/png;base64,${imgDespues}" style="width:100%; border:2px solid #B9C800;">` : "<p>Cargando...</p>"}
        </div>
      </div>
      <script>setTimeout(() => location.reload(), 20000);</script>
    </body>
  `);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log('Monitor Agile desplegado'));
