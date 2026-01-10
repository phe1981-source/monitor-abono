const puppeteer = require('puppeteer');
const express = require('express');
const app = express();

const USER = 'phe1981@gmail.com';
const PASS = 'fAsHaMp@gZie3g@';

let memoriaEventos = []; 
let logEstado = "Esperando primer escaneo...";

async function primerEscaneo() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--single-process']
  });
  const page = await browser.newPage();
  
  try {
    logEstado = "Iniciando Login...";
    await page.goto('https://compras.abonoteatro.com/login/', { waitUntil: 'networkidle2' });
    await page.type('#nabonadologin', USER);
    await page.type('#contrasenalogin', PASS);
    await Promise.all([
      page.click('input[value="Entrar"].buyBtn'),
      page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {})
    ]);

    logEstado = "Login hecho. Cargando eventos y esperando 10 segundos...";
    await page.goto('https://compras.abonoteatro.com/eventos/', { waitUntil: 'networkidle2' });
    
    // Pausa larga para asegurar que el AJAX de la imagen cargue todo
    await new Promise(r => setTimeout(r, 10000));

    const eventosEncontrados = await page.evaluate(() => {
      // Capturamos TODOS los textos de la página para ver qué está leyendo el bot
      const elementos = Array.from(document.querySelectorAll('h3, .title, .entry-title, strong'));
      return elementos.map(e => e.innerText.trim()).filter(t => t.length > 4);
    });

    memoriaEventos = eventosEncontrados;
    logEstado = `Escaneo finalizado. Se han visto ${eventosEncontrados.length} eventos.`;

  } catch (error) {
    logEstado = "Error: " + error.message;
  } finally {
    await browser.close();
  }
}

// Ejecutar el escaneo nada más arrancar
primerEscaneo();

app.get('/', (req, res) => {
  res.send(`
    <body style="font-family:sans-serif; background:#000; color:#fff; padding:20px;">
      <h2>Estado: ${logEstado}</h2>
      <hr>
      <h3>Lista de lo que el robot ve:</h3>
      <ul>
        ${memoriaEventos.map(e => `<li>${e}</li>`).join('')}
      </ul>
      <script>setTimeout(() => location.reload(), 10000);</script>
    </body>
  `);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log('Monitor de diagnóstico activo'));
