const puppeteer = require('puppeteer-core');
const express = require('express');
const fs = require('fs');
const app = express();

const USER = 'phe1981@gmail.com';
const PASS = 'fAsHaMp@gZie3g@';

// Lugares que tienes prohibido mostrar
const BLACKLIST = ["SALA BAKAN", "TEATRO LAS VEGAS", "GALILEO GALILEI", "BROADWAY", "OFF LATINA", "ZARZUELA"];
const FAVORITOS = ["IFEMA", "PRÍNCIPE PÍO"];

async function escanear() {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome-stable',
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
        id: e.querySelector('a')?.href,
        titulo: e.querySelector('h3')?.innerText,
        lugar: e.querySelector('.venue')?.innerText || "Madrid"
      }));
    });

    // Aplicamos tus filtros personales
    const filtrados = actuales.filter(ev => 
      !BLACKLIST.some(b => ev.lugar.toUpperCase().includes(b))
    );

    let historial = fs.existsSync('vistos.json') ? JSON.parse(fs.readFileSync('vistos.json')) : [];
    const idsVistos = new Set(historial.map(h => h.id));
    
    const resultado = filtrados.map(ev => ({
      ...ev,
      esNuevo: !idsVistos.has(ev.id),
      esFav: FAVORITOS.some(f => ev.lugar.toUpperCase().includes(f))
    }));

    fs.writeFileSync('vistos.json', JSON.stringify(filtrados));
    return resultado;
  } catch (e) { return []; } finally { await browser.close(); }
}

app.get('/', async (req, res) => {
  const lista = await escanear();
  res.send(`
    <html><body style="font-family:sans-serif; padding:20px;">
      <h1>Monitor Abono</h1>
      ${lista.map(e => `
        <div style="border-left:8px solid ${e.esNuevo?'red':(e.esFav?'gold':'#ccc')}; padding:10px; margin-bottom:10px; background:white; border-radius:5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <strong>${e.titulo}</strong><br>${e.lugar}
          ${e.esNuevo ? ' <b style="color:red;">¡NUEVO!</b>' : ''}
          ${e.esFav ? ' <b style="color:gold;">⭐ TOP</b>' : ''}
        </div>
      `).join('')}
    </body></html>
  `);
});

app.listen(process.env.PORT || 3000);
