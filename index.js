const puppeteer = require('puppeteer');
const express = require('express');
const app = express();

const USER = 'phe1981@gmail.com';
const PASS = process.env.ABONO_PASS || 'fAsHaMp@gZie3g@';

let listaLimpia = []; 
let historialNovedades = []; 
let linksDirectos = []; 
let logEstado = "Iniciando...";
let ultimaActualizacion = "Sin datos";
let proximoEscaneo = "Pendiente";

function obtenerEsperaAleatoria(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

async function iniciarMonitor() {
  console.log("🚀 Iniciando Bot...");
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox', 
      '--disable-blink-features=AutomationControlled'
    ]
  });
  
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  try {
    logEstado = "Intentando Login...";
    await page.goto('https://compras.abonoteatro.com/login/', { waitUntil: 'domcontentloaded', timeout: 90000 });
    
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Aceptar'));
      if (btn) btn.click();
    }).catch(() => {});

    await page.type('#nabonadologin', USER);
    await page.type('#contrasenalogin', PASS);
    
    await Promise.all([
      page.click('input[value="Entrar"].buyBtn'),
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 90000 })
    ]);

    console.log("✅ Login completado.");

    while (true) {
      logEstado = "Escaneando cartelera...";
      await page.goto('https://compras.abonoteatro.com/teatro/', { waitUntil: 'domcontentloaded', timeout: 90000 });
      
      await new Promise(r => setTimeout(r, 15000)); 

      const frameElement = await page.$('iframe');
      if (frameElement) {
        const frame = await frameElement.contentFrame();
        const data = await frame.evaluate(() => {
          return Array.from(document.querySelectorAll('.tribe-events-list-event-title a, h3 a'))
            .map(el => el.innerText.trim())
            .filter(n => n !== "");
        });

        if (data && data.length > 0) {
          const nombresActuales = [...new Set(data)];
          const anteriorNombres = listaLimpia.map(item => item.nombre);
          const detectadosAhora = nombresActuales.filter(n => !anteriorNombres.includes(n));
          
          const ahoraHora = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
          const ahoraTimestamp = Date.now();

          if (detectadosAhora.length > 0) {
            historialNovedades.forEach(h => h.nuevo = false);
            console.log(`✨ ¡Nuevos eventos! Procesando ${detectadosAhora.length} URLs.`);

            for (const nombre of detectadosAhora) {
              // 1. Buscar botón en la página máster (iframe)
              const handle = await frame.evaluateHandle((n) => {
                const link = Array.from(document.querySelectorAll('a')).find(a => a.innerText.includes(n));
                if (link) {
                  const card = link.closest('.tribe-events-list-event-details, .content, .tribe-events-calendar-list__event-details');
                  return card ? card.querySelector('a.buyBtn') : null;
                }
              }, nombre);

              const btnComprarMaster = handle.asElement();
              if (btnComprarMaster) {
                try {
                  // Preparamos captura de la primera ventana (Pop-up 1)
                  const popup1Promise = new Promise(x => browser.once('targetcreated', target => x(target.page())));
                  await btnComprarMaster.click();
                  const popup1 = await popup1Promise;

                  if (popup1) {
                    await popup1.waitForSelector('a.buyBtn', { timeout: 15000 }).catch(() => {});
                    const botones = await popup1.$$('a.buyBtn');
                    
                    if (botones.length >= 2) {
                      // 2. Click en el SEGUNDO botón "Comprar" del pop-up
                      const popup2Promise = new Promise(x => browser.once('targetcreated', target => x(target.page())));
                      await botones[1].click(); 
                      const popup2 = await popup2Promise;

                      if (popup2) {
                        // 3. Capturar URL de la ventana final
                        await new Promise(r => setTimeout(r, 4000));
                        const urlFinal = popup2.url();
                        
                        linksDirectos.unshift({ nombre, url: urlFinal, hora: ahoraHora, timestamp: ahoraTimestamp });
                        await popup2.close();
                      }
                    }
                    await popup1.close();
                  }
                } catch (e) { console.log(`Error en clics para ${nombre}: ${e.message}`); }
              }

              historialNovedades.unshift({ nombre, hora: ahoraHora, timestamp: ahoraTimestamp, nuevo: true });
            }
          }
          listaLimpia = nombresActuales.map(n => ({ nombre: n }));
          ultimaActualizacion = new Date().toLocaleTimeString('es-ES');
        }
      }

      // Limpieza (12h)
      const doceHoras = 12 * 60 * 60 * 1000;
      historialNovedades = historialNovedades.filter(h => (Date.now() - h.timestamp) < doceHoras);
      linksDirectos = linksDirectos.filter(l => (Date.now() - l.timestamp) < doceHoras);

      const espera = obtenerEsperaAleatoria(180, 300);
      const proximaLectura = new Date(Date.now() + espera * 1000).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
      proximoEscaneo = `${Math.floor(espera/60)}m ${espera%60}s`;
      logEstado = `En espera (${proximoEscaneo}) | Horario Proxima lectura: ${proximaLectura}`;
      
      await new Promise(r => setTimeout(r, espera * 1000)); 
    }

  } catch (error) {
    console.log("❌ ERROR:", error.message);
    logEstado = "Error. Reiniciando...";
    await browser.close();
    setTimeout(iniciarMonitor, 30000); 
  }
}

