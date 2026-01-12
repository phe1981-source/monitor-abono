const puppeteer = require('puppeteer');
const express = require('express');
const app = express();

const USER = 'phe1981@gmail.com';
const PASS = process.env.ABONO_PASS;

let listaBruta = []; 
let listaLimpia = []; 
let historialNovedades = []; 
let logEstado = "Iniciando...";
let ultimaActualizacion = "Sin datos";
let proximoEscaneo = "Pendiente";

function obtenerEsperaAleatoria(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

async function iniciarMonitor() {
  console.log("🚀 Iniciando Bot...");
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox', 
      '--disable-blink-features=AutomationControlled'
    ]
  });
  
  const page = await browser.newPage();
  // Imitar un navegador real
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.setViewport({ width: 1280, height: 1000 });

  try {
    logEstado = "Intentando Login...";
    console.log("🔑 Accediendo a login...");
    
    // Subimos el timeout a 90 segundos y usamos domcontentloaded
    await page.goto('https://compras.abonoteatro.com/login/', { 
      waitUntil: 'domcontentloaded', 
      timeout: 90000 
    });
    
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Aceptar'));
      if (btn) btn.click();
    }).catch(() => {});

    await page.type('#nabonadologin', USER);
    await page.type('#contrasenalogin', PASS);
    
    // Usamos Promise.all para asegurar que el click y la navegación se gestionen juntos
    await Promise.all([
      page.click('input[value="Entrar"].buyBtn'),
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 90000 })
    ]);

    console.log("✅ Login completado.");

    while (true) {
      logEstado = "Escaneando cartelera...";
      console.log("🔍 Escaneando...");

      await page.goto('https://compras.abonoteatro.com/teatro/', { 
        waitUntil: 'domcontentloaded', 
        timeout: 90000 
      }).catch(() => {});
      
      // Espera de seguridad para el iframe
      await new Promise(r => setTimeout(r, 20000)); 

      const frameElement = await page.$('iframe');
      if (frameElement) {
        const frame = await frameElement.contentFrame();
        const data = await frame.evaluate(() => {
          const elementos = document.querySelectorAll('.tribe-events-list-event-title a, h3 a');
          const options = document.querySelectorAll('#select_recinto_event option');
          
          const fromLinks = Array.from(elementos).map(el => ({
            nombre: el.innerText.trim(),
            url: el.href
          }));

          const fromOptions = Array.from(options).map(el => ({
            nombre: el.innerText.trim(),
            url: '#'
          })).filter(item => item.nombre !== "" && item.nombre !== "-- Seleccione --");

          return [...fromLinks, ...fromOptions].filter(item => item.nombre);
        });

        if (data && data.length > 0) {
          const anteriorParaComparar = [...listaLimpia];
          listaBruta = data;

          const uniqueData = data.filter((item, index, self) =>
            item.nombre && index === self.findIndex((t) => t.nombre === item.nombre)
          );
          listaLimpia = uniqueData.sort((a, b) => a.nombre.localeCompare(b.nombre));
          
          const ahoraTimestamp = Date.now();
          const ahoraHora = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

          if (anteriorParaComparar.length > 0) {
            const detectadosAhora = listaLimpia.filter(item => !anteriorParaComparar.some(old => old.nombre === item.nombre));
            
            if (detectadosAhora.length > 0) {
              // Solo si hay novedades reales, "apagamos" el rojo de las alertas anteriores
              historialNovedades.forEach(h => h.nuevo = false);
              console.log(`✨ ¡Novedades detectadas! Reseteando alertas previas y marcando las ${detectadosAhora.length} actuales.`);
              
              for (const item of detectadosAhora) {
                let finalUrl = item.url;
                if (item.url && !item.url.endsWith('#')) {
                console.log(`🔎 Buscando URL final para: ${item.nombre}`);
                const newPage = await browser.newPage();
                try {
                  await newPage.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
                  await newPage.waitForSelector('a.buyBtn', { timeout: 10000 });

                  const correctUrl = await newPage.evaluate(() => {
                    const comprarBtns = Array.from(document.querySelectorAll('a.buyBtn'));
                    if (comprarBtns.length > 1) {
                      return comprarBtns[1].href;
                    }
                    if (comprarBtns.length === 1) {
                      return comprarBtns[0].href;
                    }
                    return null;
                  });

                  if (correctUrl) {
                    finalUrl = correctUrl;
                    console.log(`✅ URL final encontrada: ${finalUrl}`);
                  } else {
                    console.log(`⚠️ No se encontró el botón "Comprar" secundario.`);
                  }
                } catch (e) {
                  console.log(`❌ Error al buscar URL para ${item.nombre}: ${e.message}`);
                } finally {
                  await newPage.close();
                }
              }

              historialNovedades.unshift({ 
                nombre: item.nombre, 
                url: finalUrl, 
                hora: ahoraHora, 
                timestamp: ahoraTimestamp, 
                nuevo: true 
              });
            }
          }

          historialNovedades = historialNovedades.filter(h => (ahoraTimestamp - h.timestamp) < (12 * 60 * 60 * 1000));
          ultimaActualizacion = new Date().toLocaleTimeString('es-ES');
          console.log(`📊 Lectura exitosa: ${listaBruta.length} eventos.`);
        }
      }

      const espera = obtenerEsperaAleatoria(60, 300);
      proximoEscaneo = `${Math.floor(espera/60)}m ${espera%60}s`;
      logEstado = `En espera (${proximoEscaneo})`;
      await new Promise(r => setTimeout(r, espera * 1000)); 
    }

  } catch (error) {
    console.log("❌ ERROR:", error.message);
    logEstado = "Error de conexión. Reintentando...";
    await browser.close();
    // Reintento en 30 segundos
    setTimeout(iniciarMonitor, 30000); 
  }
}

