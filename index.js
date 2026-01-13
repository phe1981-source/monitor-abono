const puppeteer = require('puppeteer');
const express = require('express');
const app = express();

const USER = 'phe1981@gmail.com';
const PASS = process.env.ABONO_PASS; 

let listaLimpia = []; 
let historialNovedades = []; 
let logEstado = "Iniciando...";
let ultimaActualizacion = "Sin datos";

async function iniciarMonitor() {
  console.log("🚀 Iniciando Bot V3.1.5 - Restaurando Motor Antiguo...");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled']
  });
  
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  try {
    logEstado = "Login...";
    await page.goto('https://compras.abonoteatro.com/login/', { waitUntil: 'networkidle2', timeout: 90000 });
    await page.type('#nabonadologin', USER);
    await page.type('#contrasenalogin', PASS || "");
    await page.click('input[value="Entrar"].buyBtn');
    
    await page.waitForSelector('iframe', { timeout: 90000 });
    console.log("✅ Login OK");

    while (true) {
      logEstado = "Escaneando...";
      await page.goto('https://compras.abonoteatro.com/teatro/', { waitUntil: 'domcontentloaded', timeout: 90000 });
      
      // ESPERA DE SEGURIDAD LEGACY (20 segundos como antes)
      await new Promise(r => setTimeout(r, 20000)); 

      const frameElement = await page.$('iframe');
      if (frameElement) {
        const frame = await frameElement.contentFrame();
        const data = await frame.evaluate(() => {
          // LÓGICA ANTIGUA RESTAURADA
          const elementos = document.querySelectorAll('.tribe-events-list-event-title a, h3 a, .tribe-events-calendar-list__event-title a');
          const options = document.querySelectorAll('#select_recinto_event option');
          
          const fromLinks = Array.from(elementos).map(el => ({ nombre: el.innerText.trim(), url: el.href }));
          const fromOptions = Array.from(options).map(el => ({ nombre: el.innerText.trim(), url: '#' }))
                                   .filter(item => item.nombre !== "" && item.nombre !== "-- Seleccione --");

          return [...fromLinks, ...fromOptions].filter(item => item.nombre);
        });

        if (data && data.length > 0) {
          const uniqueData = data.filter((item, index, self) => 
            item.nombre && index === self.findIndex((t) => t.nombre === item.nombre)
          );
          
          const ahoraHora = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
          
          if (listaLimpia.length > 0) {
            const anteriorNombres = listaLimpia.map(i => i.nombre);
            const detectados = uniqueData.filter(i => !anteriorNombres.includes(i.nombre));
            detectados.forEach(item => {
              historialNovedades.unshift({ nombre: item.nombre, hora: ahoraHora, nuevo: true });
            });
          }

          listaLimpia = uniqueData;
          ultimaActualizacion = ahoraHora;
          console.log(`📊 Escaneo: ${listaLimpia.length} eventos.`);
        }
      }
      
      const espera = Math.floor(Math.random() * (300 - 90 + 1) + 90);
      logEstado = `Espera (${espera}s)`;
      await new Promise(r => setTimeout(r, espera * 1000));
    }
  } catch (error) {
    console.log("❌ Error:", error.message);
    if (browser) await browser.close();
    setTimeout(iniciarMonitor, 30000);
  }
}

iniciarMonitor();

app.get('/', (req, res) => {
  const hayNovedad = historialNovedades.some(h => h.nuevo);
  res.send(`
    <body style="background:#000; color:#fff; font-family:sans-serif; padding:20px;">
      <div style="max-width:900px; margin:auto; border:1px solid #333; padding:25px; border-radius:15px; background:#0a0a0a;">
        <header style="text-align:center; margin-bottom:30px;">
          <h1 style="color:#B9C800; margin:0;">MONITOR V3.1.5</h1>
          <p style="color:#666;">Sincronizado: ${ultimaActualizacion}</p>
          <div style="font-size:5em; font-weight:bold; color:#B9C800;">${listaLimpia.length}</div>
          <div style="color:#444;">Eventos Totales</div>
        </header>
        <div style="background:#111; border:1px solid #ff4400; padding:15px; border-radius:12px; margin-bottom:20px;">
          <h3 style="color:#ff4400; margin-top:0;">🔔 ALERTAS (${historialNovedades.length})</h3>
          <div style="max-height:200px; overflow-y:auto;">
            ${historialNovedades.map(h => `<div style="padding:5px 0; border-bottom:1px solid #222;">[${h.hora}] ${h.nombre}</div>`).join('')}
          </div>
        </div>
        <p style="text-align:center; color:#444;">Estado: ${logEstado} | Refresco: 30s</p>
        <button onclick="sessionStorage.setItem('s','true'); location.reload();" style="display:block; width:100%; padding:10px; background:#444; color:#fff; border:none; border-radius:10px;">🔊 Activar Sonido</button>
      </div>
      <script>
        if(${hayNovedad} && sessionStorage.getItem('s')==='true'){
          const c=new AudioContext(); const o=c.createOscillator(); o.connect(c.destination); o.start(); setTimeout(()=>o.stop(),300);
        }
        setTimeout(()=>location.reload(), 30000);
      </script>
    </body>
  `);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0');
