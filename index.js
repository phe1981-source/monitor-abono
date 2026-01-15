const puppeteer = require('puppeteer');
const express = require('express');
const { extraerLinkCompra } = require('./extractor'); 
const app = express();

// --- CONFIGURACIÓN ---
const USER = 'phe1981@gmail.com';
const PASS = process.env.ABONO_PASS; 

let listaLimpia = []; 
let historialNovedades = []; 
let linksDirectos = []; 
let ultimaActualizacion = "Sin datos";
let proximoEscaneo = "Calculando...";
let horaProximaReal = "Calculando...";

function obtenerEsperaAleatoria(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

async function iniciarMonitor() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled']
  });
  
  const page = await browser.newPage();
  // ... (Tu lógica de login y navegación se mantiene igual)

  try {
    while (true) {
      historialNovedades.forEach(h => h.nuevo = false);
      
      // --- LÓGICA DE ESCANEO ---
      // (Aquí va tu código de page.goto('.../teatro/') y el filtrado de nombres)
      
      ultimaActualizacion = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

      // --- NUEVA LÓGICA DE TIEMPO (90s a 240s) ---
      const espera = obtenerEsperaAleatoria(90, 240); 
      const ahora = new Date();
      const proximaFecha = new Date(ahora.getTime() + (espera * 1000));
      
      horaProximaReal = proximaFecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
      proximoEscaneo = `${Math.floor(espera/60)}m ${espera%60}s`;
      
      await new Promise(r => setTimeout(r, espera * 1000)); 
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
    setTimeout(iniciarMonitor, 30000); 
  }
}

iniciarMonitor();

// --- DASHBOARD RESTAURADO ---
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
            body { background: #050505; color: #eee; font-family: 'Segoe UI', sans-serif; margin: 0; padding: 20px; text-align: center;}
            .container { max-width: 800px; margin: auto; }
            .main-counter { padding: 50px 20px; background: #0a0a0a; border-radius: 30px; border: 1px solid #222; margin-bottom: 25px; }
            .counter-group { display: flex; justify-content: center; align-items: center; gap: 20px; font-size: 8em; font-weight: 900; line-height: 1; }
            .total-count { color: #fff; }
            .badge-novedad { font-size: 0.8em; }
            .rojo-brillante { color: #ff0033; text-shadow: 0 0 30px rgba(255,0,51,0.6); }
            .gris-apagado { color: #1a1a1a; }
            .status-bar { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 30px; }
            .status-item { background: #111; padding: 15px; border-radius: 12px; border: 1px solid #1a1a1a; }
            .label { color: #555; font-size: 0.7em; text-transform: uppercase; letter-spacing: 2px; display: block; margin-bottom: 5px;}
            .status-value { color: #fff; font-size: 1.4em; font-weight: bold; }
            .sections-vertical { display: flex; flex-direction: column; gap: 25px; text-align: left; }
            .box { background: #0a0a0a; border-radius: 20px; padding: 25px; border: 1px solid #222; }
            h3 { margin: 0 0 20px 0; font-size: 0.8em; text-transform: uppercase; color: #444; border-bottom: 1px solid #1a1a1a; padding-bottom: 10px; }
            .btn-alert { width: 100%; padding: 20px; border-radius: 15px; border: none; font-weight: 900; cursor: pointer; margin-bottom: 25px; transition: 0.3s; }
            .link-card { display: block; background: #001a00; color: #00ff00; padding: 18px; border-radius: 12px; margin-bottom: 12px; text-decoration: none; border: 1px solid #004400; font-weight: bold; }
            .historial-item { padding: 12px 0; border-bottom: 1px solid #111; display: flex; justify-content: space-between; }
        </style>
    </head>
    <body>
        <div class="container">
            <button id="btnSonido" onclick="activarTodo()" class="btn-alert">CARGANDO...</button>

            <div class="main-counter">
                <div class="label" style="margin-bottom:15px">Alertas Detectadas</div>
                <div class="counter-group">
                    <span class="total-count">${totalAcumulado}</span>
                    <span class="badge-novedad ${novedadesN > 0 ? 'rojo-brillante' : 'gris-apagado'}">(+${novedadesN})</span>
                </div>
            </div>

            <div class="status-bar">
                <div class="status-item">
                    <span class="label">Última Lectura</span>
                    <span class="status-value">${ultimaActualizacion}</span>
                </div>
                <div class="status-item">
                    <span class="label">Próxima a las</span>
                    <span class="status-value" style="color:#00ff00">${horaProximaReal}</span>
                </div>
                <div class="status-item">
                    <span class="label">Tiempo Espera</span>
                    <span class="status-value" style="color:#B9C800">Faltan: ${proximoEscaneo}</span>
                </div>
            </div>

            <div class="sections-vertical">
                <div class="box">
                    <h3>🚀 Links Directos (Pata Negra)</h3>
                    ${linksDirectos.slice(0, 5).map(l => `
                        <a href="${l.url}" target="_blank" class="link-card">
                            ${l.nombre} <span style="float:right; font-size:0.7em; opacity:0.5">${l.hora}</span>
                        </a>
                    `).join('') || '<p style="color:#333; text-align:center;">Esperando nuevos eventos...</p>'}
                </div>

                <div class="box">
                    <h3>🔔 Historial Reciente</h3>
                    ${historialNovedades.slice(0, 10).map(h => `
                        <div class="historial-item" style="${h.nuevo ? 'color: #ff0033; font-weight: bold;' : 'color: #888;'}">
                            <span>${h.nombre}</span>
                            <span>${h.hora}</span>
                        </div>
                    `).join('') || '<p style="color:#333; text-align:center;">Historial vacío.</p>'}
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
            }

            // Alarma sonora
            if (${hayNovedad} && sonidoActivado && ${totalAcumulado} > parseInt(sessionStorage.getItem('ultimaAlerta') || '0')) {
                new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg').play().catch(()=>{});
                sessionStorage.setItem('ultimaAlerta', '${totalAcumulado}');
            }

            updateBtn();
            setTimeout(() => location.reload(), 60000);
        </script>
    </body>
    </html>
  `);
});

app.listen(10000, '0.0.0.0');
