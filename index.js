const puppeteer = require('puppeteer');
const express = require('express');
const app = express();

const USER = 'phe1981@gmail.com';
const PASS = 'fAsHaMp@gZie3g@';

let imgLogin = ""; 
let imgResultado = "";
let logEstado = "Esperando inicio...";

async function escaneoVisual() {
  console.log("Iniciando doble captura...");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1000 });

  try {
    // 1. ANTES DEL LOGIN
    logEstado = "Capturando pantalla de Login...";
    await page.goto('https://compras.abonoteatro.com/login/', { waitUntil: 'networkidle2' });
    imgLogin = await page.screenshot({ encoding: 'base64' });

    // 2. EJECUTAR LOGIN
    logEstado = "Rellenando datos y entrando...";
    await page.type('#nabonadologin', USER);
    await page.type('#contrasenalogin', PASS);
    await Promise.all([
      page.click('input[value="Entrar"].buyBtn'),
      page.waitForNavigation({ waitUntil: 'networkidle2' })
    ]);

    // 3. DESPUÉS DEL LOGIN (Cartelera)
    logEstado = "Capturando resultado final...";
    await page.goto('https://compras.abonoteatro.com/teatro/', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 8000)); // Espera para que cargue el contenido
    imgResultado = await page.screenshot({ encoding: 'base64' });

    logEstado = "Escaneo completado.";

  } catch (error) {
    logEstado = "Error: " + error.message;
    // Si hay error, capturamos lo que haya en pantalla en ese momento
    imgResultado = await page.screenshot({ encoding: 'base64' });
  } finally {
    await browser.close();
  }
}

setInterval(escaneoVisual, 600000);
escaneoVisual();

app.get('/', (req, res) => {
  res.send(`
    <body style="background:#1a1a1a; color:#eee; font-family:sans-serif; padding:20px; text-align:center;">
      <h2>Panel de Control Visual</h2>
      <p>Estado: <strong>${logEstado}</strong></p>
      <hr style="border:1px solid #333;">
      
      <div style="display:flex; justify-content: space-around; flex-wrap: wrap; gap: 20px; margin-top:20px;">
        <div>
          <h3>1. Antes del Login</h3>
          ${imgLogin ? `<img src="data:image/png;base64,${imgLogin}" style="width:500px; border:3px solid #555;">` : "<p>Cargando...</p>"}
        </div>
        <div>
          <h3>2. Resultado / Cartelera</h3>
          ${imgResultado ? `<img src="data:image/png;base64,${imgResultado}" style="width:500px; border:3px solid #B9C800;">` : "<p>Esperando login...</p>"}
        </div>
      </div>
      <script>setTimeout(() => location.reload(), 20000);</script>
    </body>
  `);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log('Doble captura lista'));
