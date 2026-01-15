const puppeteer = require('puppeteer');
const express = require('express');
const { extraerLinkCompra } = require('./extractor'); 
const app = express();

// --- CONFIGURACIÓN SEGURA ---
const USER = 'phe1981@gmail.com';
const PASS = process.env.ABONO_PASS; 

if (!PASS) {
  console.error("❌ [CRITICAL] No se ha detectado la variable ABONO_PASS.");
}

let listaLimpia = []; 
let historialNovedades = []; 
let linksDirectos = []; 
let logEstado = "Iniciando...";
let ultimaActualizacion = "Sin datos";
let proximoEscaneo = "Calculando...";

function obtenerEsperaAleatoria(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

async function iniciarMonitor() {
  console.log("🚀 [SISTEMA] Bot V4.2 - Sniper Edition + Audio Dual");
  
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled']
  });
  
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  try {
    logEstado = "Login...";
    await page.goto('https://compras.abonoteatro.com/login/', { waitUntil: 'networkidle2', timeout: 90000 });
    
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Aceptar'));
      if (btn) btn.click();
    }).catch(() => {});

    await page.type('#nabonadologin', USER);
    await page.type('#contrasenalogin', PASS || '');
    
    await Promise.all([
      page.click('input[value="Entrar"].buyBtn'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 90000 })
    ]);

    while (true) {
      // Importante: Marcamos lo antiguo como leido para que el BIP solo suene al detectar
      historialNovedades.forEach(h => h.nuevo = false);

      logEstado = "Scanning...";
      await page.goto('https://compras.abonoteatro.com/teatro/', { waitUntil: 'domcontentloaded', timeout: 90000 });
      await new Promise(r => setTimeout(r, 20000)); 

      const frameElement = await page.$('iframe');
      if (frameElement) {
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
          const nombresActuales = [...new Set(data)];
          const ahoraHora = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

          if (listaLimpia.length > 0) {
            const anteriorNombres = listaLimpia.map(item => item.nombre);
            const detectadosAhora = nombresActuales.filter(n => !anteriorNombres.includes(n));
            
            if (detectadosAhora.length > 0) {
              for (const nombre of detectadosAhora) {
                historialNovedades.unshift({ nombre, hora: ahoraHora, nuevo: true });
                try {
                    const resultado = await extraerLinkCompra(browser, page, frame, nombre);
                    if (resultado && resultado.url) {
                        linksDirectos.unshift({ nombre, url: resultado.url, hora: ahoraHora });
                    }
                } catch (e) { console.log(`⚠️ Falló extracción: ${nombre}`); }
              }
            }
          }
          listaLimpia = nombresActuales.map(n => ({ nombre: n }));
          ultimaActualizacion = ahoraHora;
        }
      }

      const espera = obtenerEsperaAleatoria(180, 240);
      proximoEscaneo = `${Math.floor(espera/60)}m ${espera%60}s`;
      logEstado = "Esperando...";
      await new Promise(r => setTimeout(r, espera * 1000)); 
    }
  } catch (error) {
    console.error("❌ Error Crítico:", error.message);
    if (browser) await browser.close();
    setTimeout(iniciarMonitor, 30000); 
  }
}

iniciarMonitor();

