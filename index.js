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
                try {
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
                      await popup1.screenshot({ path: `debug_02_popup_${nombre.replace(/ /g, '_')}.png` });

                      const botones = await popup1.$$('a.buyBtn');
                      if (botones.length >= 2) {
                        const popup2Promise = new Promise(x => browser.once('targetcreated', target => x(target.page())));
                        await botones[1].click(); 
                        const popup2 = await popup2Promise;

                        if (popup2) {
                          await popup2.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
                          const urlFinal = popup2.url();
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
