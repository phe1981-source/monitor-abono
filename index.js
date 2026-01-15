const puppeteer = require('puppeteer');
const express = require('express');
const { extraerLinkCompra } = require('./extractor'); 
const app = express();

// --- CONFIGURACIÓN SEGURA ---
const USER = 'phe1981@gmail.com';
const PASS = process.env.ABONO_PASS; 

if (!PASS) {
  console.error("❌ [CRITICAL] No se ha detectado la variable ABONO_PASS. El login fallará.");
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
  console.log("🚀 [SISTEMA] Iniciando Bot V4.2 - Sniper Edition");
  
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

    console.log("✅ [SISTEMA] Login exitoso.");

    while (true) {
      // RESET DE NOVEDADES AL INICIO DEL CICLO (Para silenciar el BIP)
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

          if (listaLimpia.length === 0) {
            listaLimpia = nombresActuales.map(n => ({ nombre: n }));
            ultimaActualizacion = ahoraHora;
          } else {
            const anteriorNombres = listaLimpia.map(item => item.nombre);
            const detectadosAhora = nombresActuales.filter(n => !anteriorNombres.includes(n));
            
            if (detectadosAhora.length > 0) {
              console.log(`🔔 [ALERTA] ${detectadosAhora.length} novedades detectadas!`);
              for (const nombre of detectadosAhora) {
                historialNovedades.unshift({ nombre, hora: ahoraHora, nuevo: true });
                
                try {
                    const resultado = await extraerLinkCompra(browser, page, frame, nombre);
                    if (resultado && resultado.url) {
                        linksDirectos.unshift({ nombre: `${nombre} (${resultado.metodo})`, url: resultado.url, hora: ahoraHora });
                    }
                } catch (e) { console.log(`⚠️ Extracción fallida: ${nombre}`); }
              }
            }
            listaLimpia = nombresActuales.map(n => ({ nombre: n }));
            ultimaActualizacion = ahoraHora;
          }
        }
      }

      const espera = obtenerEsperaAleatoria(180, 240);
      proximoEscaneo = `${Math.floor(espera/60)}m ${espera%60}s`;
      console.log(`😴 Ciclo terminado. Espera: ${proximoEscaneo}`);
      await new Promise(r => setTimeout(r, espera * 1000)); 
    }
  } catch (error) {
    console.error("❌ Error Crítico:", error.message);
    if (browser) await browser.close();
    setTimeout(iniciarMonitor, 30000); 
  }
}

iniciarMonitor();

