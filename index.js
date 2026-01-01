const puppeteer = require('puppeteer');
const express = require('express');
const fs = require('fs');
const app = express();

const USER = 'phe1981@gmail.com';
const PASS = 'fAsHaMp@gZie3g@';

async function buscarNovedades() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  try {
    await page.goto('https://www.abonoteatro.com/mi-perfil/', { waitUntil: 'networkidle2' });
    await page.type('#username', USER);
    await page.type('#password', PASS);
    await page.click('[name="login"]');
    await page.waitForNavigation();
    await page.goto('https://www.abonoteatro.com/eventos/', { waitUntil: 'networkidle2' });
    
    const actuales = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.event-card')).map(e => ({
        id: e.querySelector('a')?.href || Math.random().toString(),
        titulo: e.querySelector('h3')?.innerText || 'Sin título'
      }));
    });

    let historial = fs.existsSync('vistos.json') ? JSON.parse(fs.readFileSync('vistos.json')) : [];
    const idsVistos = new Set(historial.map(h => h.id));
    const resultado = actuales.map(ev => ({ ...ev, esNuevo: !idsVistos.has(ev.id) }));

    fs.writeFileSync('vistos.json', JSON.stringify(actuales));
    return resultado;
  } catch (e) { return []; } finally { await browser.close(); }
}

app.get('/', async (req, res) => {
  const lista = await buscarNovedades();
  res.send(`<h1>AbonoMonitor</h1>${lista.map(e => `<p style="color:${e.esNuevo?'red':'black'}">${e.titulo} ${e.esNuevo?'<b>NUEVO</b>':''}</p>`).join('')}`);
});

app.listen(process.env.PORT || 3000);
