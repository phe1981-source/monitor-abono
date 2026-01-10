const puppeteer = require('puppeteer-core');
const express = require('express');
const fs = require('fs');
const app = express();

const USER = 'phe1981@gmail.com';
const PASS = 'fAsHaMp@gZie3g@';

// 1. Preferencias de filtrado basadas en tus instrucciones
const BLACKLIST = [
  "SALA BAKAN", "TEATRO LAS VEGAS", "SALA GALILEO GALILEI", 
  "ESPACIO BROADWAY", "OFF LATINA", "HIPÓDROMO DE LA ZARZUELA", 
  "CAIXAFORUM MADRID", "SWEET SPACE MUSEUM"
];

const FAVORITOS = ["IFEMA", "PRÍNCIPE PÍO"];

async function escanearAbonoteatro() {
  const browser = await puppeteer.launch({
    // Al usar tu comando de build, Puppeteer detectará el navegador localmente
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();

  try {
    // Login en Abonoteatro
    await page.goto('https://www.abonoteatro.com/mi-perfil/', { waitUntil: 'networkidle2' });
    await page.type('#username', USER);
    await page.type('#password', PASS);
    await page.click('[name="login"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    // Navegar a eventos
    await page.goto('https://www.abonoteatro.com/eventos/', { waitUntil: 'networkidle2' });
    
    const actuales = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.event-card')).map(e => ({
        id: e.querySelector('a')?.href,
        titulo: e.querySelector('h3')?.innerText,
        lugar: e.querySelector('.venue')?.innerText || "Madrid"
      }));
    });

    // 2. Aplicamos tus filtros (Excluir lo que no te gusta)
    const filtrados = actuales.filter(ev => 
      !BLACKLIST.some(b => ev.lugar.toUpperCase().includes(b))
    );

    // 3. Comparación para detectar solo lo nuevo
    let historial = [];
    if (fs.existsSync('/tmp/vistos.json')) {
      historial = JSON.parse(fs.readFileSync('/tmp/vistos.json'));
    }
    const idsVistos = new Set(historial.map(h => h.id));

    const resultado = filtrados.map(ev => ({
      ...ev,
      esNuevo: !idsVistos.has(ev.id),
      esPrioridad: FAVORITOS.some(f => ev.lugar.toUpperCase().includes(f))
    }));

    // Guardar historial temporal
    fs.writeFileSync('/tmp/vistos.json', JSON.stringify(filtrados));
    return resultado;

  } catch (error) {
    console.error("Error en el escaneo:", error);
    return [];
  } finally {
    await browser.close();
  }
}

// 4. Interfaz visual para tu móvil
app.get('/', async (req, res) => {
  const lista = await escanearAbonoteatro();
  res.send(`
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: sans-serif; padding: 15px; background: #f0f2f5; }
          .card { background: white; padding: 15px; margin-bottom: 12px; border-radius: 10px; border-left: 8px solid #ccc; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
          .nuevo { border-left-color: #d93025; background: #fff8f7; }
          .prioridad { border-left-color: #f4b400; }
          .badge { font-size: 0.8em; padding: 3px 8px; border-radius: 4px; color: white; font-weight: bold; display: inline-block; margin-top: 5px; }
          .badge-nuevo { background: #d93025; }
          .badge-prioridad { background: #f4b400; color: black; }
          h1 { color: #202124; font-size: 1.4em; text-align: center; }
          button { width: 100%; padding: 15px; background: #1a73e8; color: white; border: none; border-radius: 8px; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>AbonoMonitor (phe1981)</h1>
        <button onclick="location.reload()">ACTUALIZAR LISTADO</button>
        <br><br>
        ${lista.map(e => `
          <div class="card ${e.esNuevo ? 'nuevo' : ''} ${e.esPrioridad ? 'prioridad' : ''}">
            <strong>${e.titulo}</strong><br>
            <small>${e.lugar}</small><br>
            ${e.esNuevo ? '<span class="badge badge-nuevo">¡NUEVO!</span>' : ''}
            ${e.esPrioridad ? '<span class="badge badge-prioridad">⭐ PRIORIDAD (IFEMA/P.PIO)</span>' : ''}
          </div>
        `).join('')}
      </body>
    </html>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Robot listo'));
