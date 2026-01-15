const puppeteer = require('puppeteer');
const express = require('express');
const { extraerLinkCompra } = require('./extractor'); 
const app = express();

// --- CONFIGURACIÓN SEGURA ---
const USER = 'phe1981@gmail.com';
// Ya no hay password en el texto. Se lee de la variable de entorno ABONO_PASS
const PASS = process.env.ABONO_PASS; 

if (!PASS) {
  console.error("❌ [CRITICAL] No se ha detectado la variable ABONO_PASS. El login fallará.");
}

let listaLimpia = []; 
let historialNovedades = []; 
let linksDirectos = []; 
let logEstado = "Iniciando...";
let ultimaActualizacion = "Sin datos";
let proximoEscaneo = "Calculando...";
let ultimasNovedadesDetectadas = 0; 
let listaBrutaLength = 0; 

function obtenerEsperaAleatoria(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

async function iniciarMonitor() {
  console.log("🚀 [SISTEMA] Iniciando Bot V4.0.0 - Distributed Architecture Edition");
  
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled']
  });
  
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  try {
    logEstado = "Login...";
    await page.goto('https://compras.abonoteatro.com/login/', { waitUntil: 'networkidle2', timeout: 90000 });
    
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Aceptar'));
      if (btn) btn.click();
    }).catch(() => {});

    await page.type('#nabonadologin', USER);
    await page.type('#contrasenalogin', PASS || '');
    
    await Promise.all([
      page.click('input[value="Entrar"].buyBtn'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 90000 })
    ]);

    console.log("✅ [SISTEMA] Login exitoso.");

    while (true) {
      logEstado = "Scanning...";
      await page.goto('https://compras.abonoteatro.com/teatro/', { waitUntil: 'domcontentloaded', timeout: 90000 });
      await new Promise(r => setTimeout(r, 20000)); 

      const frameElement = await page.$('iframe');
      if (frameElement) {
        const frame = await frameElement.contentFrame();
        const data = await frame.evaluate(() => {
          const visuales = Array.from(document.querySelectorAll('.tribe-events-list-event-title a, h3 a, .tribe-events-calendar-list__event-title a'))
            .map(el => el.innerText.trim());
          const opciones = Array.from(document.querySelectorAll('#select_recinto_event option'))
            .map(el => el.innerText.trim())
            .filter(n => n !== "" && n !== "-- Seleccione --");
          return [...new Set([...visuales, ...opciones])].filter(n => n.length > 2);
        });

        if (data && data.length > 0) {
          listaBrutaLength = data.length;
          const nombresActuales = [...new Set(data)];
          const ahoraHora = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

          if (listaLimpia.length === 0) {
            listaLimpia = nombresActuales.map(n => ({ nombre: n }));
            ultimaActualizacion = ahoraHora;
            ultimasNovedadesDetectadas = 0;
          } else {
            const anteriorNombres = listaLimpia.map(item => item.nombre);
            const detectadosAhora = nombresActuales.filter(n => !anteriorNombres.includes(n));
            
            ultimasNovedadesDetectadas = detectadosAhora.length;

            if (detectadosAhora.length > 0) {
              historialNovedades.forEach(h => h.nuevo = false);
              for (const nombre of detectadosAhora) {
                historialNovedades.unshift({ nombre, hora: ahoraHora, nuevo: true });
                
                // Extracción con timeout (Garantía FDIR)
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 30000));
                try {
                    const resultado = await Promise.race([extraerLinkCompra(browser, page, frame, nombre), timeoutPromise]);
                    if (resultado && resultado.url) {
                        linksDirectos.unshift({ nombre: `${nombre} (${resultado.metodo})`, url: resultado.url, hora: ahoraHora });
                    }
                } catch (e) { console.log(`⚠️ Extracción fallida: ${nombre}`); }
              }
            }
            listaLimpia = nombresActuales.map(n => ({ nombre: n }));
            ultimaActualizacion = ahoraHora;
          }
        }
      }

      const espera = obtenerEsperaAleatoria(180, 240);
      proximoEscaneo = `${Math.floor(espera/60)}m ${espera%60}s`;
      await new Promise(r => setTimeout(r, espera * 1000)); 
    }
  } catch (error) {
    console.error("❌ Error Crítico:", error.message);
    if (browser) await browser.close();
    setTimeout(iniciarMonitor, 30000); 
  }
}

iniciarMonitor();

