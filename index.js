const puppeteer = require('puppeteer');
const express = require('express');
const app = express();

const USER = 'phe1981@gmail.com';
const PASS = 'fAsHaMp@gZie3g@';

let imgLogin = ""; 
let imgResultado = "";
let logEstado = "Esperando inicio...";

async function escaneoVisualCorregido() {
  console.log("Iniciando escaneo con limpieza de cookies...");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1000 });

  try {
    logEstado = "1. Cargando página de Login...";
    await page.goto('https://compras.abonoteatro.com/login/', { waitUntil: 'networkidle2' });

    // --- ACCIÓN: ELIMINAR COOKIES ---
    logEstado = "Eliminando banner de cookies...";
    await page.evaluate(() => {
      const botones = Array.from(document.querySelectorAll('button'));
      const btnAceptar = botones.find(b => b.innerText.includes('Aceptar cookies') || b.innerText.includes('Aceptar'));
      if (btnAceptar) btnAceptar.click();
    });
    await new Promise(r => setTimeout(r, 2000)); // Espera a que el banner se quite

    logEstado = "2. Rellenando credenciales...";
    await page.type('#nabonadologin', USER);
    await page.type('#contrasenalogin', PASS);
    
    // CAPTURA 1: Verificamos si el banner se fue y los datos están puestos
    imgLogin = await page.screenshot({ encoding: 'base64' });

    logEstado = "3. Pulsando Entrar...";
    await Promise.all([
      page.click('input[value="Entrar"].buyBtn'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 })
    ]);

    logEstado = "4. Accediendo a Cartelera...";
    await page.goto('https://compras.abonoteatro.com/teatro/', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 10000)); // Espera para que cargue el catálogo AJAX

    // CAPTURA 2: Resultado final
    imgResultado = await page.screenshot({ encoding: 'base64' });
    logEstado = "Escaneo completado con éxito.";

  } catch (error) {
    logEstado = "Fallo: " + error.message;
    // Si falla, sacamos captura de la pantalla de error
    imgResultado = await page.screenshot({ encoding: 'base64' });
  } finally {
    await browser.close();
  }
}

setInterval(escaneoVisualCorregido, 600000);
escaneoVisualCorregido();

app.get('/', (req, res) => {
  res.send(`
    <body style="background:#1a1a1a; color:#eee; font-family:sans-serif; text-align:center; padding:20px;">
      <h2>Panel de Control Visual (Anti-Cookies)</h2>
      <p>Estado: <strong>${logEstado}</strong></p>
      <hr style="border:1px solid #333;">
      <div style="display:flex; justify-content: space-around; flex-wrap: wrap; gap: 20px; margin-top:20px;">
        <div>
          <h3>1. Intento de Login (Sin Banner)</h3>
          ${imgLogin ? `<img src="data:image/png;base64,${imgLogin}" style="width:550px; border:3px solid #555;">` : "<p>Cargando...</p>"}
        </div>
        <div>
          <h3>2. Resultado / Cartelera</h3>
          ${imgResultado ? `<img src="