// --- DASHBOARD PRO ---
app.get('/', (req, res) => {
  const hayNovedad = historialNovedades.some(h => h.nuevo);
  const totalAcumulado = historialNovedades.length;
  const novedadesN = historialNovedades.filter(h => h.nuevo).length;

  res.send(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <style>
            body { background: #050505; color: #eee; font-family: sans-serif; margin: 0; padding: 20px; text-align: center;}
            .container { max-width: 900px; margin: auto; }
            .main-counter { padding: 40px; background: #0a0a0a; border-radius: 24px; border: 1px solid #222; margin-bottom: 20px; }
            .total-count { font-size: 8em; font-weight: bold; margin: 0; }
            .badge-novedad { font-size: 2.5em; font-weight: bold; margin-left: 10px; }
            .rojo-brillante { color: #ff0033; text-shadow: 0 0 20px rgba(255,0,51,0.5); }
            .gris-apagado { color: #222; }
            .status-bar { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px; }
            .status-item { background: #111; padding: 10px; border-radius: 8px; font-size: 0.8em; color: #888; }
            .status-value { color: #fff; display: block; font-size: 1.2em; }
            .grid-sections { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; text-align: left; }
            .box { background: #0a0a0a; border-radius: 15px; padding: 20px; border: 1px solid #222; }
            .btn-alert { width: 100%; padding: 15px; border-radius: 12px; border: none; font-weight: bold; cursor: pointer; margin-bottom: 20px; }
            .link-card { display: block; background: #002200; color: #00ff00; padding: 12px; border-radius: 8px; margin-bottom: 8px; text-decoration: none; border: 1px solid #004400; text-align:center;}
        </style>
    </head>
    <body>
        <div class="container">
            <button id="btnSonido" onclick="activarTodo()" class="btn-alert">CARGANDO...</button>

            <div class="main-counter">
                <div style="color:#666; letter-spacing:2px;">ALERTAS ACUMULADAS</div>
                <h1 class="total-count">${totalAcumulado}</h1>
                <span class="badge-novedad ${novedadesN > 0 ? 'rojo-brillante' : 'gris-apagado'}">(+${novedadesN})</span>
            </div>

            <div class="status-bar">
                <div class="status-item">ÚLTIMA LECTURA <span class="status-value">${ultimaActualizacion}</span></div>
                <div class="status-item">PRÓXIMA EN <span class="status-value">${proximoEscaneo}</span></div>
                <div class="status-item">EVENTOS TOTALES <span class="status-value" style="color:#B9C800">${listaLimpia.length}</span></div>
            </div>

            <div class="grid-sections">
                <div class="box">
                    <h3>🚀 LINKS DIRECTOS</h3>
                    ${linksDirectos.slice(0,5).map(l => `<a href="${l.url}" target="_blank" class="link-card">${l.nombre}<br><small>${l.hora}</small></a>`).join('') || 'Esperando...'}
                </div>
                <div class="box">
                    <h3>🔔 HISTORIAL</h3>
                    ${historialNovedades.slice(0,10).map(h => `<div style="padding:5px 0; border-bottom:1px solid #111; font-size:0.9em; ${h.nuevo?'color:#ff0033':''}">[${h.hora}] ${h.nombre}</div>`).join('') || 'Vacio'}
                </div>
            </div>
        </div>

        <script>
            let sonidoActivado = sessionStorage.getItem('sonidoLocal') === 'true';
            
            function updateBtn() {
                const btn = document.getElementById('btnSonido');
                btn.innerText = sonidoActivado ? '🔊 ALERTAS ACTIVAS' : '🔇 ALERTAS DESACTIVADAS';
                btn.style.background = sonidoActivado ? '#B9C800' : '#222';
                btn.style.color = sonidoActivado ? '#000' : '#888';
            }

            async function activarTodo() {
                sonidoActivado = !sonidoActivado;
                sessionStorage.setItem('sonidoLocal', sonidoActivado);
                updateBtn();
                if(sonidoActivado) await Notification.requestPermission();
            }

            function sonar() {
                // Modo A: Archivo
                new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg').play().catch(()=>{});
                // Modo B: Sintetizador
                try {
                    const ctx = new (window.AudioContext || window.webkitAudioContext)();
                    const osc = ctx.createOscillator();
                    const g = ctx.createGain();
                    osc.frequency.setValueAtTime(880, ctx.currentTime);
                    g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
                    osc.connect(g); g.connect(ctx.destination);
                    osc.start(); osc.stop(ctx.currentTime + 0.8);
                } catch(e){}
            }

            if (${hayNovedad} && sonidoActivado) {
                sonar();
                if (Notification.permission === "granted") {
                    new Notification("🚨 ABONOTEATRO", { body: "¡Nuevas entradas detectadas!" });
                }
            }

            updateBtn();
            setTimeout(() => location.reload(), 60000);
        </script>
    </body>
    </html>
  `);
});

app.get('/test-alarma', (req, res) => {
    historialNovedades.unshift({ nombre: "TEST DE SONIDO DUAL", hora: "00:00", nuevo: true });
    res.send("<script>window.location.href='/'</script>");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0');
