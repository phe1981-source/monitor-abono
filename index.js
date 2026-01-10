const puppeteer = require('puppeteer');
const express = require('express');
const app = express();

const USER = 'phe1981@gmail.com';
const PASS = 'fAsHaMp@gZie3g@';

async function escanearAbonoteatro() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--single-process', '--no-zygote']
  });
  
  const page = await browser.newPage();
  // Aumentamos el tiempo de espera a 60 segundos
  await page.setDefaultNavigationTimeout(60000); 

  try {
    // Usamos 'domcontentloaded' que es más rápido que 'networkidle2'
    await page.goto('https://www.abonoteatro.com/mi-perfil/', { waitUntil: 'domcontentloaded' });
    
    await page.waitForSelector('#username');
    await page.type('#username', USER);
    await page.type('#password', PASS);
    await page.click('[name="login"]');
    
    await page.waitForNavigation({ waitUntil: 'domcontentloaded' });

    await page.goto('https://www.abonoteatro.com/eventos/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.event-card', { timeout: 10000 }).catch(() => {});
    
    const lista = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.event-card')).map(e => ({
        titulo: e.querySelector('h3')?.innerText || "Sin título",
        lugar: e.querySelector('.venue')?.innerText || "Madrid"
      }));
    });

    return lista;

  } catch (error) {
    console.error("Error en el robot:", error);
    return [{ titulo: "Error de conexión", lugar: "La web de Abonoteatro tarda demasiado en responder. Reintenta en unos segundos." }];
  } finally {
    await browser.close();
  }
}

app.get('/', async (req, res) => {
  const eventos = await escanearAbonoteatro();
  let html = '<h1>Monitor Abonoteatro</h1><p>Si la lista sale vacía, refresca la página (F5).</p><ol>';
  eventos.forEach(ev => {
    html += `<li><strong>${ev.titulo}</strong> - ${ev.lugar}</li>`;
  });
  html += '</ol>';
  res.send(html);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log('Servidor listo en puerto ' + PORT));
