const puppeteer = require('puppeteer');
const express = require('express');
const app = express();

const USER = 'phe1981@gmail.com';
const PASS = 'fAsHaMp@gZie3g@';

// Evitamos que el servidor colapse si hay varias peticiones
let isScraping = false;

async function escanearAbonoteatro() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--single-process'
    ]
  });
  
  const page = await browser.newPage();
  
  // Bloqueo de recursos pesados para ahorrar RAM
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if (['image', 'font', 'stylesheet'].includes(req.resourceType())) {
      req.abort();
    } else {
      req.continue();
    }
  });

  try {
    await page.setDefaultNavigationTimeout(60000);
    console.log("Iniciando sesión...");
    await page.goto('https://www.abonoteatro.com/mi-perfil/', { waitUntil: 'domcontentloaded' });
    
    await page.waitForSelector('#username', { timeout: 30000 });
    await page.type('#username', USER);
    await page.type('#password', PASS);
    await page.click('[name="login"]');
    
    await page.waitForNavigation({ waitUntil: 'domcontentloaded' });
    console.log("Login exitoso, extrayendo eventos...");

    await page.goto('https://www.abonoteatro.com/eventos/', { waitUntil: 'domcontentloaded' });
    
    const lista = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('h3')).map(h3 => ({
        titulo: h3.innerText
      })).filter(e => e.titulo.length > 3);
    });

    return lista;

  } finally {
    await browser.close();
  }
}

app.get('/', async (req, res) => {
  if (isScraping) {
    return res.status(503).send('<h1>El robot está trabajando</h1><p>Por favor, espera 30 segundos y refresca la página.</p>');
  }

  isScraping = true;
  console.log("Petición recibida...");

  try {
    // Timeout de seguridad de 70 segundos
    const eventos = await Promise.race([
      escanearAbonoteatro(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('Tiempo de espera agotado')), 75000))
    ]);

    let html = '<h1>Monitor Abonoteatro</h1><ol>';
    eventos.forEach(ev => html += `<li>${ev.titulo}</li>`);
    html += '</ol>';
    res.send(html);

  } catch (e) {
    console.error('Error:', e.message);
    res.status(500).send('<h1>Error del servidor</h1><p>' + e.message + '</p>');
  } finally {
    isScraping = false;
  }
});

// Manejo de errores globales para que el servidor no se apague
process.on('unhandledRejection', err => console.error('REJECTION:', err));
process.on('uncaughtException', err => console.error('EXCEPTION:', err));

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log('Servidor activo en puerto ' + PORT));
