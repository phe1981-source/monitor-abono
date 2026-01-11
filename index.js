const puppeteer = require('puppeteer');
const express = require('express');
const app = express();

const USER = 'phe1981@gmail.com';
const PASS = 'fAsHaMp@gZie3g@';

// Variables Globales
let listaAnterior = [];
let listaActual = [];
let eventosNuevos = [];
let logEstado = "Iniciando...";
let ultimaActualizacion = "Esperando primer ciclo...";
let hayCambio = false;

// Función para jitter (aleatorio entre 60s y 300s)
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
    // --- 1. LOGIN ÚNICO ---
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

    // --- 2. LOOP DE MONITOREO ---
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

        // 1. QUITAR DUPLICADOS usando Set
        listaActual = [...new Set(data)]; 
        
        // 2. COMPARAR CON ANTERIOR
        if (listaAnterior.length > 0) {
          eventosNuevos = listaActual.filter(item => !listaAnterior.includes(item));
          hayCambio = eventosNuevos.length > 0;
        }

        listaAnterior = [...listaActual];
        // 3. HORA DE ÚLTIMA LECTURA
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

// --- INTERFAZ WEB ---
app.get('/', (req, res) => {
  res.send(`
    <body style="background:#000; color:#fff; font-family:sans-serif; padding:20px; text-align:center;">
      <div style="max-width:800px; margin:auto; border:4px solid ${hayCambio ? '#ff4400' : '#333'}; padding:30px; border-radius:20px; background:#111;">
        
        <h2 style="color:${hayCambio ? '#ff4400' : '#B9C800'}; margin-bottom:5px;">
          ${hayCambio ? '🔔 ¡NUEVOS EVENTOS DETECTADOS!' : 'MONITOR DE CARTELERA'}
        </h2>
        <p style="color:#666; font-size:0.9em; margin-top:0;">Última lectura: <span style="color:#eee;">${ultimaActualizacion}</span></p>
        
        <div style="margin:30px 0; display:flex; justify-content:center; gap:50px; align-items:center;">
          <div>
            <p style="color:#888; margin:0; font-size:0.8em;">EVENTOS ÚNICOS</p>
            <p style="font-size:5em; font-weight:bold; margin:0; color:#B9C800;">${listaActual.length}</p>
          </div>
          ${hayCambio ? `
          <div style="background:#ff4400; padding:15px 25px; border-radius:15px; box-shadow: 0 0 20px rgba(255,68,0,0.4);">
            <p style="color:#fff; margin:0; font-weight:bold;">NUEVOS</p>
            <p style="font-size:4em; font-weight:bold; margin:0;">+${eventosNuevos.length}</p>
          </div>` : ''}
        </div>

        <div style="background:#000; padding:15px; border-radius:10px; border:1px solid #222;">
          <p style="color:#444; margin:0; font-size:0.85em;">ESTADO DEL BOT</p>
          <p style="margin:5px 0; color:#aaa;">${logEstado}</p>
        </div>

        ${hayCambio ? `
          <div style="text-align:left; background:#221100; border:1px solid #ff4400; padding:20px; border-radius:15px; margin-top:25px;">
            <h3 style="color:#ff4400; margin-top:0;">✨ NOVEDADES DETECTADAS:</h3>
            <ul style="list-style:none; padding:0; font-family:monospace;">
              ${eventosNuevos.map(ev => `<li style="color:#ffbb00; margin-bottom:10px; border-bottom:1px solid #331100; padding-bottom:5px;">▶ ${ev}</li>`).join('')}
            </ul>
          </div>
        ` : '<p style="color:#333; margin-top:30px;">Sin novedades en la última comparación.</p>'}

        <hr style="border:0; border-top:1px solid #222; margin:30px 0;">
        <p style="font-size:0.75em; color:#444;">Refresco visual: 60s | Jitter: 1-5 min | Limpieza de duplicados: Activa</p>
      </div>
      <script>setTimeout(() => location.reload(), 60000);</script>
    </body>
  `);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0');
