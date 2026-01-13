const puppeteer = require('puppeteer');
const express = require('express');
const app = express();

// VARIABLES GLOBALES (Asegúrate de que estas líneas estén arriba)
const USER = 'phe1981@gmail.com';
const PASS = process.env.ABONO_PASS; 

let listaLimpia = []; 
let historialNovedades = []; 
let linksDirectos = []; 
let logEstado = "Iniciando...";
let ultimaActualizacion = "Sin datos";

async function iniciarMonitor() {
  console.log("🚀 Iniciando Bot V3.1.3 - Escaneo Profundo...");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });
  
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  try {
    logEstado = "Login...";
    await page.goto('https://compras.abonoteatro.com/login/', { waitUntil: 'networkidle2', timeout: 120000 });
    
    await page.type('#nabonadologin', USER);
    await page.type('#contrasenalogin', PASS || "");
    await page.click('input[value="Entrar"].buyBtn');
    
    await page.waitForSelector('iframe', { timeout: 90000 });
    console.log("✅ Login OK");
    await new Promise(r => setTimeout(r, 7000));

    while (true) {
      logEstado = "Escaneando...";
      await page.goto('https://compras.abonoteatro.com/teatro/', { waitUntil: 'domcontentloaded', timeout: 120000 });
      
      const frameElement = await page.waitForSelector('iframe', { timeout: 60000 });
      const frame = await frameElement.contentFrame();

      // REFUERZO: Esperamos 5 segundos para que el iframe cargue el contenido interno
      await new Promise(r => setTimeout(r, 5000)); 

      const data = await frame.evaluate(() => {
        // Buscamos con múltiples selectores por si han cambiado las clases
        const selectors = '.tribe-events-list-event-title a, h3 a, .entry-title a, .tribe-events-calendar-list__event-title a';
        return Array.from(document.querySelectorAll(selectors))
          .map(el => el.innerText.trim())
          .filter(n => n !== "" && n.length > 2);
      });

      if (data && data.length > 0) {
        const nombresActuales = [...new Set(data)];
        const ahoraHora = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

        if (listaLimpia.length > 0) {
          const anteriorNombres = listaLimpia.map(item => item.nombre);
          const detectados = nombresActuales.filter(n => !anteriorNombres.includes(n));

          for (const nombre of detectados) {
            try {
              // Intento de click automático para sacar el link
              await frame.evaluate((n) => {
                const link = Array.from(document.querySelectorAll('a')).find(a => a.innerText.includes(n));
                if (link) {
                   const btn = link.closest('.tribe-events-calendar-list__event-details')?.querySelector('.buyBtn') || 
                             link.closest('.content')?.querySelector('.buyBtn') || link;
                   if (btn) btn.click();
                }
              }, nombre);
              await new Promise(r => setTimeout(r, 8000));
              const pages = await browser.pages();
              for (const p of pages) {
                if (p.url().includes('shoppad') || p.url().includes('checkout')) {
                  linksDirectos.unshift({ nombre: nombre, url: p.url(), hora: ahoraHora });
                }
              }
              historialNovedades.unshift({ nombre: nombre, hora: ahoraHora, nuevo: true });
            } catch (e) { console.log("Error click:", e.message); }
          }
        }
        listaLimpia = nombresActuales.map(n => ({ nombre: n }));
        ultimaActualizacion = ahoraHora;
        console.log(`✅ Escaneo exitoso: ${data.length} eventos.`);
      } else {
        logEstado = "Error lectura (0)";
      }
      
      const esperaMs = Math.floor(Math.random() * (300000 - 90000 + 1) + 90000);
      logEstado = "Espera (" + Math.round(esperaMs / 1000) + "s)";
      await new Promise(r => setTimeout(r, esperaMs));
    }
  } catch (error) {
    console.log("❌ Error fatal:", error.message);
    logEstado = "Reiniciando...";
    if (browser) await browser.close();
    setTimeout(iniciarMonitor, 15000);
  }
}

iniciarMonitor();

app.get('/', (req, res) => {
  const hayNovedad = historialNovedades.some(h => h.nuevo);
  let html = '<body style="background:#000; color:#fff; font-family:sans-serif; padding:20px;">';
  html += '<div style="max-width:800px; margin:auto; background:#111; padding:20px; border-radius:15px; border:1px solid #333;">';
  html += '<div style="text-align:right; margin-bottom:10px;">';
  html += '<button id="btnSonido" onclick="toggleSonido()" style="background:#444; color:#fff; border:none; padding:10px 20px; border-radius:10px; cursor:pointer;">🔇 Activar Sonido</button>';
  html += '</div>';
  html += '<h1 style="color:#B9C800; text-align:center; font-size:5em; margin:0;">' + listaLimpia.length + '</h1>';
  html += '<p style="text-align:center; color:#888;">' + logEstado + ' | Sincro: ' + ultimaActualizacion + '</p>';
  html += '<h3 style="color:#00ff00;">🚀 LINKS DIRECTOS</h3>';
  html += '<div style="background:#001a00; padding:15px; border-radius:10px; border:1px solid #00ff00; min-height:50px;">';
  if (linksDirectos.length === 0) html += '<p style="text-align:center; color:#004400;">Esperando novedades...</p>';
  linksDirectos.forEach(l => {
    html += '<a href="' + l.url + '" target="_blank" style="display:block; color:#fff; background:#004d00; padding:10px; margin:5px 0; border-radius:8px; text-decoration:none; text-align:center;">' + l.nombre + '</a>';
  });
  html += '</div>';
  html += '</div>';
  html += '<script>';
  html += 'let sA = sessionStorage.getItem("s") === "true"; const btn = document.getElementById("btnSonido");';
  html += 'function uB() { btn.innerText = sA ? "🔊 Sonido Activo" : "🔇 Activar Sonido"; btn.style.background = sA ? "#00ff00" : "#444"; } uB();';
  html += 'function toggleSonido() { sA = !sA; sessionStorage.setItem("s", sA); uB(); }';
  html += 'if (' + hayNovedad + ' && sA) { const c = new AudioContext(); const o = c.createOscillator(); o.connect(c.destination); o.start(); setTimeout(() => o.stop(), 300); }';
  html += 'setTimeout(() => location.reload(), 30000);';
  html += '</script></body>';
  res.send(html);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log('Servidor en puerto ' + PORT));
