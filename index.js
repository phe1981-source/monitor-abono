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
    console.log("Accediendo a login (URL de compras)...");
    await page.goto('https://compras.abonoteatro.com/login/', { waitUntil: 'networkidle2', timeout: 60000 });
    
    // 1. SELECTORES PRECISOS SEGÚN TU CÓDIGO FUENTE
    console.log("Rellenando campos por ID...");
    await page.waitForSelector('#nabonadologin', { timeout: 30000 });
    
    // Escribimos usando los IDs reales: nabonadologin y contrasenalogin
    await page.type('#nabonadologin', USER, { delay: 50 });
    await page.type('#contrasenalogin', PASS, { delay: 50 });
    
    // 2. CLIC EN EL BOTÓN REAL
    console.log("Haciendo clic en el botón de entrada...");
    // El botón es un <input type="button"> con clase 'buyBtn' y valor 'Entrar'
    await Promise.all([
      page.click('input[value="Entrar"].buyBtn'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => console.log("Timeout navegación (a veces esperado)"))
    ]);

    // 3. IR A CARTELERA
    console.log("Navegando a la cartelera...");
    await page.goto('https://compras.abonoteatro.com/eventos/', { waitUntil: 'networkidle2' });
    
    // 4. EXTRACCIÓN MEJORADA
    const eventos = await page.evaluate(() => {
      // Buscamos los títulos en la estructura de 'noo-ivent'
      const items = Array.from(document.querySelectorAll('h3, .event-title, .title'));
      return items.map(i => ({
        titulo: i.innerText.trim(),
        lugar: i.parentElement?.innerText.split('\n')[1] || "Ver en web"
      })).filter(e => e.titulo.length > 2);
    });

    return eventos;

  } catch (error) {
    console.error("Fallo detallado:", error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

app.get('/', async (req, res) => {
  if (isScraping) return res.send("<h1>Robot en marcha...</h1><p>Vuelve a cargar en 20 segundos.</p>");
  isScraping = true;
  
  try {
    const lista = await escanearAbonoteatro();
    let html = `
      <body style="font-family: Arial; padding: 20px; background: #35261A; color: white;">
        <h1 style="color: #B9C800;">Monitor Abonoteatro (Cartelera)</h1>
        <hr style="border: 1px solid #B9C800;">
        <div style="background: white; color: #333; padding: 20px; border-radius: 8px;">
          ${lista.length > 0 ? `<ul>${lista.map(e => `<li><strong>${e.titulo}</strong></li>`).join('')}</ul>` : "No se detectaron eventos. ¿Estás logueado?"}
        </div>
      </body>`;
    res.send(html);
  } catch (e) {
    res.status(500).send(`<h1>Error</h1><p>${e.message}</p>`);
  } finally {
    isScraping = false;
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log('Monitor operativo'));
