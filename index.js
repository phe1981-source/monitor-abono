const puppeteer = require('puppeteer');
const express = require('express');
const app = express();

const USER = 'phe1981@gmail.com';
const PASS = 'fAsHaMp@gZie3g@';

// Variables Globales de Estado
let listaAnterior = [];
let listaActual = [];
let eventosNuevos = [];
let logEstado = "Iniciando...";
let ultimaActualizacion = "Nunca";
let hayCambio = false;

async function iniciarMonitor() {
  console.log("🚀 Iniciando Bot de Monitoreo...");
  
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1000 });

  try {
    // --- 1. LOGIN ÚNICO ---
    logEstado = "Realizando login inicial...";
    await page.goto('https://compras.abonoteatro.com/login/', { waitUntil: 'networkidle2' });
    
    // Aceptar Cookies
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Aceptar'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 2000));

    await page.type('#nabonadologin', USER);
    await page.type('#contrasenalogin', PASS);
    await page.click('input[value="Entrar"].buyBtn');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    // --- 2. BUCLE INFINITO DE MONITOREO ---
    while (true) {
      logEstado = "Escaneando cartelera...";
      console.log("🔍 Escaneando...");

      await page.goto('https://compras.abonoteatro.com/teatro/', { waitUntil: 'domcontentloaded' }).catch(() => {});
      await new Promise(r => setTimeout(r, 12000)); // Espera a que cargue el iframe de eventos

      const frameElement = await page.$('iframe');
      if (frameElement) {
        const frame = await frameElement.contentFrame();
        
        // Extraemos todos los nombres del listado y del selector de recintos
        const data = await frame.evaluate(() => {
          const elementos = document.querySelectorAll('.tribe-events-list-event-title a, h3 a, #select_recinto_event option');
          return Array.from(elementos)
            .map(el => el.innerText.trim())
            .filter(texto => texto !== "" && texto !== "-- Seleccione --");
        });

        listaActual = data;
        
        // Comparación con la vuelta anterior
        if (listaAnterior.length > 0) {
          eventosNuevos = listaActual.filter(item => !listaAnterior.includes(item));
          
          if (eventosNuevos.length > 0) {
            hayCambio = true;
            console.log(`✨ ¡Novedades!: ${eventosNuevos.length} eventos nuevos.`);
          } else {
            hayCambio = false;
          }
        }

        listaAnterior = [...listaActual];
        ultimaActualizacion = new Date().toLocaleTimeString('es-ES');
        logEstado = "Monitorizando (Esperando ciclo)";
      }

      // Espera de 5 minutos antes de la siguiente lectura
      console.log("😴 Esperando 5 minutos para el siguiente ciclo...");
      await new Promise(r => setTimeout(r, 300000)); 
    }

  } catch (error) {
    logEstado = "Error Crítico: " + error.message;
    console.error("❌ ERROR:", error);
    await browser.close();
    // Reiniciar en 1 minuto si algo falla
    setTimeout(iniciarMonitor, 60000);
  }
}

// Arrancar el monitor
iniciarMonitor();

// --- SERVIDOR WEB PARA VISUALIZACIÓN ---
app.get('/', (req, res) => {
  res.send(`
    <body style="background:#000; color:#fff; font-family:sans-serif; padding:20px; text-align:center;">
      <div style="max-width:800px; margin:auto; border:4px solid ${hayCambio ? '#ff4400' : '#333'}; padding:30px; border-radius:20px; background:#111;">
        
        <h2 style="color:${hayCambio ? '#ff4400' : '#B9C800'}; letter-spacing:2px;">
          ${hayCambio ? '🔔 ¡NUEVOS EVENTOS DETECTADOS!' : 'ESTADO: BUSCANDO NOVEDADES'}
        </h2>
        
        <div style="margin:20px 0; display:flex; justify-content:center; gap:50px;">
          <div>
            <p style="color:#666; margin:0;">TOTAL EN CARTELERA</p>
            <p style="font-size:4em; font-weight:bold; margin:0;">${listaActual.length}</p>
          </div>
          ${hayCambio ? `
          <div style="background:#ff4400; padding:10px 20px; border-radius:10px;">
            <p style="color:#fff; margin:0;">NOVEDADES</p>
            <p style="font-size:4em; font-weight:bold; margin:0;">+${eventosNuevos.length}</p>
          </div>` : ''}
        </div>

        <p style="color:#888;">Última actualización: <strong>${ultimaActualizacion}</strong></p>
        <p style="color:#444;">Estado del Bot: ${logEstado}</p>

        ${hayCambio ? `
          <div style="text-align:left; background:#221100; border:1px solid #ff4400; padding:15px; border-radius:10px; margin-top:20px;">
            <h3 style="color:#ff4400; margin-top:0;">✨ ÚLTIMAS INCORPORACIONES:</h3>
            <ul style="list-style:none; padding:0; font-size:1.1em;">
              ${eventosNuevos.map(ev => `<li style="margin-bottom:8px; padding-bottom:4px; border-bottom:1px solid #442200;">👉 ${ev}</li>`).join('')}
            </ul>
          </div>
        ` : '<p style="color:#444; margin-top:30px;">No hay cambios detectados en el último ciclo.</p>'}

        <hr style="border:0; border-top:1px solid #222; margin:30px 0;">
        <p style="font-size:0.8em; color:#555;">Refresco automático cada 30s | Ciclo de datos cada 5 min</p>
      </div>
      <script>setTimeout(() => location.reload(), 30000);</script>
    </body>
  `);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Servidor Web listo en puerto ${PORT}`);
});
