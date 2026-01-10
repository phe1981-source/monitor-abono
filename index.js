const puppeteer = require('puppeteer');
const express = require('express');
const app = express();

// URL directa del catálogo que extrajimos del iframe (más estable)
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
  
  try {
    logEstado = "Cargando catálogo directo...";
    // Usamos un timeout largo de 60s porque la web de Abono a veces es lenta
    await page.goto(URL_DIRECTA, { waitUntil: 'networkidle2', timeout: 60000 });
    
    // Esperamos a que aparezca la clase real que vimos en tu código fuente
    await page.waitForSelector('.tribe-events-list-event-title', { timeout: 30000 });

    const eventos = await page.evaluate(() => {
      // Buscamos los bloques de eventos para sacar Título y Recinto
      const bloques = document.querySelectorAll('.type-tribe_events');
      return Array.from(bloques).map(b => {
        const titulo = b.querySelector('.tribe-events-list-event-title')?.innerText.trim() || "Sin título";
        const recinto = b.querySelector('.tribe-events-venue-details')?.innerText.trim() || "Sin recinto";
        return `${titulo} — [${recinto}]`;
      }).filter(t => t.length > 5);
    });

    memoriaEventos = [...new Set(eventos)];
    ultimaActualizacion = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });
    logEstado = `Éxito: ${memoriaEventos.length} eventos encontrados.`;
    console.log(logEstado);

  } catch (error) {
    logEstado = "Error en escaneo: " + error.message;
    console.error(logEstado);
  } finally {
    await browser.close();
  }
}

// Ejecutar cada 5 minutos
setInterval(escaneoDirecto, 300000);
// Ejecución inicial al arrancar
escaneoDirecto();

// Servidor Web para ver los resultados
app.get('/', (req, res) => {
  res.send(`
    <body style="font-family:sans-serif; background:#0e0e0e; color:#eee; padding:30px;">
      <h1 style="color:#B9C800; border-bottom: 2px solid #B9C800; padding-bottom: 10px;">Monitor de Cartelera Directa</h1>
      
      <div style="background:#1e1e1e; padding:15px; border-radius:8px; margin-bottom:20px; border: 1px solid #333;">
        <p><strong>Estado:</strong> <span style="color:#f1c40f;">${logEstado}</span></p>
        <p><strong>Última sincronización:</strong> ${ultimaActualizacion}</p>
        <p style="font-size:0.8em; color:#666;">Fuente: <code>${URL_DIRECTA}</code></p>
      </div>

      <h3>Eventos Detectados (${memoriaEventos.length}):</h3>
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
        ${memoriaEventos.length > 0 
          ? memoriaEventos.map(e => `<div style="background:#252525; padding:10px; border-radius:4px; font-size:0.85em; border-left: 4px solid #B9C800;">${e}</div>`).join('') 
          : "<p>Buscando datos... Refresca en unos segundos.</p>"}
      </div>

      <script>setTimeout(() => location.reload(), 45000);</script>
    </body>
  `);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor activo en puerto ${PORT}`);
});
