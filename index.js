const puppeteer = require('puppeteer');
const express = require('express');
const app = express();

const USER = 'phe1981@gmail.com';
const PASS = process.env.ABONO_PASS || 'fAsHaMp@gZie3g@';

let listaLimpia = []; 
let historialNovedades = []; 
let logEstado = "Iniciando...";
let ultimaActualizacion = "Sin datos";

async function iniciarMonitor() {
  console.log("🚀 Iniciando Monitor V6.0 - Estabilidad Total");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.setDefaultNavigationTimeout(120000); 

  try {
    logEstado = "Login...";
    await page.goto('https://compras.abonoteatro.com/login/', { waitUntil: 'networkidle2' });
    await page.type('#nabonadologin', USER);
    await page.type('#contrasenalogin', PASS);
    await page.click('input[value="Entrar"].buyBtn');
    
    await page.waitForSelector('iframe', { timeout: 120000 });
    console.log("✅ Login OK");

    while (true) {
      logEstado = "Escaneando...";
      await page.goto('https://compras.abonoteatro.com/teatro/', { waitUntil: 'domcontentloaded' });
      await new Promise(r => setTimeout(r, 20000)); 

      const frameElement = await page.$('iframe');
      if (frameElement) {
        const frame = await frameElement.contentFrame();
        const data = await frame.evaluate(() => {
          const links = Array.from(document.querySelectorAll('.tribe-events-list-event-title a, h3 a')).map(el => el.innerText.trim());
          return [...new Set(links)].filter(n => n.length > 2);
        });

        if (data && data.length > 0) {
          const ahora = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
          
          if (listaLimpia.length > 0) {
            const detectados = data.filter(n => !listaLimpia.includes(n));
            detectados.forEach(nombre => {
              historialNovedades.unshift({ nombre, hora: ahora, nuevo: true });
              console.log(`🔔 NUEVO: ${nombre}`);
            });
          }
          
          listaLimpia = data;
          ultimaActualizacion = ahora;
        }
      }
      
      const espera = Math.floor(Math.random() * (120 - 60 + 1) + 60);
      logEstado = `Espera ${espera}s`;
      await new Promise(r => setTimeout(r, espera * 1000));
    }
  } catch (error) {
    console.log("❌ Error:", error.message);
    await browser.close().catch(() => {});
    setTimeout(iniciarMonitor, 10000);
  }
}

iniciarMonitor();

app.get('/', (req, res) => {
  const hayNovedad = historialNovedades.some(h => h.nuevo);
  res.send(`
    <body style="background:#000; color:#fff; font-family:sans-serif; text-align:center; padding:50px 20px;">
      <div style="max-width:500px; margin:auto; border:2px solid #333; padding:30px; border-radius:30px;">
        <h2 style="color:#B9C800;">MONITOR ACTIVO</h2>
        <div style="font-size:8em; font-weight:bold; color:#B9C800; line-height:1;">${listaLimpia.length}</div>
        <p style="color:#666;">Eventos detectados</p>
        <hr style="border:0; border-top:1px solid #222; margin:20px 0;">
        <p>Estado: <b>${logEstado}</b></p>
        <p>Sincro: ${ultimaActualizacion}</p>
        
        <button id="btnS" onclick="activar()" style="width:100%; padding:20px; background:#B9C800; color:#000; border:none; border-radius:15px; font-weight:bold; cursor:pointer; font-size:1.2em;">
           🔊 ACTIVAR ALARMA
        </button>

        <div style="margin-top:30px; text-align:left;">
          <h4 style="color:orange;">🔔 ÚLTIMOS CAMBIOS</h4>
          ${historialNovedades.length === 0 ? '<p style="color:#444;">Historial vacío</p>' : 
            historialNovedades.map(h => `<p style="font-size:0.9em; ${h.nuevo ? 'color:red; font-weight:bold;' : 'color:#888;'}">[${h.hora}] ${h.nombre}</p>`).join('')}
        </div>
      </div>

      <script>
        let activo = sessionStorage.getItem('alarmaOk') === 'true';
        if(activo) {
          document.getElementById('btnS').style.background = '#444';
          document.getElementById('btnS').innerText = '✅ ALARMA CONECTADA';
        }

        function activar() {
          sessionStorage.setItem('alarmaOk', 'true');
          location.reload();
        }

        // FUNCIÓN DE SONIDO MEJORADA
        if (${hayNovedad} && activo) {
          try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            gain.gain.setValueAtTime(0.5, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1);
            osc.start();
            osc.stop(ctx.currentTime + 1);
          } catch(e) { console.error("Error audio:", e); }
        }

        setTimeout(() => location.reload(), 45000);
      </script>
    </body>
  `);
});

app.listen(process.env.PORT || 10000);