// --- DASHBOARD V4.0.0 ---
app.get('/', (req, res) => {
  const tieneNovedades = ultimasNovedadesDetectadas > 0;
  const colorBadge = tieneNovedades ? '#ff0000' : '#444'; 
  const animacion = tieneNovedades ? 'animation: blinker 1.5s linear infinite;' : '';

  res.send(`
    <style>
      @keyframes blinker { 50% { opacity: 0; } }
      .scroll-custom::-webkit-scrollbar { width: 8px; }
      .scroll-custom::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
      body { background:#000; color:#fff; font-family:sans-serif; padding:20px; }
      .container { max-width:900px; margin:auto; border:1px solid #333; padding:25px; border-radius:15px; background:#0a0a0a; }
    </style>

    <div class="container">
      <header style="text-align:center; margin-bottom:30px;">
        <h1 style="color:#B9C800; font-size:1em; margin-bottom:20px; letter-spacing:2px; opacity: 0.6;">MONITOR AGILE V4.0.0</h1>
        
        <div style="line-height:1;">
          <span style="font-size:6em; font-weight:bold; color:#ff4400;">${historialNovedades.length}</span>
          <span style="font-size:2.5em; font-weight:bold; color:${colorBadge}; ${animacion}"> (+${ultimasNovedadesDetectadas})</span>
        </div>
        <div style="color:#666; text-transform:uppercase; font-size:0.8em; margin-top:5px;">Alertas (Últimas 12h)</div>

        <div style="margin-top:25px;">
          <span style="font-size:2.5em; font-weight:bold; color:#B9C800;">${listaBrutaLength}</span>
          <div style="color:#444; text-transform:uppercase; font-size:0.7em;">Eventos Totales en Sistema</div>
        </div>
      </header>

      <div style="background:#111; padding:12px; border-radius:8px; text-align:center; font-size:0.9em; color:#888; margin-bottom:25px; border:1px solid #222;">
        Última Lectura: <b>${ultimaActualizacion}</b> | Próxima en: <b>${proximoEscaneo}</b>
      </div>

      <section style="margin-bottom:25px;">
        <div style="background:#111; border-left:4px solid #ff4400; padding:15px; border-radius:4px;">
          <h3 style="color:#ff4400; margin:0 0 10px 0; font-size:0.8em;">🔔 HISTORIAL DE NOVEDADES</h3>
          <div class="scroll-custom" style="max-height:180px; overflow-y:auto;">
            ${historialNovedades.length > 0 ? `
              <table style="width:100%; border-collapse:collapse;">
                ${historialNovedades.map(h => `
                  <tr style="border-bottom:1px solid #222;">
                    <td style="padding:8px; color:#555; width:70px; font-size:0.8em;">${h.hora}</td>
                    <td style="padding:8px;"><span style="${h.nuevo ? 'color:#ff0000; font-weight:bold;' : 'color:#ffbb00;'}">${h.nombre}</span></td>
                  </tr>`).join('')}
              </table>` : '<p style="color:#333; text-align:center;">Buscando novedades...</p>'}
          </div>
        </div>
      </section>

      <section>
        <div style="background:#050505; border:1px solid #222; padding:15px; border-radius:4px;">
          <h3 style="color:#B9C800; margin:0 0 10px 0; font-size:0.8em;">📋 LINKS DE COMPRA DIRECTA (${linksDirectos.length})</h3>
          <div class="scroll-custom" style="max-height:300px; overflow-y:auto;">
            <table style="width:100%; border-collapse:collapse; font-size:0.9em;">
              ${linksDirectos.map((ev, i) => `
                <tr style="border-bottom:1px solid #111;">
                  <td style="color:#333; width:30px; padding:8px;">${i+1}</td>
                  <td style="padding:8px;"><a href="${ev.url}" target="_blank" style="color:#00ffcc; text-decoration:none;">${ev.nombre}</a></td>
                  <td style="color:#333; font-size:0.7em; text-align:right;">${ev.hora}</td>
                </tr>`).join('')}
            </table>
          </div>
        </div>
      </section>
    </div>

    <div id="audio-overlay" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.98); color:#fff; display:flex; justify-content:center; align-items:center; z-index:1000; cursor:pointer; text-align:center;">
      <div>
        <div style="font-size:4em; color:#B9C800; margin-bottom:15px;">📡</div>
        <div style="font-size:1.2em; letter-spacing:1px;">CLICK PARA INICIAR V4.0.0</div>
      </div>
    </div>

    <script>
      const audioOverlay = document.getElementById('audio-overlay');
      const isAudioEnabled = () => sessionStorage.getItem('audioEnabled') === 'true';

      audioOverlay.addEventListener('click', () => {
        sessionStorage.setItem('audioEnabled', 'true');
        audioOverlay.style.display = 'none';
        location.reload(); 
      });

      if (isAudioEnabled()) audioOverlay.style.display = 'none';

      if (${tieneNovedades} && isAudioEnabled()) {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 1);
      }

      setTimeout(() => location.reload(), 60000);
    </script>
  `);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0');
