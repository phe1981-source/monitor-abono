const puppeteer = require('puppeteer');
const express = require('express');
const app = express();

const USER = 'phe1981@gmail.com';
const PASS = process.env.ABONO_PASS; 

let listaLimpia = []; 
let historialNovedades = []; 
let linksDirectos = []; 
let logEstado = "Iniciando...";
let ultimaActualizacion = "Sin datos";

async function iniciarMonitor() {
  console.log("🚀 Iniciando Bot V3.1.4...");
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
    await new Promise(r => setTimeout(r, 10000));

    while (true) {
      logEstado = "Escaneando...";
      // Cargamos la cartelera esperando a que la red esté inactiva
      await page.goto('https://compras.abonoteatro.com/teatro/', { waitUntil: 'networkidle0', timeout: 120000 });
      
      const frameElement = await page.waitForSelector('iframe', { timeout: 60000 });
      const frame = await frameElement.contentFrame();

      // Damos tiempo extra al contenido interno del iframe
      await new Promise(r => setTimeout(r, 8000)); 

      const data = await frame.evaluate(() => {
        const sel = '.tribe-events-list-event-title a, h3 a, .entry-title a, .tribe-events-calendar-list__event-title a';
        return Array.from(document.querySelectorAll(sel))
          .map(el => el.innerText.trim())
          .filter(n => n.length > 2);
      });

      if (data && data.length > 0) {
        const nombresActuales = [...new Set(data)];
        const ahoraHora = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

        if (listaLimpia.length > 0) {
          const anteriorNombres = listaLimpia.map(item => item.nombre);
          const detectados = nombresActuales.filter(n => !anteriorNombres.includes(n));

          for (const nombre of detectados) {
            historialNovedades.unshift({ nombre: nombre, hora: ahoraHora, nuevo: true });
            // Aquí iría la lógica de click para links directos si fuera necesario
          }
        }
        listaLimpia = nombresActuales.map(n => ({ nombre: n }));
        ultimaActualizacion = ahoraHora;
        console.log(`✅ ${data.length} eventos leídos.`);
      } else {
        logEstado = "Reintentando lectura...";
      }
      
      const esperaMs = Math.floor(Math.random() * (240000 - 90000 + 1) + 90000);
      logEstado = "Espera (" + Math.round(esperaMs / 1000) + "s)";
      await new Promise(r => setTimeout(r, esperaMs));
    }
  } catch (error) {
    console.log("❌ Error:", error.message);
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
  html += '<button id="btnS" onclick="tS()" style="background:#444; color:#fff; border:none; padding:10px; border-radius:10px;">🔇 Sonido</button>';
  html += '</div>';
  html += '<h1 style="color:#B9C800; text-align:center; font-size:5em; margin:0;">' + listaLimpia.length + '</h1>';
  html += '<p style="text-align:center; color:#888;">' + logEstado + ' | Sincro: ' + ultimaActualizacion + '</p>';
  
  html += '<h3 style="color:#00ff00;">🚀 LINKS DIRECTOS</h3>';
  html += '<div style="background:#001a00; padding:15px; border-radius:10px; border:1px solid #00ff00;">';
  if (linksDirectos.length === 0) html += '<p style="color:#004400;">Esperando novedades...</p>';
  linksDirectos.forEach(l => {
    html += '<a href="'+l.url+'" target="_blank" style="display:block; color:#fff; margin:5px 0;">'+l.nombre+'</a>';
  });
  html += '</div>';

  // SECCIÓN RESTAURADA: Historial de Alarmas
  html += '<h3 style="color:#ff4400; margin-top:30px;">🔔 HISTORIAL DE NOVEDADES</h3>';
  html += '<div style="background:#1a0000; padding:15px; border-radius:10px; border:1px solid #ff4400;">';
  if (historialNovedades.length === 0) html += '<p style="color:#440000;">No hay alertas recientes.</p>';
  historialNovedades.forEach(h => {
    html += '<div style="padding:8px; border-bottom:1px solid #333;">[' + h.hora + '] ' + h.nombre + '</div>';
  });
  html += '</div>';

  html += '</div>';
  html += '<script>';
  html += 'let s = sessionStorage.getItem("s")==="true"; const b=document.getElementById("btnS");';
  html += 'function u(){ b.innerText=s?"🔊 Sonido Activo":"🔇 Activar Sonido"; b.style.background=s?"#00ff00":"#444"; } u();';
  html += 'function tS(){ s=!s; sessionStorage.setItem("s", s); u(); }';
  html += 'if('+hayNovedad+' && s){ const c=new AudioContext(); const o=c.createOscillator(); o.connect(c.destination); o.start(); setTimeout(()=>o.stop(),300); }';
  html += 'setTimeout(()=>location.reload(), 30000);';
  html += '</script></body>';
  res.send(html);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log('Puerto ' + PORT));
