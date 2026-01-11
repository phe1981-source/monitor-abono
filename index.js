const puppeteer = require('puppeteer');
const express = require('express');
const app = express();

const USER = 'phe1981@gmail.com';
const PASS = 'fAsHaMp@gZie3g@';

// Variables Globales
let listaBrutaSinFiltrar = []; // Para el counter principal
let listaLimpia = [];          // Para la tabla de abajo
let historialNovedades = []; 
let logEstado = "Iniciando...";
let ultimaActualizacion = "Esperando primer ciclo...";

function obtenerEsperaAleatoria(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

async function iniciarMonitor() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1000 });

  try {
    logEstado = "Realizando login...";
    await page.goto('https://compras.abonoteatro.com/login/', { waitUntil: 'networkidle2' });
    
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Aceptar'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 2000));

    await page.type('#nabonadologin', USER);
    await page.type('#contrasenalogin', PASS);
    await page.click('input[value="Entrar"].buyBtn');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    while (true) {
      logEstado = "Escaneando cartelera...";
      await page.goto('https://compras.abonoteatro.com/teatro/', { waitUntil: 'domcontentloaded' }).catch(() => {});
      await new Promise(r => setTimeout(r, 12000)); 

      const frameElement = await page.$('iframe');
      if (frameElement) {
        const frame = await frameElement.contentFrame();
        
        const data = await frame.evaluate(() => {
          const elementos = document.querySelectorAll('.tribe-events-list-event-title a, h3 a, #select_recinto_event option');
          return Array.from(elementos)
            .map(el => el.innerText.trim())
            .filter(texto => texto !== "" && texto !== "-- Seleccione --");
        });

        // ACTUALIZACIÓN DE LISTAS
        const anteriorParaComparar = [...listaLimpia];
        
        listaBrutaSinFiltrar = data; // COUNTER 1: Todo lo que lee el bot
        listaLimpia = [...new Set(data)].sort(); // LISTA ABAJO: Sin duplicados
        
        const ahoraTimestamp = Date.now();
        const ahoraHora = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

        // Lógica de Alertas (basada en nombres únicos para no duplicar alarmas)
        if (anteriorParaComparar.length > 0) {
          const detectadosAhora = listaLimpia.filter(item => !anteriorParaComparar.includes(item));

          detectadosAhora.forEach(nombre => {
            const yaRegistradoMismoMinuto = historialNovedades.some(h => h.nombre === nombre && h.hora === ahoraHora);
            if (!yaRegistradoMismoMinuto) {
              historialNovedades.unshift({
                nombre: nombre,
                hora: ahoraHora,
                timestamp: ahoraTimestamp
              });
            }
          });
        }

        const doceHorasEnMs = 12 * 60 * 60 * 1000;
        historialNovedades = historialNovedades.filter(h => (ahoraTimestamp - h.timestamp) < doceHorasEnMs);

        ultimaActualizacion = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }

      const segundosEspera = obtenerEsperaAleatoria(60, 300);
      logEstado = `Próximo escaneo en ${Math.floor(segundosEspera/60)}m ${segundosEspera%60}s`;
      await new Promise(r => setTimeout(r, segundosEspera * 1000)); 
    }

  } catch (error) {
    logEstado = "Error: " + error.message;
    await browser.close();
    setTimeout(iniciarMonitor, 60000);
  }
}

iniciarMonitor();

app.get('/', (req, res) => {
  res.send(`
    <body style="background:#000; color:#fff; font-family:sans-serif; padding:20px;">
      <div style="max-width:900px; margin:auto; border:2px solid #333; padding:25px; border-radius:15px; background:#0a0a0a;">
        
        <header style="text-align:center; margin-bottom:30px;">
          <h1 style="color:#B9C800; margin:0; letter-spacing:1px;">MONITOR AGILE</h1>
          <p style="color:#666; margin:5px 0;">Última sincronización: ${ultimaActualizacion}</p>
          
          <div style="font-size:5em; font-weight:bold; color:#B9C800; margin:5px 0;">
            ${listaBrutaSinFiltrar.length === 0 ? '<span style="font-size:0.4em; color:#444;">CARGANDO...</span>' : listaBrutaSinFiltrar.length}
          </div>
          <div style="color:#555; text-transform:uppercase; font-size:0.8em; letter-spacing:2px;">Total Eventos Leídos (Bruto)</div>
        </header>

        <section style="margin-bottom:30px;">
          <div style="background:#111; border:1px solid #ff4400; padding:15px; border-radius:12px;">
            <h3 style="color:#ff4400; margin-top:0; font-size:0.9em; letter-spacing:1px;">HISTORIAL DE ALERTAS (ÚLTIMAS 12H)</h3>
            <div style="max-height:250px; overflow-y:auto; font-size:0.9em;">
              ${historialNovedades.length > 0 ? `
                <table style="width:100%; border-collapse:collapse;">
                  ${historialNovedades.map(h => `
                    <tr style="border-bottom:1px solid #222;">
                      <td style="padding:10px 5px; color:#ffbb00; font-weight:bold; width:70px;">[${h.hora}]</td>
                      <td style="padding:10px 5px; color:#eee;">${h.nombre} <span style="font-size:0.7em; color:#ff4400; border:1px solid #ff4400; padding:1px 4px; border-radius:3px; margin-left:10px;">NUEVO</span></td>
                    </tr>
                  `).join('')}
                </table>
              ` : '<p style="color:#333; text-align:center;">No hay alertas en las últimas 12h.</p>'}
            </div>
          </div>
        </section>

        <section>
          <div style="background:#0a0a0a; border:1px solid #333; padding:15px; border-radius:12px;">
            <h3 style="color:#B9C800; margin-top:0; font-size:0.9em; letter-spacing:1px;">LISTADO DE EVENTOS ÚNICOS (${listaLimpia.length})</h3>
            <div style="max-height:500px; overflow-y:auto; font-size:0.85em; border-top:1px solid #222;">
              <table style="width:100%; border-collapse:collapse;">
                <tbody>
                  ${listaLimpia.map((evento, index) => `
                    <tr style="border-bottom:1px solid #1a1a1a;">
                      <td style="padding:8px 5px; color:#444; width:30px;">${index + 1}</td>
                      <td style="padding:8px 5px; color:#ccc;">${evento}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
              ${listaLimpia.length === 0 ? '<p style="color:#333; text-align:center; padding:20px;">Esperando datos del escáner...</p>' : ''}
            </div>
          </div>
        </section>

        <footer style="margin-top:30px; padding-top:15px; border-top:1px solid #222; color:#444; font-size:0.75em; display:flex; justify-content:space-between;">
          <span>Estado: ${logEstado}</span>
          <span>Jitter: 1-5 min | Persistencia: 12h</span>
        </footer>

      </div>
      <script>setTimeout(() => location.reload(), 60000);</script>
    </body>
  `);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0');
