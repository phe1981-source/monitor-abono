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
  console.log("🚀 Iniciando Bot optimizado...");
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox', 
      '--disable-blink-features=AutomationControlled',
      '--window-size=1920,1080'
    ]
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

  try {
    // --- PROCESO DE LOGIN ---
    logEstado = "Intentando Login...";
    await page.goto('https://compras.abonoteatro.com/login/', { waitUntil: 'networkidle2', timeout: 60000 });
    
    // Aceptar cookies si aparecen
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button, a')).find(b => 
        b.innerText.includes('Aceptar') || b.innerText.includes('ENTRAR')
      );
      if (btn) btn.click();
    }).catch(() => {});

    await page.waitForSelector('#nabonadologin', { timeout: 10000 }).catch(() => {});
    await page.type('#nabonadologin', USER);
    await page.type('#contrasenalogin', PASS);
    
    await Promise.all([
      page.click('input[value="Entrar"].buyBtn'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 })
    ]);

    console.log("✅ Login completado con éxito.");

    // --- BUCLE DE MONITOREO ---
    while (true) {
      logEstado = "Escaneando cartelera...";
      await page.goto('https://compras.abonoteatro.com/teatro/', { waitUntil: 'networkidle2', timeout: 90000 });
      
      try {
        // Esperar a que el iframe principal aparezca
        await page.waitForSelector('iframe', { timeout: 30000 });
        const frameElement = await page.$('iframe');
        const frame = await frameElement.contentFrame();

        // Esperar a que cargue el contenido interno (enlaces de eventos)
        await frame.waitForSelector('a', { timeout: 20000 });

        const data = await frame.evaluate(() => {
          // Selector más amplio para capturar títulos
          const titulos = Array.from(document.querySelectorAll('.tribe-events-list-event-title a, h3 a, .event-title a'));
          return titulos.map(el => el.innerText.trim()).filter(n => n.length > 2);
        });

        if (data && data.length > 0) {
          const nombresActuales = [...new Set(data)];
          const ahoraHora = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

          if (listaLimpia.length === 0) {
            console.log(`📥 Inicializando: ${nombresActuales.length} eventos.`);
            listaLimpia = nombresActuales.map(n => ({ nombre: n }));
            ultimaActualizacion = ahoraHora;
          } else {
            const anteriorNombres = listaLimpia.map(item => item.nombre);
            const detectadosAhora = nombresActuales.filter(n => !anteriorNombres.includes(n));

            if (detectadosAhora.length > 0) {
              historialNovedades.forEach(h => h.nuevo = false);

              for (const nombre of detectadosAhora) {
                try {
                  // Capturar Link Directo intentando entrar al evento
                  const handle = await frame.evaluateHandle((n) => {
                    const link = Array.from(document.querySelectorAll('a')).find(a => a.innerText.includes(n));
                    if (link) {
                      const card = link.closest('.tribe-events-list-event-details, .content, .tribe-common-g-row');
                      return card ? card.querySelector('a.buyBtn') : null;
                    }
                  }, nombre);

                  const btnComprar = handle.asElement();
                  if (btnComprar) {
                    const popupPromise = new Promise(x => browser.once('targetcreated', target => x(target.page())));
                    await btnComprar.click();
                    const popup = await popupPromise;

                    if (popup) {
                      await popup.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {});
                      linksDirectos.unshift({ nombre, url: popup.url(), hora: ahoraHora });
                      await popup.close();
                    }
                  }
                  historialNovedades.unshift({ nombre, hora: ahoraHora, nuevo: true });
                } catch (err) { console.log(`Error extrayendo link de ${nombre}`); }
              }
            }
            listaLimpia = nombresActuales.map(n => ({ nombre: n }));
            ultimaActualizacion = ahoraHora;
          }
        } else {
          logEstado = "⚠️ Iframe vacío (0 eventos)";
          // Si da 0 eventos, es posible que la sesión haya caducado
          console.log("Detectados 0 eventos. Revisando sesión...");
        }

      } catch (errIframe) {
        logEstado = "❌ Error leyendo Iframe";
        console.error("Error en iframe:", errIframe.message);
      }

      const esperaSegundos = obtenerEsperaAleatoria(120, 240); // 2 a 4 minutos
      const proximaCarga = new Date(Date.now() + esperaSegundos * 1000).toLocaleTimeString();
      logEstado = `Espera hasta ${proximaCarga}`;
      
      await new Promise(r => setTimeout(r, esperaSegundos * 1000)); 
    }
  } catch (error) {
    console.log("❌ ERROR CRÍTICO:", error.message);
    await page.screenshot({ path: 'error_debug.png' });
    if (browser) await browser.close();
    setTimeout(iniciarMonitor, 30000); 
  }
}

