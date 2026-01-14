const puppeteer = require('puppeteer');
const express = require('express');
const app = express();

const USER = 'phe1981@gmail.com';
const PASS = process.env.ABONO_PASS || 'fAsHaMp@gZie3g@';

let listaLimpia = []; 
let historialNovedades = []; 
let linksDirectos = []; 
let logEstado = "Iniciando...";
let ultimaActualizacion = "Sin datos";

function obtenerEsperaAleatoria(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

async function iniciarMonitor() {
  console.log("🚀 Iniciando Jules V3.4.0 - Robust Memory & URL Timeout...");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
  });
  
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  try {
    logEstado = "Intentando Login...";
    await page.goto('https://compras.abonoteatro.com/login/', { waitUntil: 'domcontentloaded', timeout: 90000 });
    
    // Aceptar cookies si aparecen
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button, a')).find(b => b.innerText.toLowerCase().includes('aceptar'));
      if (btn) btn.click();
    }).catch(() => {});

    await page.type('#nabonadologin', USER);
    await page.type('#contrasenalogin', PASS);
    
    await Promise.all([
      page.click('input[value="Entrar"].buyBtn'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 90000 })
    ]);

    console.log("✅ Login completado.");

    while (true) {
      logEstado = "Escaneando cartelera...";
      await page.goto('https://compras.abonoteatro.com/teatro/', { waitUntil: 'domcontentloaded', timeout: 90000 });
      
      // Espera crítica para carga de scripts internos del iframe
      await new Promise(r => setTimeout(r, 20000)); 

      // Selector específico para evitar iframes de terceros
      const frameElement = await page.$('iframe[src*="abonoteatro"], iframe[src*="tribe-events"]');
      
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
          const nombresActuales = [...new Set(data)];
          const ahoraHora = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

          if (listaLimpia.length === 0) {
            listaLimpia = nombresActuales.map(n => ({ nombre: n }));
            ultimaActualizacion = ahoraHora;
            console.log(`📥 Base inicializada: ${nombresActuales.length} eventos.`);
          } else {
            const anteriorNombres = listaLimpia.map(item => item.nombre);
            const detectadosAhora = nombresActuales.filter(n => !anteriorNombres.includes(n));

            if (detectadosAhora.length > 0) {
              // Resetear estado 'nuevo' de novedades anteriores
              historialNovedades.forEach(h => h.nuevo = false);

              for (const nombre of detectadosAhora) {
                console.log(`🔎 Procesando novedad: ${nombre}`);
                let page1 = null;
                let page2 = null;

                try {
                  // Paso 3: Clic en el título (Ruta directa)
                  const clicExitoso = await frame.evaluate((n) => {
                    const links = Array.from(document.querySelectorAll('.tribe-events-list-event-title a, h3 a'));
                    const target = links.find(a => a.innerText.trim().toLowerCase() === n.toLowerCase());
                    if (target) { target.scrollIntoView(); target.click(); return true; }
                    return false;
                  }, nombre);

                  if (clicExitoso) {
                    // Paso 4: Capturar primer popup con timeout de 15s
                    const target1 = await browser.waitForTarget(t => t.opener() === page.target(), { timeout: 15000 });
                    page1 = await target1.page();

                    if (page1) {
                      await page1.waitForSelector('a.buyBtn', { visible: true, timeout: 15000 });
                      const botones = await page1.$$('a.buyBtn');
                      
                      if (botones.length >= 2) {
                        // Paso 6: Capturar segundo popup (Pasarela de pago)
                        const target2Promise = browser.waitForTarget(t => t.opener() === target1.target(), { timeout: 15000 });
                        await botones[1].click();
                        const target2 = await target2Promise;
                        page2 = await target2.page();

                        if (page2) {
                          await page2.waitForNavigation({ waitUntil: 'networkidle0', timeout: 20000 }).catch(() => {});
                          linksDirectos.unshift({ nombre, url: page2.url(), hora: ahoraHora });
                          console.log(`🎯 URL generada con éxito para ${nombre}`);
                        }
                      }
                    }
                  }
                } catch (e) {
                  console.log(`🛑 Error al capturar URL de "${nombre}". La alarma se guardará igual.`);
                } finally {
                  // LIMPIEZA DE MEMORIA: Cerrar pestañas siempre, pase lo que pase
                  if (page2) await page2.close().catch(() => {});
                  if (page1) await page1.close().catch(() => {});
                }
                
                // Registro de la alarma (siempre ocurre, incluso si falla la URL)
                historialNovedades.unshift({ nombre, hora: ahoraHora, timestamp: Date.now(), nuevo: true });
              }
            }
            listaLimpia = nombresActuales.map(n => ({ nombre: n }));
            ultimaActualizacion = ahoraHora;
          }
        }
      }
      
      const espera = obtenerEsperaAleatoria(180, 300);
      logEstado = `Espera (${Math.floor(espera/60)}m ${espera%60}s)`;
      await new Promise(r => setTimeout(r, espera * 1000)); 
    }
  } catch (error) {
    console.log("❌ ERROR CRÍTICO EN FLUJO:", error.message);
    if (browser) await browser.close();
    setTimeout(iniciarMonitor, 30000); 
  }
}

