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
  res.send(`
    <!DOCTYPE html>
    <body style="background:#000; color:#fff; font-family:sans-serif; padding:20px;">
      <div style="max-width:800px; margin:auto; background:#0a0a0a; padding:30px; border-radius:20px; border:1px solid #222;">
        <div style="text-align:right; margin-bottom:20px;">
          <button id="btnSonido" onclick="activarTodo()" style="background:#444; color:#fff; border:none; padding:10px 20px; border-radius:10px; cursor:pointer;">Cargando Alertas...</button>
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
        const tieneNovedades = ${hayNovedad};
        let sonidoActivado = sessionStorage.getItem('sonidoLocal') === 'true';
        
        function updateBtn() {
            const btn = document.getElementById('btnSonido');
            btn.innerText = sonidoActivado ? '🔊 Alertas Activas' : '🔇 Activar Alertas';
            btn.style.background = sonidoActivado ? '#00ff00' : '#444';
            btn.style.color = sonidoActivado ? '#000' : '#fff';
        }

        async function activarTodo() {
            sonidoActivado = !sonidoActivado;
            sessionStorage.setItem('sonidoLocal', sonidoActivado);
            updateBtn();
            if (sonidoActivado && Notification.permission !== "granted") {
                await Notification.requestPermission();
            }
        }

        if (tieneNovedades && sonidoActivado) {
            const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
            audio.play().catch(() => console.log("Clic necesario para audio"));

            if (Notification.permission === "granted") {
                new Notification("🚨 ABONOTEATRO", {
                    body: "¡Nuevo evento detectado!",
                    icon: "https://compras.abonoteatro.com/wp-content/uploads/2016/09/cropped-Logo-Abonoteatro-Verde-192x192.png"
                });
            }
        }

        updateBtn();
        setTimeout(() => location.reload(), 60000);
      </script>
    </body>
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
