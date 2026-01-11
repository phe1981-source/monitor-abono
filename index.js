const puppeteer = require('puppeteer');
const express = require('express');
const app = express();

const USER = 'phe1981@gmail.com';
const PASS = 'fAsHaMp@gZie3g@';

let imgResultado = "";
let totalEventos = 0;
let logEstado = "Iniciando...";
let ultimaSincro = "Nunca";

async function ejecutarCicloAgile() {
  console.log("--- Ejecutando Ciclo Agile ---");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1000 });

  try {
    // 1. GESTOR DE COOKIES Y LOGIN AUTOMÁTICO
    logEstado = "Accediendo y gestionando cookies...";
    await page.goto('https://compras.abonoteatro.com/login/', { waitUntil: 'networkidle2' });

    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Aceptar cookies'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 2000));

    await page.type('#nabonadologin', USER);
    await page.type('#contrasenalogin', PASS);
    
    await Promise.all([
      page.click('input[value="Entrar"].buyBtn'),
      page.waitForNavigation({ waitUntil: 'networkidle2' })
    ]);

    // 2. FOTO DESPUÉS DEL LOGIN Y CONTADOR
    logEstado = "Entrando en cartelera...";
    await page.goto('https://compras.abonoteatro.com/teatro/', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 10000)); // Espera para carga de cartelera

    // Captura de pantalla del resultado
    imgResultado = await page.screenshot({ encoding: 'base64' });

    // Conteo de eventos dentro del iframe
    const frameElement = await page.$('iframe');
    if (frameElement) {
      const frame = await frameElement.contentFrame();
      totalEventos = await frame.evaluate(() => {
        // Seleccionamos los títulos oficiales de los eventos
        const titulos = document.querySelectorAll('.tribe-events-list-event-title');
        return titulos.length;
      });
      logEstado = "Sincronizado correctamente";
    } else {
      logEstado = "Error: No se detectó el catálogo (iframe)";
    }

    ultimaSincro = new Date().toLocaleTimeString('es-ES');

  } catch (error) {
    logEstado = "Error en el ciclo: " + error.message;
    console.error(error);
  } finally {
    await browser.close();
  }
}

// Ejecutar cada 15 minutos
setInterval(ejecutarCicloAgile, 900000);
ejecutarCicloAgile();

app.get('/', (req, res) => {
  res.send(`
    <body style="background:#111; color:#fff; font-family:sans-serif; text-align:center; padding:20px;">
      <h2 style="color:#B9C800;">Panel Agile: Login + Contador</h2>
      
      <div style="background:#222; padding:20px; border-radius:15px; display:inline-block; margin-bottom:20px; border:1px solid #444;">
        <p style="margin:0; font-size:0.9em; color:#888;">Estado: ${logEstado}</p>
        <p style="font-size:3.5em; font-weight:bold; margin:10px 0; color:#B9C800;">${totalEventos}</p>
        <p style="margin:0; color:#666;">Eventos detectados</p>
        <p style="margin-top:10px; font-size:0.7em;">Última vez: ${ultimaSincro}</p>
      </div>

      <div>
        <h3 style="color:#888;">Foto después del Login (Verificación)</h3>
        ${imgResultado ? 
          `<img src="data:image/png;base64,${imgResultado}" style="width:80%; max-width:800px; border:3px solid #333; border-radius:10px;">` : 
          "<p>Cargando captura...</p>"}
      </div>
      
      <script>setTimeout(() => location.reload(), 30000);</script>
    </body>
  `);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log('Monitor Agile listo en puerto ' + PORT));