iniciarMonitor();

// Dashboard de Control Visual
app.get('/', (req, res) => {
  const hayNovedad = historialNovedades.some(h => h.nuevo);
  res.send(`
    <body style="background:#000; color:#fff; font-family:sans-serif; padding:20px;">
      <div style="max-width:800px; margin:auto; background:#0a0a0a; padding:30px; border-radius:20px; border:1px solid #222;">
        <div style="text-align:right; margin-bottom:20px;">
            <button id="btnSonido" onclick="toggleSonido()" style="background:#444; color:#fff; border:none; padding:10px 20px; border-radius:10px; cursor:pointer;">🔇 Activar Sonido</button>
        </div>
        <header style="text-align:center; margin-bottom:40px;">
          <div style="color:#B9C800; font-size:1.1em; text-transform:uppercase;">Eventos en Cartelera</div>
          <div style="font-size:6em; font-weight:bold; color:#B9C800;">${listaLimpia.length}</div>
          <p>Estado: ${logEstado} | Última Sincro: ${ultimaActualizacion}</p>
        </header>
        <section style="margin-bottom:30px;">
          <h3 style="color:#00ff00; border-left:4px solid #00ff00; padding-left:10px;">🚀 Links Directos (Pasarela)</h3>
          <div style="background:#001a00; border:1px solid #00ff00; padding:20px; border-radius:12px;">
            ${linksDirectos.map(l => `<div style="margin-bottom:10px;"><a href="${l.url}" target="_blank" style="display:block; color:#fff; font-weight:bold; background:#004d00; padding:12px; border-radius:8px; text-align:center; text-decoration:none; border:1px solid #00ff00;">${l.nombre} [${l.hora}]</a></div>`).join('') || '<p style="color:#444;">No hay links directos aún. Escaneando...</p>'}
          </div>
        </section>
        <section>
          <h3 style="color:#ff4400; border-left:4px solid #ff4400; padding-left:10px;">🔔 Historial y Alarmas</h3>
          <div style="background:#111; padding:20px; border-radius:12px; max-height:200px; overflow-y:auto;">
            ${historialNovedades.map(h => `<p style="${h.nuevo ? 'color:#ff0000; font-weight:bold;' : 'color:orange;'}">[${h.hora}] ${h.nombre}</p>`).join('')}
          </div>
        </section>
      </div>
      <script>
        let sonidoActivado = sessionStorage.getItem('sonidoLocal') === 'true';
        let audioCtx;
        
        // Memoria de lo que ya hemos pitado para no repetir en cada refresh
        let ultimaNovedadPitada = localStorage.getItem('ultimaNovedad');
        const novedadActual = "${historialNovedades.length > 0 ? historialNovedades[0].timestamp : ''}";

        function updateBtn() {
            const btn = document.getElementById('btnSonido');
            btn.innerText = sonidoActivado ? '🔊 Sonido Activo' : '🔇 Activar Sonido';
            btn.style.background = sonidoActivado ? '#00ff00' : '#444';
        }
        updateBtn();

        function toggleSonido() {
          sonidoActivado = !sonidoActivado;
          sessionStorage.setItem('sonidoLocal', sonidoActivado);
          updateBtn();
          if (sonidoActivado) { 
            if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); 
            audioCtx.resume(); 
            // Pitido de confirmación al activar
            tocarPitido(440, 0.1);
          }
        }

        function tocarPitido(frecuencia, duracion) {
          if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          audioCtx.resume().then(() => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.frequency.setValueAtTime(frecuencia, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duracion);
            osc.start();
            osc.stop(audioCtx.currentTime + duracion);
          });
        }

        // Lógica de Alarma: Solo si hay novedad, el sonido está activo Y no hemos pitado esta novedad antes
        if (${hayNovedad} && sonidoActivado && ultimaNovedadPitada !== novedadActual) {
          tocarPitido(880, 0.5); // Pitido más largo y claro
          localStorage.setItem('ultimaNovedad', novedadActual); // Marcar como pitada
        }

        setTimeout(() => location.reload(), 60000);
      </script>
    </body>
  `);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0');
