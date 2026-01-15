const puppeteer = require('puppeteer');
const express = require('express');
const { extraerLinkCompra } = require('./extractor'); // Importamos la lógica externa
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
  console.log("🚀 [SISTEMA] Iniciando Bot V3.3.0 - Arquitectura Modular");
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
          console.log(`📊 [SCAN] Encontrados ${data.length} eventos.`);
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
    
    // 1. PRIORIDAD ABSOLUTA: Alarma visual y sonora
    historialNovedades.forEach(h => h.nuevo = false);
    for (const nombre of detectadosAhora) {
        historialNovedades.unshift({ nombre, hora: ahoraHora, nuevo: true });
    }

    // 2. EXTRACCIÓN (Con límite de tiempo total para no bloquear el loop)
    for (const nombre of detectadosAhora) {
        // Creamos una promesa que "muere" a los 30 segundos pase lo que pase
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('TIMEOUT_GLOBAL_EXTRACTOR')), 30000)
        );

        try {
            console.log(`⏱️ [LOOP] Iniciando extracción segura para: ${nombre}`);
            // Competimos entre el extractor y el timeout de 30s
            const resultado = await Promise.race([
                extraerLinkCompra(browser, page, frame, nombre),
                timeoutPromise
            ]);

            if (resultado && resultado.url) {
                console.log(`✅ [LOOP] Link recibido.`);
                linksDirectos.unshift({ nombre, url: resultado.url, hora: ahoraHora });
            }
        } catch (err) {
            console.log(`⚠️ [LOOP] El extractor tardó demasiado o falló para "${nombre}". Continuando loop principal...`);
            // Forzamos cierre de páginas por si acaso quedó algo abierto
            const pages = await browser.pages();
            for (let i = 1; i < pages.length; i++) { await pages[i].close().catch(()=>{}); }
        }
    }
}
            listaLimpia = nombresActuales.map(n => ({ nombre: n }));
            ultimaActualizacion = ahoraHora;
          }
        }
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

// RUTA DASHBOARD
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
          const sonar = (delay) => {
            setTimeout(() => {
              const osc = context.createOscillator();
              const gain = context.createGain();
              osc.connect(gain); gain.connect(context.destination);
              osc.frequency.value = 880; 
              gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 1.2);
              osc.start(); osc.stop(context.currentTime + 1.2);
            }, delay);
          };
          sonar(0);
          sonar(1500);
        }
        setTimeout(() => location.reload(), 60000);
      </script>
    </body>
  `);
});

// RUTA TEST FORZADO - VISITA GRAN CASTILLO DE PEDRAZA
app.get('/test-alarma', (req, res) => {
    const nombreObjetivo = "VISITA GRAN CASTILLO DE PEDRAZA";
    const indice = listaLimpia.findIndex(e => e.nombre.includes(nombreObjetivo));

    if (indice !== -1) {
        const eliminado = listaLimpia.splice(indice, 1);
        res.send(`
            <div style="background:#000; color:#00ff00; padding:20px; font-family:monospace;">
                <h3>🎯 Simulacro Específico Activado</h3>
                <p>Se ha borrado de la memoria: <b>${eliminado[0].nombre}</b></p>
                <p>En el próximo escaneo (3-4 min), el bot lo detectará como NOVEDAD y lanzará el <b>extractor.js</b>.</p>
                <p>Vigila los logs de Render para ver el rastro de [EXTRACTOR].</p>
            </div>
        `);
    } else {
        res.send(`
            <div style="background:#000; color:#ff4400; padding:20px; font-family:monospace;">
                <h3>⚠️ Error en Simulacro</h3>
                <p>No se encontró "${nombreObjetivo}" en la lista actual de ${listaLimpia.length} eventos.</p>
                <p>Asegúrate de que el primer escaneo haya terminado.</p>
            </div>
        `);
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0');
