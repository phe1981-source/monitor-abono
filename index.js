const puppeteer = require('puppeteer');
const express = require('express');
const app = express();

const USER = 'phe1981@gmail.com';
const PASS = 'fAsHaMp@gZie3g@';

let vistaPrevia = "Esperando datos...";
let logEstado = "Iniciado";

async function escaneoRapido() {
  console.log("Iniciando escaneo ultra-rápido...");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  });
  const page = await browser.newPage();
  
  try {
    // 1. LOGIN (Sin esperar a que cargue toda la basura de la web)
    logEstado = "Accediendo al Login...";
    await page.goto('https://compras.abonoteatro.com/login/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    await page.type('#nabonadologin', USER);
    await page.type('#contrasenalogin', PASS);
    
    logEstado = "Enviando credenciales...";
    await Promise.all([
        page.click('input[value="Entrar"].buyBtn'),
        page.waitForNavigation({ waitUntil: 'domcontentloaded' })
    ]);

    // 2. IR A CARTELERA
    logEstado = "Cargando Cartelera...";
    await page.goto('https://compras.abonoteatro.com/teatro/', { waitUntil: 'domcontentloaded' });
    
    // Espera fija de 15 segundos para que el iframe "respire"
    await new Promise(r => setTimeout(r, 15000));

    // 3. CAPTURA DE TEXTO EN TODOS LOS MARCOS
    logEstado = "Extrayendo texto...";
    let textoTotal = "";
    const frames = page.frames();
    
    for (const f of frames) {
        try {
            const txt = await f.evaluate(() => document.body.innerText);
            textoTotal += `\n--- MARCO (${f.url().substring(0,40)}...) ---\n${txt}\n`;
        } catch (e) {}
    }

    vistaPrevia = textoTotal || "No se pudo extraer texto de ningún marco.";
    logEstado = "Completado.";

  } catch (error) {
    logEstado = "Fallo: " + error.message;
    vistaPrevia = "ERROR CRÍTICO: " + error.message;
  } finally {
    await browser.close();
  }
}

setInterval(escaneoRapido, 600000);
escaneoRapido();

app.get('/', (req, res) => {
  res.send(`
    <body style="background:#111; color:#0f0; font-family:monospace; padding:20px;">
      <h3>Diagnóstico de Monitor (MVP)</h3>
      <p>Estado actual: <strong>${logEstado}</strong></p>
      <hr>
      <pre style="white-space:pre-wrap; background:#000; padding:10px; border:1px solid #333;">${vistaPrevia}</pre>
      <script>setTimeout(() => location.reload(), 20000);</script>
    </body>
  `);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log('MVP funcionando'));
