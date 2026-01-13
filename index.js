while (true) {
      logEstado = "Escaneando...";
      await page.goto('https://compras.abonoteatro.com/teatro/', { waitUntil: 'networkidle2', timeout: 120000 });
      
      // Esperamos al iframe con más paciencia
      const frameElement = await page.waitForSelector('iframe', { timeout: 60000 });
      const frame = await frameElement.contentFrame();

      // Damos 3 segundos extra para que el contenido del iframe cargue realmente
      await new Promise(r => setTimeout(r, 3000)); 

      const data = await frame.evaluate(() => {
        // Buscamos en todas las posibles clases de títulos de Abonoteatro
        const selectors = '.tribe-events-list-event-title a, h3 a, .entry-title a, .tribe-events-calendar-list__event-title a';
        return Array.from(document.querySelectorAll(selectors))
          .map(el => el.innerText.trim())
          .filter(n => n !== "" && n.length > 3);
      });

      if (data && data.length > 0) {
        const nombresActuales = [...new Set(data)];
        const ahoraHora = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        
        // ... (resto de la lógica de detección de novedades igual)
        
        listaLimpia = nombresActuales.map(n => ({ nombre: n }));
        ultimaActualizacion = ahoraHora;
        console.log(`✅ Escaneo exitoso: ${data.length} eventos encontrados.`);
      } else {
        console.log("⚠️ El escaneo devolvió 0. Reintentando en el próximo ciclo.");
        logEstado = "Error de lectura (0)";
      }
      
      const esperaMs = Math.floor(Math.random() * (300000 - 90000 + 1) + 90000);
      logEstado = "Espera (" + Math.round(esperaMs / 1000) + "s)";
      await new Promise(r => setTimeout(r, esperaMs));
    }
