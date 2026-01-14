const puppeteer = require('puppeteer');
const express = require('express');
const fs = require('fs');
const { captureUrl } = require('./extractor'); // Importamos el módulo
const app = express();

const USER = 'phe1981@gmail.com';
const PASS = process.env.ABONO_PASS || 'fAsHaMp@gZie3g@';

let listaLimpia = [], historialNovedades = [], linksDirectos = [];
let logEstado = "Iniciando...", ultimaActualizacion = "Sin datos";

async function iniciarMonitor() {
  const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  try {
    logEstado = "Login...";
    await page.goto('https://compras.abonoteatro.com/login/', { waitUntil: 'domcontentloaded' });
    await page.type('#nabonadologin', USER);
    await page.type('#contrasenalogin', PASS);
    await Promise.all([page.click('input[value="Entrar"]'), page.waitForNavigation()]);

    while (true) {
      logEstado = "Escaneando...";
      await page.goto('https://compras.abonoteatro.com/teatro/', { waitUntil: 'domcontentloaded' });
      await new Promise(r => setTimeout(r, 15000));

      const frame = await (await page.$('iframe')).contentFrame();
      const nombresActuales = await frame.evaluate(() => {
        return Array.from(document.querySelectorAll('.tribe-events-list-event-title a')).map(el => el.innerText.trim());
      });

      const detectados = nombresActuales.filter(n => !listaLimpia.includes(n));
      if (detectados.length > 0 && listaLimpia.length > 0) {
        historialNovedades.forEach(h => h.nuevo = false);
        for (const nombre of detectados) {
          // 🔔 ALERTA INMEDIATA (Must)
          historialNovedades.unshift({ nombre, hora: new Date().toLocaleTimeString(), nuevo: true });
          // 🚀 BUSQUEDA URL (Should - En segundo plano)
          captureUrl(browser, page, nombre).then(url => {
            if (url) linksDirectos.unshift({ nombre, url, hora: new Date().toLocaleTimeString() });
          });
        }
      }
      listaLimpia = nombresActuales;
      ultimaActualizacion = new Date().toLocaleTimeString();
      await new Promise(r => setTimeout(r, 180000));
    }
  } catch (e) {
    console.log("Error:", e.message);
    await browser.close();
    setTimeout(iniciarMonitor, 10000);
  }
}

iniciarMonitor();

// Dashboard (Interfaz de Alertas)
app.get('/', (req, res) => {
  const hayNovedad = historialNovedades.some(h => h.nuevo);
  res.send(`<h1>Eventos: ${listaLimpia.length}</h1>... (resto del HTML con sonido)`);
});

app.listen(process.env.PORT || 10000);
