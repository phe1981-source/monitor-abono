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
let proximoEscaneo = "Pendiente";

function obtenerEsperaAleatoria(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

async function iniciarMonitor() {
  console.log("🚀 Monitor activo. Esperando eventos...");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
  });
  
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  try {
    logEstado = "Login...";
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

    while (true) {
      logEstado = "Escaneando cartelera...";
      await page.goto('https://compras.abonoteatro.com/teatro/', { waitUntil: 'domcontentloaded', timeout: 90000 });
      await page.waitForSelector('iframe', { timeout: 60000 });
      const frameElement = await page.$('iframe');

      if (frameElement) {
        const frame = await frameElement.contentFrame();
        const data = await frame.evaluate(() => {
          return Array.from(document.querySelectorAll('.tribe-events-list-event-title a, h3 a'))
            .map(el => el.innerText.trim()).filter(n => n !== "");
        });

        if (data && data.length > 0) {
          const nombresActuales = [...new Set(data)];
          const ahoraHora = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

          if (listaLimpia.length === 0) {
            listaLimpia = nombresActuales.map(n => ({ nombre: n }));
            ultimaActualizacion = ahoraHora;
          } else {
            const anteriorNombres = listaLimpia.map(item => item.nombre);
            const detectadosAhora = nombresActuales.filter(n => !anteriorNombres.includes(n));

            if (detectadosAhora.length > 0) {
              historialNovedades.forEach(h => h.nuevo = false);

              for (const nombre of detectadosAhora) {
                try {
                  // DEBUG STEP 01: Captura de pantalla al detectar
                  await page.screenshot({ path: `debug_01_lista_${nombre.replace(/ /g, '_')}.png` });

                  const handle = await frame.evaluateHandle((n) => {
                    const link = Array.from(document.querySelectorAll('a')).find(a => a.innerText.includes(n));
                    if (link) {
                      const card = link.closest('.tribe-events-list-event-details, .content, .tribe-events-calendar-list__event-details');
                      return card ? card.querySelector('a.buyBtn') : null;
                    }
                  }, nombre);

                  const btnComprarMaster = handle.asElement();
                  if (btnComprarMaster) {
                    const popup1Promise = new Promise(x => browser.once('targetcreated', target => x(target.page())));
                    await btnComprarMaster.click();
                    const popup1 = await popup1Promise;

                    if (popup1) {
                      await popup1.waitForSelector('a.buyBtn', { timeout: 15000 }).catch(() => {});
                      // DEBUG STEP 02: Captura del popup
                      await popup1.screenshot({ path: `debug_02_popup_${nombre.replace(/ /g, '_')}.png` });

                      const botones = await popup1.$$('a.buyBtn');
                      if (botones.length >= 2) {
                        const popup2Promise = new Promise(x => browser.once('targetcreated', target => x(target.page())));
                        await botones[1].click(); 
                        const popup2 = await popup2Promise;
                        if (popup2) {
                          await popup2.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
                          const urlFinal = popup2.url();
                          // DEBUG STEP 03: Captura pasarela final
                          await popup2.screenshot({ path: `debug_03_pasarela_${nombre.replace(/ /g, '_')}.png` });
                          linksDirectos.unshift({ nombre, url: urlFinal, hora: ahoraHora, timestamp: Date.now() });
                          await popup2.close();
                        }
                      }
                      await popup1.close();
                    }
                  }
                  historialNovedades.unshift({ nombre, hora: ahoraHora, timestamp: Date.now(), nuevo: true });
                } catch (e) { console.log(`Error en ${nombre}: ${e.message}`); }
              }
            }
            listaLimpia = nombresActuales.map(n => ({ nombre: n }));
            ultimaActualizacion = ahoraHora;
          }
        }
      }
      const espera = obtenerEsperaAleatoria(180, 300);
      proximoEscaneo = `${Math.floor(espera/60)}m ${espera%60}s`;
      logEstado = `Espera (${proximoEscaneo})`;
      await new Promise(r => setTimeout(r, espera * 1000)); 
    }
  } catch (error) {
    if (browser) await browser.close();
    setTimeout(iniciarMonitor, 30000); 
  }
}

iniciarMonitor();

app.get('/', (req, res) => {
  const hayNovedadReciente = historialNovedades.some(h => h.nuevo);

  res.send(`
    <body style="background:#000; color:#fff; font-family:sans-serif; padding:20px;">
      <div style="max-width:800px; margin:auto; background:#0a0a0a; padding:30px; border-radius:20px; border:1px solid #222;">
        <header style="text-align:center; margin-bottom:40px;">
          <button id="sound-toggle" style="float:right; padding: 10px; background: #B9C800; color: #000; border: none; border-radius: 5px; cursor: pointer; font-weight:bold;">Cargando Sonido...</button>
          <div style="color:#B9C800; font-size:1.1em; text-transform:uppercase;">Eventos Totales</div>
          <div style="font-size:6em; font-weight:bold; color:#B9C800;">${listaLimpia.length}</div>
          <div style="background:#111; padding:15px; border-radius:10px; border:1px solid #222; display:inline-block; width:100%; text-align:left;">
            <p><strong>Estado:</strong> ${logEstado} | <strong>Sincro:</strong> ${ultimaActualizacion}</p>
          </div>
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
        const soundToggle = document.getElementById('sound-toggle');
        let audioCtx;
        let soundEnabled = sessionStorage.getItem('soundEnabled') === 'true';

        function updateUI() {
          soundToggle.textContent = soundEnabled ? '🔊 Sonido: ON' : '🔇 Sonido: OFF';
          soundToggle.style.background = soundEnabled ? '#B9C800' : '#555';
        }

        function playBeep() {
          if (!audioCtx || !soundEnabled) return;
          const osc = audioCtx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(880, audioCtx.currentTime);
          osc.connect(audioCtx.destination);
          osc.start();
          osc.stop(audioCtx.currentTime + 0.3);
        }

        soundToggle.addEventListener('click', () => {
          if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          soundEnabled = !soundEnabled;
          sessionStorage.setItem('soundEnabled', soundEnabled);
          updateUI();
          if (soundEnabled) playBeep();
        });

        // Al cargar, si había novedad y sonido activo, sonar
        window.onload = () => {
          updateUI();
          if (${hayNovedadReciente} && soundEnabled) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            setTimeout(playBeep, 500);
          }
        };

        setTimeout(() => location.reload(), 60000);
      </script>
    </body>
  `);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Servidor en puerto ${PORT}`));
