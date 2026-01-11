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

// 2. PICTURE BEFORE LOGIN (Comentado por solicitud)
    // logEstado = "Captura 1: Antes del login...";
    // imgAntes = await page.screenshot({ encoding: 'base64' });

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

// 6. NAVEGACIÓN A CARTELERA (Necesario para contar)
    logEstado = "Accediendo a cartelera...";
    // Navegamos a la URL donde están los espectáculos
    await page.goto('https://compras.abonoteatro.com/teatro/', { 
      waitUntil: 'domcontentloaded' 
    }).catch(() => {});
    
    // Espera crucial: Si quitamos esto, el bot intenta contar 
    // antes de que los eventos aparezcan en pantalla.
    await new Promise(r => setTimeout(r, 10000));

// 7. AFTER PICTURE, COUNT VENUES (Conteo real sin filtros de contenido)
    logEstado = "Contando eventos reales...";
    const frameElement = await page.$('iframe');
    if (frameElement) {
      const frame = await frameElement.contentFrame();
      
      // Esperamos a que la cartelera cargue los elementos visuales
      await frame.waitForSelector('.tribe-events-list-event-title', { timeout: 15000 }).catch(() => {});

      totalEventos = await frame.evaluate(() => {
        // Seleccionamos solo los títulos que tienen un enlace (esto descarta el menú de recintos)
        // y que están dentro de los contenedores de la cartelera
        const titulosCartelera = document.querySelectorAll('.tribe-events-list-event-title a, .event-wrapper h3 a');
        
        return titulosCartelera.length;
      });
    }
    
    logEstado = "Secuencia completada.";

  } catch (error) {
    logEstado = "Error en secuencia: " + error.message;
    try { if(!imgDespues) imgDespues = await page.screenshot({ encoding: 'base64' }); } catch(e) {}
  } finally {
    await browser.close();
  }
}

setInterval(cicloAgileEstructurado, 600000);
cicloAgileEstructurado();

app.get('/', (req, res) => {
  res.send(`
    <body style="background:#000; color:#fff; font-family:monospace; padding:20px; text-align:center;">
      <h2 style="color:#B9C800;">Monitor Agile: Secuencia de 7 Pasos</h2>
      <div style="background:#111; padding:10px; border:1px solid #333; margin-bottom:20px;">
        <p>Estado: <strong>${logEstado}</strong></p>
        <p style="font-size:2.5em; margin:10px 0;">Eventos: <span style="color:#B9C800;">${totalEventos}</span></p>
      </div>
      
      <div style="display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
        <div style="flex:1; min-width:400px;">
          <h3 style="color:#666;">1. Foto Antes (Login/Cookies)</h3>
          ${imgAntes ? `<img src="data:image/png;base64,${imgAntes}" style="width:100%; border:2px solid #444; border-radius:8px;">` : "<p>Cargando...</p>"}
        </div>
        <div style="flex:1; min-width:400px;">
          <h3 style="color:#B9C800;">2. Foto Después (Cartelera)</h3>
          ${imgDespues ? `<img src="data:image/png;base64,${imgDespues}" style="width:100%; border:2px solid #B9C800; border-radius:8px;">` : "<p>Cargando...</p>"}
        </div>
      </div>
      <script>setTimeout(() => location.reload(), 20000);</script>
    </body>
  `);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log('Monitor Agile desplegado'));
