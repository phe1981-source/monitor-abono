const puppeteer = require('puppeteer');
const express = require('express');
const app = express();

const USER = 'phe1981@gmail.com';
const PASS = 'fAsHaMp@gZie3g@';

// Variables de control
let totalEventos = 0;
let listaEventos = []; // Nueva variable para el listado
let logEstado = "Iniciando...";
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
    logEstado = "Cargando login...";
    await page.goto('https://compras.abonoteatro.com/login/', { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Gestión de Cookies
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => 
        b.innerText.includes('Aceptar cookies') || b.innerText.includes('Aceptar')
      );
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 2000));

    // Login
    await page.type('#nabonadologin', USER);
    await page.type('#contrasenalogin', PASS);
    await Promise.all([
      page.click('input[value="Entrar"].buyBtn'),
      page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {})
    ]);

    // Navegación a Cartelera
    logEstado = "Accediendo a cartelera...";
    await page.goto('https://compras.abonoteatro.com/teatro/', { waitUntil: 'domcontentloaded' }).catch(() => {});
    await new Promise(r => setTimeout(r, 10000)); 

    // 7. COUNT & LIST VENUES
    logEstado = "Extrayendo listado de eventos...";
    const frameElement = await page.$('iframe');
    if (frameElement) {
      const frame = await frameElement.contentFrame();
      await frame.waitForSelector('.tribe-events-list-event-title', { timeout: 15000 }).catch(() => {});

      const data = await frame.evaluate(() => {
        // Buscamos los contenedores de cada evento
        const items = document.querySelectorAll('.tribe-events-list-event-wrapper, .event-wrapper, .type-tribe_events');
        
        return Array.from(items).map(item => {
          const tituloElement = item.querySelector('.tribe-events-list-event-title a, h3 a');
          const recintoElement = item.querySelector('.tribe-venue, .venue, .tribe-events-venue-details');
          
          return {
            titulo: tituloElement ? tituloElement.innerText.trim() : "Sin título",
            recinto: recintoElement ? recintoElement.innerText.trim() : "Recinto no especificado"
          };
        }).filter(ev => ev.titulo !== "Sin título"); // Limpiamos posibles falsos positivos
      });

      listaEventos = data;
      totalEventos = data.length;
    }
    
    logEstado = "Secuencia completada.";
    ultimaActualizacion = new Date().toLocaleTimeString('es-ES');

  } catch (error) {
    logEstado = "Error: " + error.message;
  } finally {
    await browser.close();
  }
}

setInterval(cicloAgileEstructurado, 600000);
cicloAgileEstructurado();

app.get('/', (req, res) => {
  res.send(`
    <body style="background:#000; color:#fff; font-family:monospace; padding:20px;">
      <div style="max-width:800px; margin:auto; border:2px solid #B9C800; border-radius:15px; padding:20px; background:#111; text-align:center;">
        <h2 style="color:#B9C800;">MONITOR AGILE + LISTADO</h2>
        <p>Estado: ${logEstado} | Actualizado: ${ultimaActualizacion}</p>
        <p style="font-size:3em; font-weight:bold; color:#B9C800; margin:10px 0;">${totalEventos}</p>
        
        <div style="text-align:left; margin-top:30px; max-height:500px; overflow-y:auto; border:1px solid #333; padding:10px; background:#050505;">
          <table style="width:100%; border-collapse:collapse; font-size:0.85em;">
            <thead>
              <tr style="border-bottom:2px solid #B9C800; color:#B9C800;">
                <th style="padding:10px; text-align:left;">Evento</th>
                <th style="padding:10px; text-align:left;">Recinto</th>
              </tr>
            </thead>
            <tbody>
              ${listaEventos.map((ev, i) => `
                <tr style="border-bottom:1px solid #222;">
                  <td style="padding:8px;">${i+1}. ${ev.titulo}</td>
                  <td style="padding:8px; color:#888;">${ev.recinto}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          ${listaEventos.length === 0 ? '<p style="text-align:center; padding:20px;">No hay eventos en la lista aún.</p>' : ''}
        </div>
      </div>
      <script>setTimeout(() => location.reload(), 30000);</script>
    </body>
  `);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log('Monitor con listado activo'));
