const puppeteer = require('puppeteer');
const express = require('express');
const app = express();

const USER = 'phe1981@gmail.com';
const PASS = 'fAsHaMp@gZie3g@';

let textoCapturado = "Esperando primer escaneo...";
let logEstado = "Iniciado";

async function escaneoMVP() {
  console.log("--- Iniciando Escaneo MVP ---");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
  });
  const page = await browser.newPage();
  
  try {
    logEstado = "Intentando Login...";
    await page.goto('https://compras.abonoteatro.com/login/', { waitUntil: 'networkidle2' });
    await page.type('#nabonadologin', USER);
    await page.type('#contrasenalogin', PASS);
    await page.click('input[value="Entrar"].buyBtn');
    
    // Esperamos a que la URL cambie tras el login
    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    logEstado = "Entrando en Cartelera...";
    await page.goto('https://compras.abonoteatro.com/teatro/', { waitUntil: 'networkidle2' });
    
    // Espera fija de 10 segundos. No buscamos selectores, solo esperamos.
    await new Promise(r => setTimeout(r, 10000));

    // Capturamos el texto de la página principal y del iframe si existe
    logEstado = "Capturando texto bruto...";
    let contenido = await page.evaluate(() => document.body.innerText);
    
    const frameElement = await page.$('iframe');
    if (frameElement) {
      const frame = await frameElement.contentFrame();
      const textoIframe = await frame.evaluate(() => document.body.innerText);
      contenido += "\n\n--- CONTENIDO DEL IFRAME ---\n\n" + textoIframe;
    }

    textoCapturado = contenido;
    logEstado = "Escaneo completado.";

  } catch (error) {
    logEstado = "Error: " + error.message;
    textoCapturado = "FALLO: " + error.message;
  } finally {
    await browser.close();
  }
}

// Escanear cada 10 minutos
setInterval(escaneoMVP, 600000);
escaneoMVP();

app.get('/', (req, res) => {
  res.send(`
    <body style="font-family:monospace; background:#000; color:#0f0; padding:20px;">
      <h2>Monitor MVP (Lectura de Texto)</h2>
      <p><strong>Estado:</strong> ${logEstado}</p>
      <hr>
      <pre style="white-space: pre-wrap; color:#ccc; font-size:12px;">
        ${textoCapturado}
      </pre>
      <script>setTimeout(() => location.reload(), 30000);</script>
    </body>
  `);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log('MVP Online'));
