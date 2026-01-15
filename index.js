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
  console.log("🚀 [SISTEMA] Iniciando Bot V3.2.1 - Modo Verbose Log");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled']
  });
  
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  try {
    logEstado = "Intentando Login...";
    console.log("⏳ [LOGIN] Accediendo a la página de entrada...");
    await page.goto('https://compras.abonoteatro.com/login/', { waitUntil: 'networkidle2', timeout: 90000 });
    
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Aceptar'));
      if (btn) btn.click();
    }).catch(() => {});

    console.log("🔑 [LOGIN] Escribiendo credenciales...");
    await page.type('#nabonadologin', USER);
    await page.type('#contrasenalogin', PASS);
    
    await Promise.all([
      page.click('input[value="Entrar"].buyBtn'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 90000 })
    ]);

    console.log("✅ [LOGIN] Login completado con éxito.");

    while (true) {
      logEstado = "Escaneando...";
      console.log("📡 [SCAN] Cargando sección teatro...");
      await page.goto('https://compras.abonoteatro.com/teatro/', { waitUntil: 'domcontentloaded', timeout: 90000 });
      
      console.log("⏱️ [SCAN] Esperando 20s para estabilidad del iframe...");
      await new Promise(r => setTimeout(r, 20000)); 

      const frameElement = await page.$('iframe');
      if (frameElement) {
        console.log("🖼️ [IFRAME] Iframe detectado, extrayendo datos...");
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
          console.log(`📊 [SCAN] Encontrados ${data.length} eventos en total.`);
          const nombresActuales = [...new Set(data)];
          const ahoraHora = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

          if (listaLimpia.length === 0) {
            console.log("📦 [SISTEMA] Lista inicial cargada.");
            listaLimpia = nombresActuales.map(n => ({ nombre: n }));
            ultimaActualizacion = ahoraHora;
          } else {
            const anteriorNombres = listaLimpia.map(item => item.nombre);
            const detectadosAhora = nombresActuales.filter(n => !anteriorNombres.includes(n));

            if (detectadosAhora.length > 0) {
              console.log(`🔔 [ALERTA] Se han detectado ${detectadosAhora.length} novedades!`);
              historialNovedades.forEach(h => h.nuevo = false);

              for (const nombre of detectadosAhora) {
                console.log(`🔎 [EXTRACTOR] Intentando obtener link para: ${nombre}`);
                try {
                  const clicExitoso = await frame.evaluate((n) => {
                    const links = Array.from(document.querySelectorAll('.tribe-events-list-event-title a, h3 a'));
                    const target = links.find(a => a.innerText.trim().toLowerCase() === n.toLowerCase());
                    if (target) {
                      target.scrollIntoView();
                      target.click();
                      return true;
                    }
                    return false;
                  }, nombre);

                  if (clicExitoso) {
                    console.log(`🚀 [EXTRACTOR] Click realizado. Esperando primer popup...`);
                    const target1 = await browser.waitForTarget(t => t.opener() === page.target(), { timeout: 15000 });
                    const page1 = await target1.page();

                    if (page1) {
                      await page1.waitForSelector('a.buyBtn', { timeout: 15000 });
                      const botones = await page1.$$('a.buyBtn');
                      
                      if (botones.length >= 2) {
                        console.log(`🛒 [EXTRACTOR] Botón compra hallado. Abriendo pasarela...`);
                        const target2Promise = browser.waitForTarget(t => t.opener() === target1.target(), { timeout: 15000 });
                        await botones[1].click();
                        const page2 = await target2Promise.page();

                        if (page2) {
                          await page2.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
                          console.log(`🔗 [EXTRACTOR] URL capturada: ${page2.url().substring(0, 50)}...`);
                          linksDirectos.unshift({ nombre, url: page2.url(), hora: ahoraHora });
                          await page2.close().catch(() => {});
                        }
                      }
                      await page1.close().catch(() => {});
                    }
                  }
                  historialNovedades.unshift({ nombre, hora: ahoraHora, nuevo: true });
                } catch (e) { 
                  console.log(`🛑 [ERROR EXTRACTOR] No se pudo obtener link de "${nombre}": ${e.message}`); 
                }
              }
            }
            listaLimpia = nombresActuales.map(n => ({ nombre: n }));
            ultimaActualizacion = ahoraHora;
          }
        } else {
          console.log("⚠️ [SCAN] El iframe respondió pero no encontró eventos (lista vacía).");
        }
      } else {
        console.log("❌ [ERROR] Iframe no encontrado en la página de teatro.");
      }

      const espera = obtenerEsperaAleatoria(180, 240);
      logEstado = `Espera (${Math.floor(espera/60)}m ${espera%60}s)`;
      console.log(`😴 [SISTEMA] Ciclo terminado. Durmiendo ${espera} segundos...`);
      await new Promise(r => setTimeout(r, espera * 1000)); 
    }
  } catch (error) {
    console.log("❌ [CRITICAL] Error general:", error.message);
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
          <button id="btnSonido" onclick="toggleSonido()" style="background:#444; color:#fff; border:none; padding:10px 20px; border-radius:10px; cursor:pointer;">Activar Sonido</button>
        </div>
        <header style="text-align:center; margin-bottom:40px;">
          <div style="color:#B9C800; font-size:1.1em; text-transform:uppercase; letter-spacing:2px;">Eventos Totales</div>
          <div style="font-size:7em; font-weight:bold; color:#B9C800; line-height:1;">${listaLimpia.length}</div>
          <p style="color:#555;">Estado: <span style="color:#ccc;">${logEstado}</span> | Sincro: <span style="color:#ccc;">${ultimaActualizacion}</span></p>
        </header>
        <section style="margin-bottom:30px;">
          <h3 style="color:#00ff00; border-left:4px solid #00ff00; padding-left:10px;">🚀 Links Directos</h3>
          <div style="background:#001a00; border:1px solid #004400; padding:15px; border-radius:12px;">
            ${linksDirectos.map(l => `<div style="margin-bottom:8px;"><a href="${l.url}" target="_blank" style="display:block; color:#fff; font-weight:bold; background:#004d00; padding:12px; border-radius:8px; text-align:center; text-decoration:none; border:1px solid #00ff00;">${l.nombre} [${l.hora}]</a></div>`).join('') || '<p style="color:#444;">Esperando nuevas entradas con link...</p>'}
          </div>
        </section>
        <section>
          <h3 style="color:#ff4400; border-left:4px solid #ff4400; padding-left:10px;">🔔 Historial</h3>
          <div style="background:#111; padding:15px; border-radius:12px; max-height:250px; overflow-y:auto; border:1px solid #222;">
            ${historialNovedades.map(h => `<p style="margin:8px 0; border-bottom:1px solid #222; padding-bottom:5px; ${h.nuevo ? 'color:#ff0000; font-weight:bold;' : 'color:orange;'}">[${h.hora}] ${h.nombre}</p>`).join('') || '<p style="color:#444;">Sin actividad todavía.</p>'}
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
            btn.style.color = sonidoActivado ? '#000' : '#fff';
        }
        updateBtn();
        function toggleSonido() {
          sonidoActivado = !sonidoActivado;
          sessionStorage.setItem('sonidoLocal', sonidoActivado);
          updateBtn();
          if (sonidoActivado) { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume(); }
        }
        if (${hayNovedad} && sonidoActivado) {
          const context = new (window.AudioContext || window.webkitAudioContext)();
          const osc = context.createOscillator();
          const gain = context.createGain();
          osc.connect(gain); gain.connect(context.destination);
          osc.frequency.value = 880; 
          gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 1);
          osc.start(); osc.stop(context.currentTime + 1);
        }
        setTimeout(() => location.reload(), 60000);
      </script>
    </body>
  `);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0');
