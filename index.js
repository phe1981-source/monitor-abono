const puppeteer = require('puppeteer');
const express = require('express');
const app = express();

const USER = 'phe1981@gmail.com';
const PASS = 'fAsHaMp@gZie3g@';

let isScraping = false;

async function escanearAbonoteatro() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--single-process']
  });
  
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  try {
    console.log("Accediendo a COMPRAS.abonoteatro.com...");
    await page.goto('https://compras.abonoteatro.com/login/', { waitUntil: 'networkidle2', timeout: 60000 });
    
    console.log("Buscando campos de login...");
    await page.waitForSelector('input[type="text"], #username', { timeout: 30000 });
    
    await page.type('input[type="text"]', USER);
    await page.type('input[type="password"]', PASS);
    
    console.log("Entrando...");
    await Promise.all([
      page.click('button[type="submit"], .btn-login'),
      page.waitForNavigation({ waitUntil: 'networkidle2' })
    ]);

    console.log("Navegando a la cartelera...");
    await page.goto('https://compras.abonoteatro.com/eventos/', { waitUntil: 'networkidle2' });
    
    const eventos = await page.evaluate(() => {
      const titulos = Array.from(document.querySelectorAll('h3, .event-title, .card-title'));
      return titulos.map(t => ({
        titulo: t.innerText.trim(),
        lugar: t.parentElement?.querySelector('.venue, .event-location')?.innerText || "Consultar"
      })).filter(e => e.titulo.length > 2);
    });

    return eventos;

  } catch (error) {
    console.error("Error en el proceso:", error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

app.get('/', async (req, res) => {
  if (isScraping) return res.send("<h1>El robot está trabajando...</h1><p>Refresca en 30 segundos.</p>");
  isScraping = true;
  
  try {
    const lista = await escanearAbonoteatro();
    let html = `
      <body style="font-family: Arial; padding: 20px;">
        <h1>Monitor Abonoteatro</h1>
        <hr>
        <ol>
          ${lista.map(ev => `<li><strong>${ev.titulo}</strong> - ${ev.lugar}</li>`).join('')}
        </ol>
      </body>`;
    res.send(html);
  } catch (e) {
    res.status(500).send(`<h1>Error</h1><p>No se pudo conectar: ${e.message}</p>`);
  } finally {
    isScraping = false;
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log('Servidor listo en puerto ' + PORT));
