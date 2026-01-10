const puppeteer = require('puppeteer');
const express = require('express');
const app = express();

const USER = 'phe1981@gmail.com';
const PASS = 'fAsHaMp@gZie3g@';

let memoriaEventos = []; 
let logEstado = "Esperando primer escaneo...";

async function escanearConIframe() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--single-process']
  });
  const page = await browser.newPage();
  
  try {
    logEstado = "Paso 1: Login...";
    console.log(logEstado);
    await page.goto('https://compras.abonoteatro.com/login/', { waitUntil: 'networkidle2' });
    await page.type('#nabonadologin', USER);
    await page.type('#contrasenalogin', PASS);
    await Promise.all([
      page.click('input[value="Entrar"].buyBtn'),
      page.waitForNavigation({ waitUntil: 'networkidle2' })
    ]);

    logEstado = "Paso 2: Entrando en Cartelera...";
    console.log(logEstado);
    await page.goto('https://compras.abonoteatro.com/teatro/', { waitUntil: 'networkidle2' });
    
    // 1. LOCALIZAR EL IFRAME
    logEstado = "Paso 3: Localizando el marco de eventos (iframe)...";
    console.log(logEstado);
    const frameElement = await page.waitForSelector('iframe', { timeout: 30000 });
    const frame = await frameElement.contentFrame();

    if (!frame) {
      throw new Error("No se pudo acceder al contenido del iframe.");
    }

    // 2. ESPERAR A QUE EL CONTENIDO REAL APAREZCA (Basado en tu HTML)
    logEstado = "Paso 4: Esperando a que carguen los títulos del catálogo...";
    console.log(logEstado);
    // Esperamos a que aparezca la clase de los títulos que vimos en tu código fuente
    await frame.waitForSelector('.tribe-events-list-event-title', { timeout: 30000 });

    // 3. EXTRAER TODOS LOS DATOS SIN FILTROS
    const eventos = await frame.evaluate(() => {
      // Buscamos los títulos usando la clase exacta del HTML que enviaste
      const titulos = Array.from(document.querySelectorAll('.tribe-events-list-event-title, h2, h3, h4'));
      return titulos.map(t => t.innerText.trim()).filter(t => t.length > 3);
    });

    memoriaEventos = [...new Set(eventos)]; // Eliminamos duplicados
    logEstado = `¡Éxito! Se han detectado ${memoriaEventos.length} elementos en el catálogo.`;
    console.log(logEstado);

  } catch (error) {
    logEstado = "Error: " + error.
