const puppeteer = require('puppeteer');
const express = require('express');
const app = express();

const USER = 'phe1981@gmail.com';
const PASS = 'fAsHaMp@gZie3g@';

async function escanearAbonoteatro() {
  const browser = await puppeteer.launch({
    // Ruta directa al ejecutable descargado por npx en Render
    executablePath: '/opt/render/.cache/puppeteer/chrome/linux-131.0.6778.204/chrome-linux64/chrome',
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--single-process', '--no-zygote']
  });
  
  const page = await browser.newPage();

  try {
    await page.goto('https://www.abonoteatro.com/mi-perfil/', { waitUntil: 'networkidle2' });
    await page.type('#username', USER);
    await page.type('#password', PASS);
    await page.click('[name="login"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    await page.goto('https://www.abonoteatro.com/eventos/', { waitUntil: 'networkidle2' });
    
    const lista = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.event-card')).map(e => ({
        titulo: e.querySelector('h3')?.innerText || "Sin título",
        lugar: e.querySelector('.venue')?.innerText || "Madrid"
      }));
    });

    return lista;

  } catch (error) {
    console.error("Error en el robot:", error);
    return [{ titulo: "Error", lugar: error.message }];
  } finally {
    await browser.close();
  }
}

app.get('/', async (req, res) => {
  const eventos = await escanearAbonoteatro();
  let html = '<h1>AbonoMonitor (phe1981)</h1><ol>';
  eventos.forEach(ev => {
    html += `<li><strong>${ev.titulo}</strong> - ${ev.lugar}</li>`;
  });
  html += '</ol>';
  res.send(html);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Servidor en puerto ' + PORT));
