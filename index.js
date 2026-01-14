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
  console.log("🚀 [SISTEMA] Iniciando Monitor V6.1 - Modo Debug");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.setDefaultNavigationTimeout(120000); 

  try {
    logEstado = "Realizando Login...";
    console.log("⏳ [LOGIN] Accediendo a la web...");
    await page.goto('https://compras.abonoteatro.com/login/', { waitUntil: 'networkidle2' });
    
    await page.type('#nabonadologin', USER);
    await page.type('#contrasenalogin', PASS);
    console.log("🔑 [LOGIN] Credenciales escritas, enviando...");
    await page.click('input[value="Entrar"].buyBtn');
    
    await page.waitForSelector('iframe', { timeout: 120000 });
    console.log("✅ [LOGIN] Login OK - Iframe detectado");

    while (true) {
      logEstado = "Escaneando cartelera...";
      console.log("📡 [SCAN] Navegando a sección teatro...");
      await page.goto('https://compras.abonoteatro.com/teatro/', { waitUntil: 'domcontentloaded' });
      
      console.log("⏱️ [SCAN] Esperando 20s para carga de contenido...");
      await new Promise(r => setTimeout(r, 20000)); 

      const frameElement = await page.$('iframe');
      if (frameElement) {
        console.log("🖼️ [SCAN] Accediendo al contenido del Iframe...");
        const frame = await frameElement.contentFrame();
        
        const data = await frame.evaluate(() => {
          const links = Array.from(document.querySelectorAll('.tribe-events-list-event-title a, h3 a'))
                             .map(el => el.innerText.trim());
          return [...new Set(links)].filter(n => n.length > 2);
        });

        console.log(`📊 [SCAN] Datos extraídos: ${data.length} eventos encontrados.`);

        if (data && data.length > 0) {
          const ahora = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          
          if (listaLimpia.length > 0) {
            const detectados = data.filter(n => !listaLimpia.includes(n));
            if (detectados.length > 0) {
              console.log(`🔔 [ALERTA] ${detectados.length} novedades detectadas!`);
              detectados.forEach(nombre => {
                historialNovedades.unshift({ nombre, hora: ahora, nuevo: true });
              });
            }
          } else {
            console.log("📦 [SISTEMA] Primera carga de datos completada.");
          }
          
          listaLimpia = data;
          ultimaActualizacion = ahora;
          logEstado = "En espera (90s)";
        } else {
          console.log("⚠️ [WARN] El Iframe devolvió 0 eventos. ¿Está vacío?");
          logEstado = "Error: Iframe vacío";
        }
      } else {
        console.log("❌ [ERROR] No se encontró el Iframe en la página de teatro.");
        logEstado = "Error: Sin Iframe";
      }
      
      console.log("😴 [SLEEP] Ciclo terminado. Durmiendo 90 segundos...");
      await new Promise(r => setTimeout(r, 90000));
    }
  } catch (error) {
    console.log("❌ [CRITICAL] Error en el monitor:", error.message);
    logEstado = "Error crítico: Reiniciando...";
    await browser.close().catch(() => {});
    setTimeout(iniciarMonitor, 15000);
  }
}

iniciarMonitor();

// INTERFAZ
app.get('/', (req, res) => {
  const hayNovedad = historialNovedades.some(h => h.nuevo);
  res.send(`
    <body style="background:#000; color:#fff; font-family:sans-serif; text-align:center; padding:30px;">
      <div style="max-width:500px; margin:auto; border:1px solid #333; padding:20px; border-radius:20px; background:#050505;">
        <h3 style="color:#B9C800; margin-bottom:5px;">MONITOR ACTIVO</h3>
        <div style="font-size:7em; font-weight:bold; color:#B9C800;">${listaLimpia.length}</div>
        <p style="color:#888; margin-top:0;">Eventos Detectados</p>
        <div style="background:#111; padding:10px; border-radius:10px; margin:15px 0; font-size:0.9em;">
          <p>Estado: <span style="color:#fff;">${logEstado}</span></p>
          <p>Sincro: <span style="color:#fff;">${ultimaActualizacion}</span></p>
        </div>
        
        <button id="btnAudio" onclick="enableAudio()" style="width:100%; padding:15px; background:#B9C800; color:#000; border:none; border-radius:10px; font-weight:bold; cursor:pointer;">
           🔊 CONECTAR ALARMA SONORA
        </button>

        <div style="margin-top:25px; text-align:left;">
          <h4 style="color:orange; border-bottom:1px solid #222; padding-bottom:5px;">🔔 ÚLTIMOS CAMBIOS</h4>
          <div style="max-height:150px; overflow-y:auto;">
            ${historialNovedades.length === 0 ? '<p style="color:#444;">No hay cambios todavía</p>' : 
              historialNovedades.map(h => `<p style="font-size:0.85em; margin:5px 0; ${h.nuevo ? 'color:#ff4444; font-weight:bold;' : 'color:#666;'}">[${h.hora}] ${h.nombre}</p>`).join('')}
          </div>
        </div>
      </div>

      <script>
        let audioHabilitado = sessionStorage.getItem('audioOk') === 'true';
        if(audioHabilitado) {
          const b = document.getElementById('btnAudio');
          b.style.background = '#333'; b.style.color = '#00ff00'; b.innerText = '✅ SONIDO ACTIVADO';
        }

        function enableAudio() {
          sessionStorage.setItem('audioOk', 'true');
          // Forzar inicialización de AudioContext por gesto del usuario
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          location.reload();
        }

        if (${hayNovedad} && audioHabilitado) {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.frequency.value = 880;
          g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.5);
          o.start(); o.stop(ctx.currentTime + 1.5);
        }

        setTimeout(() => location.reload(), 45000);
      </script>
    </body>
  `);
});

app.listen(process.env.PORT || 10000, '0.0.0.0');