iniciarMonitor();

app.get('/', (req, res) => {
  res.send(`
    <body style="background:#000; color:#fff; font-family:sans-serif; padding:20px;">
      <div style="max-width:900px; margin:auto; border:1px solid #333; padding:25px; border-radius:15px; background:#0a0a0a;">
        <header style="text-align:center; margin-bottom:30px;">
          <h1 style="color:#B9C800; margin:0;">MONITOR AGILE</h1>
          <p style="color:#666;">Sincronizado: ${ultimaActualizacion}</p>
          <div style="font-size:5em; font-weight:bold; color:#B9C800;">${listaBruta.length}</div>
          <div style="color:#444; text-transform:uppercase; font-size:0.8em;">Eventos Totales</div>
        </header>

        <section style="margin-bottom:30px;">
          <div style="background:#111; border:1px solid #ff4400; padding:15px; border-radius:12px;">
            <h3 style="color:#ff4400; margin-top:0;">🔔 ALERTAS 12H (${historialNovedades.length})</h3>
            <div style="max-height:150px; overflow-y:auto;">
              ${historialNovedades.length > 0 ? `
                <table style="width:100%; text-align:left;">
                  ${historialNovedades.map(h => {
                    const style = h.nuevo ? 'color: #ff0000; font-size: 1.8em; font-weight: bold;' : 'color: orange; font-size: 1em; font-weight: normal;';
                    const link = `<a href="${h.url}" target="_blank" style="text-decoration:none; ${style}">${h.nombre}</a>`;
                    return `<tr style="border-bottom:1px solid #222;"><td style="color:#ffbb00; width:80px;">[${h.hora}]</td><td>${link}</td></tr>`;
                  }).join('')}
                </table>` : '<p style="color:#333;">Sin novedades.</p>'}
            </div>
          </div>
        </section>

        <section>
          <div style="background:#050505; border:1px solid #333; padding:15px; border-radius:12px;">
            <h3 style="color:#B9C800; margin-top:0;">📋 CARTELERA ÚNICA (${listaLimpia.length})</h3>
            <div style="max-height:350px; overflow-y:auto;">
              <table style="width:100%; text-align:left;">
                ${listaLimpia.map((ev, i) => `<tr style="border-bottom:1px solid #111;"><td style="color:#444; width:30px;">${i+1}</td><td style="color:#ccc;"><a href="${ev.url}" target="_blank" style="color:#ccc; text-decoration:none;">${ev.nombre}</a></td></tr>`).join('')}
              </table>
            </div>
          </div>
        </section>

        <footer style="margin-top:25px; color:#444; font-size:0.8em; text-align:center;">
          <p>Estado: ${logEstado} | Refresco automático: 60s</p>
        </footer>
      </div>
      <div id="audio-overlay" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); color: white; display: flex; justify-content: center; align-items: center; z-index: 1000; cursor: pointer; font-size: 2em; text-align: center;">
        Click para activar el Monitor y el Sonido
      </div>
      <script>
        const audioOverlay = document.getElementById('audio-overlay');
        const isAudioEnabled = () => sessionStorage.getItem('audioEnabled') === 'true';

        // When user clicks the overlay, enable audio and hide the overlay
        audioOverlay.addEventListener('click', () => {
            try {
                const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                // Play a test sound to confirm
                const oscillator = audioCtx.createOscillator();
                oscillator.type = 'square';
                oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
                oscillator.connect(audioCtx.destination);
                oscillator.start();
                setTimeout(() => oscillator.stop(), 150);
                
                // Save preference and hide overlay
                sessionStorage.setItem('audioEnabled', 'true');
                audioOverlay.style.display = 'none';
            } catch (e) {
                console.error('Could not enable audio:', e);
                audioOverlay.textContent = 'Audio Failed';
            }
        }, { once: true }); // Important: run this listener only once

        // Hide overlay if audio is already enabled from a previous interaction in the same session
        if (isAudioEnabled()) {
            audioOverlay.style.display = 'none';
        }

        const currentAlerts = ${historialNovedades.length};
        const lastAlerts = sessionStorage.getItem('lastAlertCount') || 0;

        if (currentAlerts > lastAlerts) {
            // Only play sound if user has enabled it
            if (isAudioEnabled()) {
                const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                const oscillator = audioCtx.createOscillator();
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
                oscillator.connect(audioCtx.destination);
                oscillator.start();
                setTimeout(() => oscillator.stop(), 200);
            }
        }

        sessionStorage.setItem('lastAlertCount', currentAlerts);
        setTimeout(() => location.reload(), 60000);
      </script>
    </body>
  `);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0');
