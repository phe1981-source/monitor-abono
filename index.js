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
  console.log("🚀 Iniciando Bot V3.2.0 - Jules Hyperlink Edition...");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled']
  });
  
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  try {
    logEstado = "Intentando Login...";
    await page.goto('https://compras.abonoteatro.com/login/', { waitUntil: 'networkidle2', timeout: 90000 });
    
    await page.type('#nabonadologin', USER);
    await page.type('#contrasenalogin', PASS);
    
    await Promise.all([
      page.click('input[value="Entrar"].buyBtn'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 90000 })
    ]);

    console.log("✅ Login completado.");

    while (true) {
      logEstado = "Escaneando...";
      await page.goto('https://compras.abonoteatro.com/teatro/', { waitUntil: 'domcontentloaded', timeout: 90000 });
      
      // Espera para que el iframe cargue contenido interno
      await new Promise(r => setTimeout(r, 20000)); 

      const frameElement = await page.$('iframe');
      if (frameElement) {
        const frame = await frameElement.contentFrame();
        // Extraemos nombres
        const data = await frame.evaluate(() => {
          const visuales = Array.from(document.querySelectorAll('.tribe-events-list-event-title a, h3 a, .tribe-events-calendar-list__event-title a')).map(el => el.innerText.trim());
          const opciones = Array.from(document.querySelectorAll('#select_recinto_event option')).map(el => el.innerText.trim()).filter(n => n !== "" && n !== "-- Seleccione --");
          return [...new Set([...visuales, ...opciones])].filter(n => n.length > 2);
        });

        if (data && data.length > 0) {
          console.log(`📊 Escaneados ${data.length} eventos.`);
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
                console.log(`🔎 Jules extrayendo link para: ${nombre}`);
                try {
                  // CLICK EN EL TÍTULO
                  const clicExitoso = await frame.evaluate((n) => {
                    const links = Array.from(document.querySelectorAll('.tribe-events-list-event-title a, h3 a'));
                    const target = links.find(a => a.innerText.trim().toLowerCase() === n.toLowerCase());
                    if (target) { target.scrollIntoView(); target.click(); return true; }
                    return false;
                  }, nombre);

                  if (clicExitoso) {
                    // ESPERAR POPUP 1 (Info)
                    const newTarget = await browser.waitForTarget(t => t.opener() === page.target(), { timeout: 15000 });
                    const page1 = await newTarget.page();
                    if (page1) {
                      await page1.waitForSelector('a.buyBtn', { timeout: 15000 });
                      const botones = await page1.$$('a.buyBtn');
                      if (botones.length >= 2) {
                        // CLICK COMPRAR -> ESPERAR POPUP 2 (Pasarela)
                        const target2Promise = browser.waitForTarget(t => t.opener() === newTarget, { timeout: 15000 });
                        await botones[1].click();
                        const page2 = await (await target2Promise).page();
                        if (page2) {
                          await page2.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {});
                          linksDirectos.unshift({ nombre, url: page2.url(), hora: ahoraHora });
                          await page2.close();
                        }
                      }
                      await page1.close();
                    }
                  }
                } catch (e) { console.log(`🛑 Error link "${nombre}": ${e.message}`); }
                historialNovedades.unshift({ nombre, hora: ahoraHora, nuevo: true });
              }
            }
            listaLimpia = nombresActuales.map(n => ({ nombre: n }));
            ultimaActualizacion = ahoraHora;
          }
        }
      }
      const espera = obtenerEsperaAleatoria(120, 180);
      logEstado = `Espera ${Math.floor(espera/60)}m...`;
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
        <div style="text-align:right; margin-bottom:20px;"><button id="btnSonido" onclick="toggleSonido()" style="background:#444; color:#fff; border:none; padding:10px 20px; border-radius:10px; cursor:pointer;">Activar Sonido</button></div>
        <header style="text-align:center; margin-bottom:40px;">
          <div style="font-size:6em; font-weight:bold; color:#B9C800;">${listaLimpia.length}</div>
          <p>Estado: ${logEstado} | Sincro: ${ultimaActualizacion}</p>
        </header>
        <section style="margin-bottom:30px;">
          <h3 style="color:#00ff00;">🚀 Links Directos</h3>
          <div style="background:#111; padding:15px; border-radius:12px; border:1px solid #00ff00;">
            ${linksDirectos.map(l => `<a href="${l.url}" target="_blank" style="display:block; color:#fff; background:#004d00; padding:10px; margin-bottom:5px; border-radius:8px; text-decoration:none; text-align:center;">${l.nombre}</a>`).join('') || 'Esperando...'}
          </div>
        </section>
        <section>
          <h3 style="color:orange;">🔔 Historial</h3>
          <div style="background:#111; padding:15px; border-radius:12px; max-height:200px; overflow-y:auto;">
            ${historialNovedades.map(h => `<p style="${h.nuevo ? 'color:red; font-weight:bold;' : 'color:#888;'}">[${h.hora}] ${h.nombre}</p>`).join('')}
          </div>
        </section>
      </div>
      <script>
        let sonidoActivado = sessionStorage.getItem('sonidoLocal') === 'true';
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
          if(sonidoActivado) { const a = new AudioContext(); a.resume(); }
        }
        if (${hayNovedad} && sonidoActivado) {
          const ctx = new AudioContext(); const o = ctx.createOscillator(); o.connect(ctx.destination); o.start(); setTimeout(()=>o.stop(),600);
        }
        setTimeout(() => location.reload(), 45000);
      </script>
    </body>
  `);
});

app.listen(process.env.PORT || 10000, '0.0.0.0');
