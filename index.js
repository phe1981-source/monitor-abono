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
    
    console.log("Rellenando credenciales...");
    await page.waitForSelector('input[type="text"]', { timeout: 30000 });
    await page.type('input[type="text"]', USER);
    await page.type('input[type="password"]', PASS);
    
    console.log("Buscando botón de acceso...");
    // BUSCADOR DE BOTÓN MEJORADO: Busca cualquier botón que diga "Entrar", "Login", "Acceder" o sea de tipo submit
    const botonSelector = await page.evaluate(() => {
        const botones = Array.from(document.querySelectorAll('button, input[type="submit"], a.btn'));
        const target = botones.find(b => 
            b.innerText.toLowerCase().includes('entrar') || 
            b.innerText.toLowerCase().includes('login') || 
            b.innerText.toLowerCase().includes('acceder') ||
            b.type === 'submit'
        );
        return target ? (target.id ? `#${target.id}` : (target.className ? `.${target.className.split(' ').join('.')}` : 'button')) : 'button';
    });

    console.log(`Haciendo clic en: ${botonSelector}`);
    await Promise.all([
      page.click(botonSelector),
      page.waitForNavigation({ waitUntil: 'networkidle2' })
    ]);

    console.log("Login exitoso. Extrayendo eventos...");
    await page.goto('https://compras.abonoteatro.com/eventos/', { waitUntil: 'networkidle2' });
    
    const eventos = await page.evaluate(() => {
      const titulos = Array.from(document.querySelectorAll('h3, .event-title, .card-title, .title'));
      return titulos.map(t => ({
        titulo: t.innerText.trim(),
        lugar: t.parentElement?.innerText.split('\n')[1] || "Madrid"
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
      <body style="font-family: Arial; padding: 20px; background-color: #f4f4f4;">
        <h1 style="color: #333;">Monitor Abonoteatro</h1>
        <p>Actualizado: ${new Date().toLocaleTimeString()}</p>
        <hr>
        <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <ul style="line-height: 2;">
            ${lista.map(ev => `<li><strong>${ev.titulo}</strong> <span style="color: #666;">(${ev.lugar})</span></li>`).join('')}
          </ul>
        </div>
      </body>`;
    res.send(html);
  } catch (e) {
    res.status(500).send(`<h1>Error</h1><p>No se pudo conectar: ${e.message}</p>`);
  } finally {
    isScraping = false;
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log('Servidor activo en puerto ' + PORT));
