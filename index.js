const puppeteer = require('puppeteer');
const express = require('express');
const app = express();

const USER = 'phe1981@gmail.com';
const PASS = 'fAsHaMp@gZie3g@';

// Variables Globales
let listaAnterior = [];
let listaActual = [];
let historialNovedades = []; // Guardará cada detección de forma independiente
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

        listaActual = [...new Set(data)];
        const ahoraTimestamp = Date.now();
        const ahoraHora = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

        if (listaAnterior.length > 0) {
          // Detectar qué hay nuevo con respecto a la lectura de hace unos minutos
          const detectadosAhora = listaActual.filter(item => !listaAnterior.includes(item));

          // OPCIÓN 1: Publicar cada cambio de forma independiente
          detectadosAhora.forEach(nombre => {
            // Solo evitamos añadirlo si ya se añadió en el MISMO minuto (para evitar ruidos de refresco)
            const yaRegistradoMismoMinuto = historialNovedades.some(h => h.nombre === nombre && h.hora === ahoraHora);
            
            if (!yaRegistradoMismoMinuto) {
              historialNovedades.unshift({
                nombre: nombre,
                hora: ahoraHora,
                timestamp: ahoraTimestamp,
                esReaparicion: listaAnterior.length > 0 && !listaAnterior.includes(nombre) 
              });
            }
          });
        }

        // Limpiar alertas de más de 12 horas
        const doceHorasEnMs = 12 * 60 * 60 * 1000;
        historialNovedades = historialNovedades.filter(h => (ahoraTimestamp - h.timestamp) < doceHorasEnMs);

        listaAnterior = [...listaActual];
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
      <div style="max-width:850px; margin:auto; border:2px solid #333; padding:20px; border-radius:15px; background:#0a0a0a;">
        
        <header style="text-align:center; margin-bottom:30px;">
          <h1 style="color:#B9C800; margin:0;">MONITOR AGILE</h1>
          <p style="color:#666; margin:5px 0;">Última lectura: ${ultimaActualizacion}</p>
          <div style="font-size:4em; font-weight:bold; color:#B9C800; margin:10px 0;">${listaActual.length} <span style="font-size:0.3em; color:#444; font-weight:normal;">eventos únicos</span></div>
        </header>

        <section style="margin-top:20px;">
          <div style="background:#111; border:1px solid #222; padding:20px; border-radius:12px;">
            <h3 style="color:#eee; margin-top:0; border-bottom:1px solid #333; padding-bottom:10px;">
              HISTORIAL DE ALERTAS (12H)
            </h3>
            
            ${historialNovedades.length > 0 ? `
              <div style="max-height:500px; overflow-y:auto;">
                <table style="width:100%; border-collapse:collapse;">
                  ${historialNovedades.map(h => `
                    <tr style="border-bottom:1px solid #222;">
                      <td style="padding:12px 5px; color:#ffbb00; font-weight:bold; width:80px;">[${h.hora}]</td>
                      <td style="padding:12px 5px; color:#eee;">
                         ${h.nombre} 
                         <span style="font-size:0.7em; background:#332200; color:#ff9900; padding:2px 6px; border-radius:4px; margin-left:10px; border:1px solid #553300;">NUEVA CARGA</span>
                      </td>
                    </tr>
                  `).join('')}
                </table>
              </div>
            ` : '<p style="color:#444; text-align:center; padding:20px;">Esperando novedades...</p>'}
          </div>
        </section>

        <footer style="margin-top:30px; font-size:0.8em; color:#444; text-align:center;">
          <p>Estado: ${logEstado} | Jitter activo | Persistencia: 12h</p>
        </footer>

      </div>
      <script>setTimeout(() => location.reload(), 60000);</script>
    </body>
  `);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0');