// --- DASHBOARD ---
app.get('/', (req, res) => {
  const hayNovedad = historialNovedades.some(h => h.nuevo);
  const totalAcumulado = historialNovedades.length;
  const novedadesN = historialNovedades.filter(h => h.nuevo).length;

  res.send(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Abono Monitor PRO</title>
        <style>
            body { background: #050505; color: #eee; font-family: 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; }
            .container { max-width: 900px; margin: auto; }
            
            /* --- CABECERA: ALERTAS 12H --- */
            .main-counter { 
                text-align: center; 
                padding: 40px 20px; 
                background: linear-gradient(145deg, #0a0a0a, #111);
                border-radius: 24px;
                border: 1px solid #222;
                margin-bottom: 20px;
            }
            .total-count { font-size: 8em; font-weight: 800; line-height: 1; margin: 0; display: inline-block; }
            .badge-novedad { 
                font-size: 2.5em; 
                vertical-align: top; 
                font-weight: bold;
                margin-left: 10px;
            }
            .rojo-brillante { color: #ff0033; text-shadow: 0 0 20px rgba(255, 0, 51, 0.4); }
            .gris-apagado { color: #333; }

            /* --- EVENTOS TOTALES --- */
            .sub-counter {
                display: flex; justify-content: center; align-items: center;
                gap: 15px; margin-bottom: 20px; background: #0a0a0a; padding: 15px;
                border-radius: 15px; border: 1px solid #1a1a1a;
            }
            .sub-counter span { color: #B9C800; font-size: 1.8em; font-weight: bold; }

            /* --- STATUS BAR --- */
            .status-bar {
                display: grid; grid-template-columns: repeat(3, 1fr);
                gap: 10px; margin-bottom: 30px; font-size: 0.85em; text-transform: uppercase; letter-spacing: 1px;
            }
            .status-item { background: #111; padding: 10px; border-radius: 8px; text-align: center; color: #888; }
            .status-value { color: #fff; display: block; font-size: 1.2em; margin-top: 5px; }

            /* --- SECCIONES --- */
            .grid-sections { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
            .box { background: #0a0a0a; border-radius: 15px; padding: 20px; border: 1px solid #222; }
            h3 { margin-top: 0; font-size: 0.9em; text-transform: uppercase; color: #555; border-bottom: 1px solid #222; padding-bottom: 10px; }
            
            .btn-alert { 
                width: 100%; padding: 15px; border-radius: 12px; border: none; font-weight: bold; cursor: pointer;
                transition: 0.3s; margin-bottom: 20px;
            }
            
            a.link-card {
                display: block; background: #002200; color: #00ff00; text-decoration: none;
                padding: 12px; border-radius: 8px; margin-bottom: 8px; border: 1px solid #004400;
                font-weight: bold; text-align: center; font-size: 0.9em;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <button id="btnSonido" onclick="activarTodo()" class="btn-alert" style="background: #222; color: #888;">
                CARGANDO ALERTAS...
            </button>

            <div class="main-counter">
                <div style="color: #666; text-transform: uppercase; letter-spacing: 3px; font-size: 0.9em; margin-bottom: 10px;">Alertas Acumuladas</div>
                <h1 class="total-count">${totalAcumulado}</h1>
                <span class="badge-novedad ${novedadesN > 0 ? 'rojo-brillante' : 'gris-apagado'}">
                    (+${novedadesN})
                </span>
            </div>

            <div class="sub-counter">
                <small style="color: #555; text-transform: uppercase;">Cartelera Total:</small>
                <span>${listaLimpia.length} Eventos</span>
            </div>

            <div class="status-bar">
                <div class="status-item">Última lectura <span class="status-value">${ultimaActualizacion}</span></div>
                <div class="status-item">Próxima en <span class="status-value">${proximoEscaneo}</span></div>
                <div class="status-item">Estado <span class="status-value" style="color: #B9C800">${logEstado}</span></div>
            </div>

            <div class="grid-sections">
                <div class="box">
                    <h3>🚀 Links Directos</h3>
                    ${linksDirectos.slice(0, 5).map(l => `
                        <a href="${l.url}" target="_blank" class="link-card">${l.nombre} <br> <small style="opacity:0.6">${l.hora}</small></a>
                    `).join('') || '<p style="color:#333; text-align:center;">Buscando links...</p>'}
                </div>
                <div class="box">
                    <h3>🔔 Historial Reciente</h3>
                    <div style="max-height: 300px; overflow-y: auto;">
                        ${historialNovedades.slice(0, 10).map(h => `
                            <div style="padding: 10px 0; border-bottom: 1px solid #1a1a1a; font-size: 0.9em; ${h.nuevo ? 'color: #ff0033; font-weight: bold;' : 'color: #888;'}">
                                <small>[${h.hora}]</small> ${h.nombre}
                            </div>
                        `).join('') || '<p style="color:#333;">Silencio total...</p>'}
                    </div>
                </div>
            </div>
        </div>

        <script>
            let sonidoActivado = sessionStorage.getItem('sonidoLocal') === 'true';
            const hayNovedades = ${hayNovedad};

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
                if (sonidoActivado && Notification.permission !== "granted") {
                    await Notification.requestPermission();
                }
            }

            if (hayNovedades && sonidoActivado) {
                new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg').play().catch(() => {});
                if (Notification.permission === "granted") {
                    new Notification("🚨 NUEVO EVENTO", { body: "Se ha detectado una novedad en Abonoteatro" });
                }
            }

            updateBtn();
            setTimeout(() => location.reload(), 60000);
        </script>
    </body>
    </html>
  `);
});


// --- RUTA DE SIMULACRO (TEST) ---
app.get('/test-alarma', (req, res) => {
    const ahoraHora = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    
    // 1. Inyectamos un evento falso en el historial
    historialNovedades.unshift({ 
        nombre: "EVENTO DE PRUEBA: HAZ QUE PARE", 
        hora: ahoraHora, 
        nuevo: true 
    });

    // 2. Simulamos un link capturado
    linksDirectos.unshift({ 
        nombre: "EVENTO DE PRUEBA (Sniper V5.1)", 
        url: "https://compras.abonoteatro.com/pasarela/simulacro", 
        hora: ahoraHora 
    });

    console.log("🧪 [SIMULACRO] Disparando alerta de prueba...");
    res.send("<h1>Simulacro activado</h1><p>Vuelve al Dashboard para ver la alerta.</p><script>setTimeout(()=>window.location.href='/', 2000)</script>");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`🌍 Dashboard en puerto ${PORT}`));
