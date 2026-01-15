const puppeteer = require('puppeteer');
const express = require('express');
const { extraerLinkCompra } = require('./extractor'); 
const app = express();

const USER = 'phe1981@gmail.com';
const PASS = process.env.ABONO_PASS; 

let listaLimpia = []; 
let historialNovedades = []; 
let linksDirectos = []; 
let logEstado = "Iniciando...";
let ultimaActualizacion = "Sin datos";
let proximoEscaneo = "Calculando...";
let horaProximaReal = "Calculando..."; // Nueva variable para coherencia

function obtenerEsperaAleatoria(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

async function iniciarMonitor() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled']
  });
  
  const page = await browser.newPage();
  // ... (Configuración de User Agent y Login igual que antes)

  try {
    // Lógica de Login omitida por brevedad...

    while (true) {
      historialNovedades.forEach(h => h.nuevo = false);
      logEstado = "Scanning...";
      
      // Simulación de navegación y extracción...
      // (Aquí va tu lógica de page.goto y extraerLinkCompra)
      
      ultimaActualizacion = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

      // --- CAMBIO 1: Rango aleatorio de 90s a 4min ---
      const espera = obtenerEsperaAleatoria(90, 240); 
      
      // --- CAMBIO 2: Lógica de Hora Próxima corregida ---
      const ahora = new Date();
      const proximaData = new Date(ahora.getTime() + (espera * 1000));
      horaProximaReal = proximaData.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
      
      proximoEscaneo = `${Math.floor(espera/60)}m ${espera%60}s`;
      logEstado = "Esperando...";
      
      await new Promise(r => setTimeout(r, espera * 1000)); 
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
    setTimeout(iniciarMonitor, 30000); 
  }
}

iniciarMonitor();

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
            /* Tus estilos CSS anteriores... */
            body { background: #050505; color: #eee; font-family: 'Segoe UI', sans-serif; text-align: center; padding: 20px; }
            .status-bar { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-top: 20px; }
            .status-item { background: #111; padding: 15px; border-radius: 12px; border: 1px solid #1a1a1a; }
            .label { color: #555; font-size: 0.7em; text-transform: uppercase; display: block; }
            .status-value { color: #fff; font-size: 1.4em; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="status-bar">
            <div class="status-item">
                <span class="label">Última Lectura</span>
                <span class="status-value">${ultimaActualizacion}</span>
            </div>
            <div class="status-item">
                <span class="label">Próxima a las</span>
                <span class="status-value" style="color: #00ff00;">${horaProximaReal}</span>
                <span style="display:block; font-size: 0.8em; color: #555;">(Decidido al azar)</span>
            </div>
            <div class="status-item">
                <span class="label">Tiempo de espera</span>
                <span class="status-value" style="color:#B9C800">Faltan: ${proximoEscaneo}</span>
            </div>
        </div>

        <script>
            // Mantenemos el "freno" de sonido para que no pite cada 60s
            const totalAlertas = ${totalAcumulado};
            const ultimaAlertaNotificada = parseInt(sessionStorage.getItem('ultimaAlertaNotificada') || '0');
            if (${hayNovedad} && totalAlertas > ultimaAlertaNotificada) {
                // sonar(); ...
                sessionStorage.setItem('ultimaAlertaNotificada', totalAlertas);
            }
            
            // Recarga automática cada minuto para refrescar el estado del servidor
            setTimeout(() => location.reload(), 60000);
        </script>
    </body>
    </html>
  `);
});

app.listen(10000, '0.0.0.0');
