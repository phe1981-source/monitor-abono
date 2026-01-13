const puppeteer = require('puppeteer');
const express = require('express');
const path = require('path');
const app = express();

const USER = 'phe1981@gmail.com';
const PASS = process.env.ABONO_PASS || 'fAsHaMp@gZie3g@';

// Permitir ver las capturas de pantalla desde el navegador
app.use('/debug', express.static(__dirname));

let listaLimpia = []; 
let historialNovedades = []; 
let linksDirectos = []; 
let logEstado = "Iniciando...";
let ultimaActualizacion = "Sin datos";

async function iniciarMonitor() {
  console.log("🚀 Iniciando Bot V2.2 - Debug y Enlaces corregidos...");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  try {
    logEstado = "Login en proceso...";
    await page.goto('https://compras.abonoteatro.com/login/', { waitUntil: 'networkidle2', timeout: 60000 });
    
    // Aceptar cookies si aparecen
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Aceptar'));
      if (btn) btn.click();
    }).catch(() => {});

    await page.type('#nabonadologin', USER);
    await page.type('#contrasenalogin', PASS);
    await Promise.all([
      page.click('input[value="Entrar"].buyBtn'),
      page.waitForNavigation({ waitUntil: 'networkidle2' })
    ]);

    console.log("✅ Login completado.");

    while (true) {
      logEstado = "Escaneando cartelera...";
      await page.goto('https://compras.abonoteatro.com/teatro/', { waitUntil: 'networkidle2' });
      
      const frameElement = await page.waitForSelector('iframe', { timeout: 30000 });
      const frame = await frameElement.contentFrame();

      const data = await frame.evaluate(() => {
        return Array.from(document.querySelectorAll('.tribe-events-list-event-title a, h3 a'))
          .map(el => el.innerText.trim())
          .filter(n => n !== "");
      });

      if (data.length > 0) {
        const nombresActuales = [...new Set(data)];
        const ahoraHora = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

        if (listaLimpia.length > 0) {
          const anteriorNombres = listaLimpia.map(item => item.nombre);
          const detectados = nombresActuales.filter(n => !anteriorNombres.includes(n));

          for (const nombre of detectados) {
            console.log(`🔎 Intentando capturar link para: ${nombre}`);
            const screenshotName = `debug_${nombre.replace(/\s+/g, '_')}_${Date.now()}.png`;
            
            try {
              // 1. Click en el evento para abrir el primer popup
              await frame.evaluate((n) => {
                const link = Array.from(document.querySelectorAll('a')).find(a => a.innerText.includes(n));
                if (link) {
                   const btn = link.closest('.tribe-events-calendar-list__event-details')?.querySelector('.buyBtn') || 
                             link.closest('.content')?.querySelector('.buyBtn') || link;
                   if (btn) btn.click();
                }
              }, nombre);

              // 2. Esperar y capturar el estado para debug
              await new Promise(r => setTimeout(r, 6000)); 
              await page.screenshot({ path: screenshotName });

              // 3. Intentar detectar si se abrió una nueva pestaña (la pasarela)
              const pages = await browser.pages();
              let linkFinal = null;
              for (const p of pages) {
                const url = p.url();
                if (url.includes('shoppad') || url.includes('checkout')) {
                  linkFinal = url;
                  linksDirectos.unshift({ nombre, url: linkFinal, hora: ahoraHora });
                  break;
                }
              }

              historialNovedades.unshift({ 
                nombre, 
                hora: ahoraHora, 
                nuevo: true, 
                debugImg: `/debug/${screenshotName}` 
              });

            } catch (e) { 
              console.log(`Error capturando ${nombre}:`, e.message); 
            }
          }
        }
        listaLimpia = nombresActuales.map(n => ({ nombre: n }));
        ultimaActualizacion = ahoraHora;
      }
      
      const esperaMinutos = 3;
      logEstado = `Esperando ${esperaMinutos} min...`;
      await new Promise(r => setTimeout(r, esperaMinutos * 60000));
    }
  } catch (error) {
    console.log("❌ ERROR:", error.message);
    logEstado = "Error detectado. Reiniciando...";
    if (browser) await browser.close();
    setTimeout(iniciarMonitor, 20000);
  }
}

iniciarMonitor();

app.get('/', (req, res) => {
  const hayNovedad = historialNovedades.some(h => h.nuevo);
  res.send(`
    <body style="background:#000; color:#fff; font-family:sans-serif; padding:20px;">
      <div style="max-width:800px; margin:auto; background:#111; padding:20px; border-radius:15px; border:1px solid #333;">
        <div style="text-align:right;">
          <button id="btnSonido" onclick="toggleSonido()" style="background:#444; color:#fff; border:none; padding:10px 20px; border-radius:10px; cursor:pointer;">
            🔇 Activar Sonido
          </button>
        </div>

        <h1 style="color:#B9C800; text-align:center; font-size:5em; margin:10px 0;">\${listaLimpia.length}</h1>
        <p style="text-align:center; color:#888; margin-bottom:30px;">
          <strong>Estado:</strong> \${logEstado} | <strong>Sincro:</strong> \${ultimaActualizacion}
        </p>
        
        <h3 style="color:#00ff00; border-left:4px solid #00ff00; padding-left:10px;">🚀 LINKS DE COMPRA DIRECTA</h3>
        <div style="background:#001a00; padding:15px; border-radius:10px; border:1px solid #00ff00; min-height:60px; margin-bottom:30px;">
          \${linksDirectos.map(l => \`
            <div style="margin-bottom:10px;">
              <a href="\${l.url}" target="_blank" style="display:block; color:#fff; background:#004d00; padding:15px; border-radius:8px; text-decoration:none; text-align:center; font-weight:bold; border:1px solid #00ff00;">
                COMPRAR: \${l.nombre} [\${l.hora}]
              </a>
            </div>
          \`).join('') || '<p style="text-align:center; color:#004400;">Esperando capturar pasarela de nuevos eventos...</p>'}
        </div>

        <h3 style="color:#ff4400; border-left:4px solid #ff4400; padding-left:10px;">🔔 HISTORIAL DE NOVEDADES</h3>
        <div style="background:#0a0a0a; border:1px solid #222; border-radius:10px; padding:10px;">
          \${historialNovedades.map(h => \`
            <div style="padding:12px; border-bottom:1px solid #222; display:flex; justify-content:space-between; align-items:center;">
              <span style="\${h.nuevo ? 'color:#ff4400; font-weight:bold;' : 'color:#ccc;'}">[\${h.hora}] \${h.nombre}</span>
              \${h.debugImg ? \`<a href="\${h.debugImg}" target="_blank" style="color:#00acee; text-decoration:none; font-size:0.8em; background:#002233; padding:5px 10px; border-radius:5px;">Ver Debug</a>\` : ''}
            </div>
          \`).join('')}
        </div>
      </div>

      <script>
        let sonidoActivado = sessionStorage.getItem('sonidoLocal') === 'true';
        let audioCtx = null;
        
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
          if (sonidoActivado && !audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          }
        }

        function playBeep() {
          if (!sonidoActivado) return;
          if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.type = 'sine';
          osc.frequency.setValueAtTime(880, audioCtx.currentTime);
          osc.start();
          setTimeout(() => osc.stop(), 200);
        }

        if (\${hayNovedad} && sonidoActivado) {
          playBeep();
        }

        setTimeout(() => location.reload(), 60000);
      </script>
    </body>
  `);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log('Servidor iniciado en puerto ' + PORT));