iniciarMonitor();

app.get('/', (req, res) => {
  res.send(`
    <body style="background:#000; color:#fff; font-family:sans-serif; padding:20px;">
      <div style="max-width:800px; margin:auto; background:#0a0a0a; padding:30px; border-radius:20px; border:1px solid #222;">
        
        <header style="text-align:center; margin-bottom:40px; border-bottom: 1px solid #333; padding-bottom:20px;">
          <div style="color:#B9C800; font-size:1.1em; text-transform:uppercase; letter-spacing:1px; margin-bottom:10px;">Eventos Totales</div>
          <div style="font-size:6em; font-weight:bold; color:#B9C800; line-height:1; margin-bottom:15px;">${listaLimpia.length}</div>
          
          <div style="background:#111; padding:15px; border-radius:10px; border:1px solid #222; display:inline-block; min-width:80%; text-align:left;">
            <p style="margin:5px 0; color:#ccc; font-size:1em;"><strong>Estado:</strong> ${logEstado}</p>
            <p style="margin:5px 0; color:#666; font-size:0.8em;">Refresco automático: 60s | Sincro: ${ultimaActualizacion}</p>
          </div>
        </header>

        <section style="margin-bottom:30px;">
          <h3 style="color:#00ff00; font-size:0.9em; text-transform:uppercase; border-left:4px solid #00ff00; padding-left:10px; margin-bottom:15px;">🚀 Links de Compra Directa</h3>
          <div style="background:#001a00; border:1px solid #00ff00; padding:20px; border-radius:12px;">
            ${linksDirectos.length > 0 ? linksDirectos.map(l => `
              <div style="margin-bottom:15px; border-bottom:1px solid #003300; padding-bottom:10px;">
                <div style="color:#66ff66; font-size:0.8em; margin-bottom:4px;">[${l.hora}]</div>
                <a href="${l.url}" target="_blank" style="display:block; color:#fff; font-weight:bold; font-size:1.2em; text-decoration:none; background:#004d00; padding:12px; border-radius:8px; text-align:center; border:1px solid #00ff00;">
                  COMPRAR: ${l.nombre} 🛒
                </a>
              </div>
            `).join('') : '<p style="color:#004400; text-align:center;">Esperando capturar pasarela...</p>'}
          </div>
        </section>

        <section>
          <h3 style="color:#ff4400; font-size:0.9em; text-transform:uppercase; border-left:4px solid #ff4400; padding-left:10px; margin-bottom:15px;">🔔 Historial de Alertas</h3>
          <div style="background:#111; border:1px solid #333; padding:20px; border-radius:12px; max-height:300px; overflow-y:auto;">
            ${historialNovedades.length > 0 ? `
              <table style="width:100%; border-collapse:collapse;">
                ${historialNovedades.map(h => `
                  <tr style="border-bottom:1px solid #222;">
                    <td style="padding:10px 0; color:#ffbb00; width:80px; font-size:0.9em;">[${h.hora}]</td>
                    <td style="padding:10px 0; ${h.nuevo ? 'color:#ff0000; font-size:1.4em; font-weight:bold;' : 'color:orange; font-size:1em;'}">
                      ${h.nombre}
                    </td>
                  </tr>
                `).join('')}
              </table>
            ` : '<p style="color:#333; text-align:center;">Sin novedades recientes.</p>'}
          </div>
        </section>
      </div>
      <script>setTimeout(() => location.reload(), 60000);</script>
    </body>
  `);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0');
