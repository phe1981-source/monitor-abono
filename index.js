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
  console.log("🚀 Iniciando Bot con Sonido en Cliente y Debug Visual...");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
  });
  
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  try {
    logEstado = "Intentando Login...";
    await page.goto('https://compras.abonoteatro.com/login/', { waitUntil: 'domcontentloaded', timeout: 90000 });
    
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Aceptar'));
      if (btn) btn.click();
    }).catch(() => {});

    await page.type('#nabonadologin', USER);
    await page.type('#contrasenalogin', PASS);
    
    await Promise.all([
      page.click('input[value="Entrar"].buyBtn'),
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 90000 })
    ]);

    console.log("✅ Login completado.");

    while (true) {
      logEstado = "Escaneando cartelera...";
      await page.goto('https://compras.abonoteatro.com/teatro/', { waitUntil: 'domcontentloaded', timeout: 90000 });
      
      await page.waitForSelector('iframe', { timeout: 60000 });
      const frameElement = await page.$('iframe');

      if (frameElement) {
        const frame = await frameElement.contentFrame();
        const data = await frame.evaluate(() => {
          return Array.from(document.querySelectorAll('.tribe-events-list-event-title a, h3 a'))
            .map(el => el.innerText.trim())
            .filter(n => n !== "");
        });

        if (data && data.length > 0) {
          const nombresActuales = [...new Set(data)];
          const ahoraHora = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

          if (listaLimpia.length === 0) {
            console.log(`📥 Inicializando base con ${nombresActuales.length} eventos.`);
            listaLimpia = nombresActuales.map(n => ({ nombre: n }));
            ultimaActualizacion = ahoraHora;
          } else {
            const anteriorNombres = listaLimpia.map(item => item.nombre);
            const detectadosAhora = nombresActuales.filter(n => !anteriorNombres.includes(n));

            if (detectadosAhora.length > 0) {
              historialNovedades.forEach(h => h.nuevo = false);

              for (const nombre of detectadosAhora) {
                console.log(`🔎 Procesando nuevo evento: ${nombre}`);
                try {
                  const safeNombre = nombre.replace(/[^a-zA-Z0-9]/g, '_');

                  // Step 1: Take screenshot of the main list
                  await page.screenshot({ path: `debug_01_lista_${safeNombre}.png` });
                  console.log(`📸 Screenshot 1/5: Lista principal para ${nombre}`);

                  const handle = await frame.evaluateHandle(async (n) => {
                    const links = Array.from(document.querySelectorAll('.tribe-events-list-event-title a, h3 a'));
                    const link = links.find(a => a.innerText.trim().toLowerCase() === n.trim().toLowerCase());

                    if (link) {
                      link.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      await new Promise(r => setTimeout(r, 500)); // Wait for scroll and reflow

                      const card = link.closest('.tribe-events-list-event-details, .content, .tribe-events-calendar-list__event-details');
                      if(card) {
                        return card.querySelector('a.buyBtn');
                      }
                    }
                    return null;
                  }, nombre);

                  const btnComprarMaster = handle.asElement();

                  if (btnComprarMaster) {
                    // Step 2: Click the first "Comprar" button and wait for popup
                    console.log(`🖱️ Step 2/7: Haciendo click en 'Comprar' para ${nombre}`);
                    const popup1Target = browser.waitForTarget(target => target.opener() === page.target());
                    await btnComprarMaster.click();
                    const newTarget1 = await popup1Target;
                    const popup1 = await newTarget1.page();

                    if (popup1) {
                      console.log(`✅ Step 3/7: Primer popup abierto.`);
                      await popup1.waitForSelector('a.buyBtn', { timeout: 20000 });

                      // Step 3: Take screenshot of the first popup
                      await popup1.screenshot({ path: `debug_02_popup1_${safeNombre}.png` });
                      console.log(`📸 Screenshot 2/5: Primer popup para ${nombre}`);

                      const botones = await popup1.$$('a.buyBtn');
                      if (botones.length >= 2) {
                        // Step 4: Click the second "Comprar" button
                        console.log(`🖱️ Step 4/7: Haciendo click en el segundo 'Comprar' del popup.`);
                        const popup2Target = browser.waitForTarget(target => target.opener() === newTarget1);
                        await botones[1].click();
                        const newTarget2 = await popup2Target;
                        const popup2 = await newTarget2.page();

                        if (popup2) {
                           // Step 5: Go to the new tab/window
                          console.log(`✅ Step 5/7: Segunda ventana/pestaña abierta.`);
                          await popup2.waitForNavigation({ waitUntil: 'networkidle0', timeout: 45000 }).catch(e => console.log(`Advertencia de navegación en popup 2: ${e.message}`));

                          // Step 6: Copy URL
                          const urlFinal = popup2.url();
                          console.log(`🔗 Step 6/7: URL final capturada: ${urlFinal}`);

                          await popup2.screenshot({ path: `debug_03_final_${safeNombre}.png` });
                          console.log(`📸 Screenshot 3/5: Página final para ${nombre}`);

                          // Step 7: List URL
                          linksDirectos.unshift({ nombre, url: urlFinal, hora: ahoraHora, timestamp: Date.now() });
                          console.log(`✅ Step 7/7: Link directo añadido para ${nombre}.`);

                          await popup2.close();
                        } else {
                          console.log(`❌ No se pudo abrir el segundo popup para ${nombre}.`);
                        }
                      } else {
                        console.log(`❌ No se encontraron suficientes botones 'Comprar' en el primer popup para ${nombre}.`);
                      }
                      await popup1.close();
                    } else {
                        console.log(`❌ No se pudo abrir el primer popup para ${nombre}.`);
                    }
                  } else {
                      console.log(`❌ No se encontró el botón 'Comprar' en la lista principal para ${nombre}.`);
                  }
                  historialNovedades.unshift({ nombre, hora: ahoraHora, timestamp: Date.now(), nuevo: true });

                } catch (e) {
                  console.log(`🛑 ERROR procesando "${nombre}": ${e.message}. Este evento será omitido, continuando con el siguiente.`);
                  // Taking a screenshot on error for better debugging
                  await page.screenshot({ path: `debug_error_${nombre.replace(/[^a-zA-Z0-9]/g, '_')}.png` });
                }
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
    console.log("❌ ERROR:", error.message);
    if (browser) await browser.close();
    setTimeout(iniciarMonitor, 30000); 
  }
}

iniciarMonitor();

app.get('/', (req, res) => {
  const hayNovedad = historialNovedades.some(h => h.nuevo);
  res.send(`
    <body style="background:#000; color:#fff; font-family:sans-serif; padding:20px;">
      <div style="max-width:800px; margin:auto; background:#0a0a0a; padding:30px; border-radius:20px; border:1px solid #222;">
        <div style="text-align:right; margin-bottom:20px;">
          <button id="btnSonido" onclick="toggleSonido()" style="background:#444; color:#fff; border:none; padding:10px 20px; border-radius:10px; cursor:pointer;">
            🔇 Activar Sonido
          </button>
        </div>
        <header style="text-align:center; margin-bottom:40px;">
          <div style="color:#B9C800; font-size:1.1em; text-transform:uppercase;">Eventos Totales</div>
          <div style="font-size:6em; font-weight:bold; color:#B9C800;">${listaLimpia.length}</div>
          <p>Estado: ${logEstado} | Sincro: ${ultimaActualizacion}</p>
        </header>
        <section style="margin-bottom:30px;">
          <h3 style="color:#00ff00; border-left:4px solid #00ff00; padding-left:10px;">🚀 Links Directos</h3>
          <div style="background:#001a00; border:1px solid #00ff00; padding:20px; border-radius:12px;">
            ${linksDirectos.map(l => `
              <div style="margin-bottom:10px;">
                <a href="${l.url}" target="_blank" style="display:block; color:#fff; font-weight:bold; background:#004d00; padding:12px; border-radius:8px; text-align:center; text-decoration:none; border:1px solid #00ff00;">
                  ${l.nombre} [${l.hora}]
                </a>
              </div>
            `).join('') || '<p>Esperando novedades...</p>'}
          </div>
        </section>
        <section>
          <h3 style="color:#ff4400; border-left:4px solid #ff4400; padding-left:10px;">🔔 Historial</h3>
          <div style="background:#111; padding:20px; border-radius:12px; max-height:200px; overflow-y:auto;">
            ${historialNovedades.map(h => `<p style="${h.nuevo ? 'color:#ff0000; font-weight:bold;' : 'color:orange;'}">[${h.hora}] ${h.nombre}</p>`).join('')}
          </div>
        </section>
      </div>
      <script>
        let sonidoActivado = sessionStorage.getItem('sonidoLocal') === 'true';
        let audioCtx;
        
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
            playBeep();
          }
        }

        function playBeep() {
          if (!sonidoActivado || !audioCtx) return;
          const osc = audioCtx.createOscillator();
          osc.connect(audioCtx.destination);
          osc.frequency.setValueAtTime(880, audioCtx.currentTime);
          osc.start();
          setTimeout(() => osc.stop(), 200);
        }

        if (${hayNovedad} && sonidoActivado) {
          if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          setTimeout(playBeep, 1000);
        }
        setTimeout(() => location.reload(), 60000);
      </script>
    </body>
  `);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Servidor iniciado en puerto ${PORT}`));
