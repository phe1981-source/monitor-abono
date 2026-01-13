const puppeteer = require('puppeteer');
const express = require('express');
const app = express();

const USER = 'phe1981@gmail.com';
const PASS = process.env.ABONO_PASS || 'fAsHaMp@gZie3g@';

app.use('/debug', express.static(__dirname));

let listaLimpia = []; 
let historialNovedades = []; 
let linksDirectos = []; 
let logEstado = "Iniciando...";
let ultimaActualizacion = "Sin datos";

async function iniciarMonitor() {
  console.log("🚀 Iniciando Bot V2.5 - Interfaz sin fallos...");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  try {
    logEstado = "Login (Espera 90s)...";
    await page.goto('https://compras.abonoteatro.com/login/', { waitUntil: 'networkidle2', timeout: 90000 });
    
    await page.type('#nabonadologin', USER);
    await page.type('#contrasenalogin', PASS);
    await Promise.all([
      page.click('input[value="Entrar"].buyBtn'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 90000 })
    ]);

    console.log("✅ Login completado");

    while (true) {
      logEstado = "Buscando novedades...";
      await page.goto('https://compras.abonoteatro.com/teatro/', { waitUntil: 'domcontentloaded', timeout: 90000 });
      
      const frameElement = await page.waitForSelector('iframe', { timeout: 60000 });
      const frame = await frameElement.contentFrame();

      const data = await frame.evaluate(() => {
        return Array.from(document.querySelectorAll('.tribe-events-list-event-title a, h3 a'))
          .map(el => el.innerText.trim())
          .filter(n => n !== "");
      });

      if (data && data.length > 0) {
        const nombresActuales = [...new Set(data)];
        const ahoraHora = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

        if (listaLimpia.length > 0) {
          const anteriorNombres = listaLimpia.map(item => item.nombre);
          const detectados = nombresActuales.filter(n => !anteriorNombres.includes(n));

          for (const nombre of detectados) {
            const shotPath = 'debug_' + Date.now() + '.png';
            try {
              await frame.evaluate((n) => {
                const link = Array.from(document.querySelectorAll('a')).find(a => a.innerText.includes(n));
                if (link) {
                   const btn = link.closest('.tribe-events-calendar-list__event-details')?.querySelector('.buyBtn') || 
                             link.closest('.content')?.querySelector('.buyBtn') || link;
                   if (btn) btn.click();
                }
              }, nombre);

              await new Promise(r => setTimeout(r, 10000));
              await page.screenshot({ path: shotPath });

              const pages = await browser.pages();
              for (const p of pages) {
                if (p.url().includes('shoppad') || p.url().includes('checkout')) {
                  linksDirectos.unshift({ nombre: nombre, url: p.url(), hora: ahoraHora });
                }
              }
              historialNovedades.unshift({ nombre: nombre, hora: ahoraHora, nuevo: true, debugImg: '/debug/' + shotPath });
            } catch (e) { console.log("Error novedad:", e.message); }
          }
        }
        listaLimpia = nombresActuales.map(n => ({ nombre: n }));
        ultimaActualizacion = ahoraHora;
      }
      
      logEstado = "En espera (3 min)";
      await new Promise(r => setTimeout(r, 180000));
    }
  } catch (error) {
    console.log("❌ Error:", error.message);
    logEstado = "Reiniciando por error...";
    if (browser) await browser.close();
    setTimeout(iniciarMonitor, 15000);
  }
}

iniciarMonitor();

app.get('/', (req, res) => {
  const hayNovedad = historialNovedades.some(h => h.nuevo);
  let html = '<body style="background:#000; color:#fff; font-family:sans-serif; padding:20px;">';
  html += '<div style="max-width:800px; margin:auto; background:#111; padding:20px; border-radius:15px; border:1px solid #333;">';
  html += '<h1 style="color:#B9C800; text-align:center; font-size:5em; margin:0;">' + listaLimpia.length + '</h1>';
  html += '<p style="text-align:center; color:#888;">' + logEstado + ' | Sincro: ' + ultimaActualizacion + '</p>';
  
  html += '<h3 style="color:#00ff00;">🚀 LINKS DIRECTOS</h3>';
  html += '<div style="background:#001a00; padding:15px; border-radius:10px; border:1px solid #00ff00; min-height:50px;">';
  if (linksDirectos.length === 0) {
    html += '<p style="text-align:center; color:#004400;">Esperando nuevos eventos...</p>';
  } else {
    linksDirectos.forEach(l => {
      html += '<a href="' + l.url + '" target="_blank" style="display:block; color:#fff; background:#004d00; padding:12px; margin:5px 0; border-radius:8px; text-decoration:none; text-align:center; font-weight:bold; border:1px solid #00ff00;">' + l.nombre + ' [' + l.hora + ']</a>';
    });
  }
  html += '</div>';

  html += '<h3 style="color:#ff4400; margin-top:30px;">🔔 HISTORIAL</h3>';
  historialNovedades.forEach(h => {
    html += '<div style="padding:10px; border-bottom:1px solid #222; display:flex; justify-content:space-between; align-items:center;">';
    html += '<span style="' + (h.nuevo ? 'color:#ff4400; font-weight:bold;' : 'color:#ccc;') + '">[' + h.hora + '] ' + h.nombre + '</span>';
    if (h.debugImg) html += '<a href="' + h.debugImg + '" target="_blank" style="color:#00acee; text-decoration:none; font-size:0.8em; background:#002233; padding:5px 10px; border-radius:5px;">Ver Debug</a>';
    html += '</div>';
  });

  html += '</div><script>setTimeout(()=>location.reload(), 60000);</script></body>';
  res.send(html);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log('Servidor en puerto ' + PORT));
