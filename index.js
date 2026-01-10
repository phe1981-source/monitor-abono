const puppeteer = require('puppeteer');
const express = require('express');
const app = express();

const USER = 'phe1981@gmail.com';
const PASS = 'fAsHaMp@gZie3g@';

let memoriaEventos = []; 
let logEstado = "Iniciando diagnóstico...";

async function primerEscaneo() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--single-process']
  });
  const page = await browser.newPage();
  
  try {
    logEstado = "Paso 1: Haciendo Login...";
    console.log(logEstado);
    await page.goto('https://compras.abonoteatro.com/login/', { waitUntil: 'networkidle2' });
    await page.type('#nabonadologin', USER);
    await page.type('#contrasenalogin', PASS);
    await page.click('input[value="Entrar"].buyBtn');
    
    // Esperamos a que la navegación post-login termine
    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    logEstado = "Paso 2: En cartelera. Esperando 20 segundos para carga total...";
    console.log(logEstado);
    await page.goto('https://compras.abonoteatro.com/eventos/', { waitUntil: 'networkidle2' });
    
    // ESPERA CRÍTICA: 20 segundos para que el AJAX termine de pintar los títulos de tu foto
    await new Promise(r => setTimeout(r, 20000));

    // CAPTURA TOTAL: Leemos cualquier etiqueta que pueda contener el título
    const datos = await page.evaluate(() => {
      const selectores = 'h3, strong, .title, .entry-title, .tribe-events-list-event-title, div[style*="bold"]';
      const items = Array.from(document.querySelectorAll(selectores));
      return items.map(i => i.innerText.trim()).filter(t => t.length > 5);
    });

    memoriaEventos = [...new Set(datos)]; // Quitamos duplicados
    logEstado = `Diagnóstico completado. Vistos: ${memoriaEventos.length} eventos.`;
    console.log(logEstado);

  } catch (error) {
    logEstado = "Error detectado: " + error.message;
    console.error(logEstado);
  } finally {
    await browser.close();
  }
}

// Arranca el diagnóstico
primerEscaneo();

app.get('/', (req, res) => {
  res.send(`
    <body style="font-family:sans-serif; background:#000; color:#fff; padding:30px;">
      <h1 style="color:#B9C800;">Monitor de Diagnóstico</h1>
      <p style="font-size:1.2em;">Estado actual: <strong>${logEstado}</strong></p>
      <hr style="border:1px solid #333;">
      <h3>Eventos Capturados:</h3>
      <ul style="color:#ccc;">
        ${memoriaEventos.length > 0 
          ? memoriaEventos.map(e => `<li>${e}</li>`).join('') 
          : "<li>No se ha capturado nada todavía.</li>"}
      </ul>
      <p style="margin-top:50px; font-size:0.8em; color:#555;">La página se refresca cada 10s para ver el avance.</p>
      <script>setTimeout(() => location.reload(), 10000);</script>
    </body>
  `);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log('Servidor de diagnóstico online'));
