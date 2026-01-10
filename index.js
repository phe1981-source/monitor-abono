const puppeteer = require('puppeteer');
const express = require('express');
const app = express();

const USER = 'phe1981@gmail.com';
const PASS = 'fAsHaMp@gZie3g@';

let isScraping = false;

async function escanearConDiagnostico() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--single-process']
  });
  
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  try {
    console.log("--- INICIO DIAGNÓSTICO ---");
    console.log("Intentando acceder a Abonoteatro...");
    
    // 1. Intentamos cargar la página con un tiempo generoso
    const response = await page.goto('https://www.abonoteatro.com/mi-perfil/', { 
      waitUntil: 'networkidle2', 
      timeout: 60000 
    });

    console.log(`Estado HTTP: ${response.status()}`);

    // 2. ¿Qué título tiene la página? (Si dice "Access Denied", ya sabemos el problema)
    const pageTitle = await page.title();
    console.log(`Título de la página: ${pageTitle}`);

    // 3. Buscamos el selector de forma flexible como sugirió Claude
    const selectorEncontrado = await page.evaluate(() => {
      const ids = ['#username', 'input[name="username"]', 'input[type="email"]'];
      for (let id of ids) {
        if (document.querySelector(id)) return id;
      }
      return null;
    });

    if (!selectorEncontrado) {
      console.log("CRÍTICO: No se encuentra ningún selector de login.");
      // Sacamos un trozo del HTML para ver qué hay
      const html = await page.content();
      console.log("Contenido HTML parcial:", html.slice(0, 500));
      throw new Error("Selector de login no detectado");
    }

    console.log(`Selector detectado: ${selectorEncontrado}. Escribiendo credenciales...`);
    await page.type(selectorEncontrado, USER);
    await page.type('#password', PASS);
    
    await Promise.all([
      page.click('[name="login"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2' })
    ]);

    console.log("Login OK. Navegando a eventos...");
    await page.goto('https://www.abonoteatro.com/eventos/', { waitUntil: 'networkidle2' });
    
    const eventos = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('h3')).map(h3 => ({ titulo: h3.innerText }));
    });

    return eventos;

  } catch (error) {
    console.error("FALLO EN EL ROBOT:", error.message);
    throw error;
  } finally {
    await browser.close();
    console.log("--- FIN DIAGNÓSTICO ---");
  }
}

app.get('/', async (req, res) => {
  if (isScraping) return res.send("<h1>Robot ocupado...</h1><p>Espera 1 minuto.</p>");
  isScraping = true;
  
  try {
    const lista = await escanearConDiagnostico();
    let html = '<h1>Resultados</h1><ol>' + lista.map(e => `<li>${e.titulo}</li>`).join('') + '</ol>';
    res.send(html);
  } catch (e) {
    res.status(500).send(`<h1>Error</h1><p>${e.message}</p><p>Mira los logs de Render para detalles.</p>`);
  } finally {
    isScraping = false;
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log('Servidor de diagnóstico listo'));