iniciarMonitor();

// --- SERVIDOR WEB ---
app.get('/', (req, res) => {
  const hayNovedad = historialNovedades.some(h => h.nuevo);
  res.send(`
    <body style="background:#000; color:#fff; font-family:sans-serif; padding:20px;">
      <div style="max-width:800px; margin:auto; background:#0a0a0a; padding:30px; border-radius:20px; border:1px solid #222;">
        <div style="text-align:right; margin-bottom:20px;">
          <button id="btnSonido" onclick="toggleSonido()" style="background:#444; color:#fff; border:none; padding:10px 20px; border-radius:10px; cursor:pointer; font-weight:bold;">
            🔇 Activar Sonido
          </button>
        </div>
        <header style="text-align:center; margin-bottom:40px;">
          <div style="color:#B9C800; font-size:1.1em; text-transform:uppercase; letter-spacing:2px;">Eventos en Cartelera</div>
          <div style="font-size:7em; font-weight:bold; color:#B9C800; line-height:1;">${listaLimpia.length}</div>
          <p style="color:#888; margin-top:15px;">Estado: <span style="color:#fff">${logEstado}</span></p>
          <p style="color:#888;">Última Sincro: <span style="color:#fff">${ultimaActualizacion}</span></p>
        </header>

        <section style="margin-bottom:30px;">
          <h3 style="color:#00ff00; border-left:4px solid #00ff00; padding-left:10px;">🚀 Links Directos</h3>
          <div style="background:#001a00; border:1px solid #004400; padding:20px; border-radius:12px;">
            ${linksDirectos.map(l => `
              <div style="margin-bottom:12px;">
                <a href="${l.url}" target="_blank" style="display:block; color:#fff; font-weight:bold; background:#006600; padding:15px; border-radius:8px; text-align:center; text-decoration:none; border:1px solid #00ff00; box-shadow: 0 4px 10px rgba(0,255,0,0.2);">
                  COMPRAR: ${l.nombre} <br><small style="opacity:0.8">${l.hora}</small>
                </a>
              </div>
            `).join('') || '<p style="color:#666; text-align:center;">Esperando nuevas entradas...</p>'}
          </div>
        </section>

        <section>
          <h3 style="color:#ff4400; border-left:4px solid #ff4400; padding-left:10px;">🔔 Historial Reciente</h3>
          <div style="background:#111; padding:20px; border-radius:12px; max-height:250px; overflow-y:auto; border:1px solid #222;">
            ${historialNovedades.map(h => `
              <p style="margin:8px 0; padding-bottom:8px; border-bottom:1px solid #222; ${h.nuevo ? 'color:#00ff00; font-weight:bold;' : 'color:#999;'}">
                <span style="color:#555;">[${h.hora}]</span> ${h.nombre} ${h.nuevo ? '🔥' : ''}
              </p>
            `).join('') || '<p style="color:#444;">Sin actividad.</p>'}
          </div>
        </section>
      </div>

      <script>
        let sonidoActivado = sessionStorage.getItem('sonidoLocal') === 'true';
        let audioCtx;
        
        function updateBtn() {
            const btn = document.getElementById('btnSonido');
            btn.innerText = sonidoActivado ? '🔊 Sonido Activo' : '🔇 Activar Sonido';
            btn.style.background = sonidoActivado ? '#B9C800' : '#444';
            btn.style.color = sonidoActivado ? '#000' : '#fff';
        }
        updateBtn();

        function toggleSonido() {
          sonidoActivado = !sonidoActivado;
          sessionStorage.setItem('sonidoLocal', sonidoActivado);
          updateBtn();
          if (sonidoActivado) {
            if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            audioCtx.resume();
            playBeep(440); // Sonido de prueba
          }
        }

        function playBeep(freq) {
          if (!sonidoActivado || !audioCtx) return;
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.frequency.setValueAtTime(freq || 880, audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 1);
          osc.start();
          osc.stop(audioCtx.currentTime + 1);
        }

        if (${hayNovedad} && sonidoActivado) {
          if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          setTimeout(() => { playBeep(880); playBeep(1200); }, 500);
        }

        // Auto-refresh cada 60 segundos
        setTimeout(() => location.reload(), 60000);
      </script>
    </body>
  `);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Monitor en puerto ${PORT}`));
