const puppeteer = require('puppeteer');
const express = require('express');
const app = express();

const URL_DIRECTA = 'https://programacion.abonoteatro.com/catalogo/teatros2.php?token=afuihA5GtKvlX6VvX5FAsW';

let memoriaEventos = []; 
let logEstado = "Iniciando monitor...";
let ultimaActualizacion = "Nunca";

async function escaneoDirecto() {
  console.log("Iniciando escaneo...");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--single-process']
  });
  
  const page = await browser.newPage();
  
  // 1. Simular un navegador real para evitar bloqueos
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  try {
    logEstado = "Cargando catálogo...";
    await page.goto(URL_DIRECTA, { waitUntil: 'networkidle2', timeout: 60000 });
    
    // 2. Esperar un poco más de tiempo por el AJAX (10 segundos extra de cortesía)
    logEstado = "Esperando que el contenido AJAX aparezca...";
    await new Promise(r => setTimeout(r, 10000)); 

    // 3. Extraer usando selectores más genéricos si el principal falla
    const eventos = await page.evaluate(() => {
      // Intentamos capturar los h2/h3 de eventos o cualquier cosa con la clase de título
      const elementos = document.querySelectorAll('.tribe-events-list-event-title, h3.title, a.url');
      return Array.from(elementos).map(el => el.innerText.trim()).filter(t => t.length > 5);
    });

    if (eventos.length === 0) {
        throw new Error("Página cargada pero no se encontraron títulos. ¿Token caducado?");
    }

    memoriaEventos = [...new Set(eventos)];
    ultimaActualizacion = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });
    logEstado = `Éxito: ${memoriaEventos.length} eventos encontrados.`;
    console.log(logEstado);

  } catch (error) {
    logEstado = "Error: " + error.message;
    console.error("Fallo en el escaneo:", error.message);
  } finally {
    await browser.close();
  }
}

setInterval(escaneoDirecto, 300000);
escaneoDirecto();

app.get('/', (req, res) => {
  res.send(`
    <body style="font-family:sans-serif; background:#0e0e0e; color:#eee; padding:30px;">
      <h1 style="color:#B9C800; border-bottom: 2px solid #B9C800;">Monitor de Cartelera</h1>
      <div style="background:#1e1e1e; padding:15px; border-radius:8px; margin-bottom:20px;">
        <p><strong>Estado:</strong> <span style="color:#f1c40f;">${logEstado}</span></p>
        <p><strong>Última sincronización:</strong> ${ultimaActualizacion}</p>
      </div>
      <h3>Lista de Eventos (${memoriaEventos.length}):</h3>
      <ul>
        ${memoriaEventos.length > 0 
          ? memoriaEventos.map(e => `<li>${e}</li>`).join('') 
          : "<li>No hay datos. Si el error persiste, el token de la URL ha caducado.</li>"}
      </ul>
      <script>setTimeout(() => location.reload(), 60000);</script>
    </body>
  `);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Puerto ${PORT} abierto`));
