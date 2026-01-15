/**
 * extractor.js - Versión Profesional Modular V3.7
 * Específicamente diseñado para evitar links "fake" y gestionar memoria en Render.
 */

async function extraerLinkCompra(browser, page, frame, nombreEvento) {
    const inicioReloj = Date.now();
    console.log(`\n[EXTRACTOR] 🎯 Buscando link real para: "${nombreEvento}"`);
    
    try {
        // PASO 1: Localización y Apertura del Modal
        const targetElement = await frame.evaluateHandle((nombre) => {
            const elementos = Array.from(document.querySelectorAll('a, h3, .tribe-events-list-event-title, img'));
            return elementos.find(el => 
                (el.innerText && el.innerText.trim().toLowerCase().includes(nombre.toLowerCase())) || 
                (el.alt && el.alt.toLowerCase().includes(nombre.toLowerCase()))
            );
        }, nombreEvento);

        if (!targetElement || !targetElement.asElement()) {
            throw new Error("No se encontró el evento en el listado del iframe.");
        }

        console.log(`[EXTRACTOR] 🖱️ Click en evento para abrir modal...`);
        await frame.evaluate(el => el.click(), targetElement);

        // PASO 2: Extracción Selectiva del Link "Pata Negra"
        // Esperamos un momento a que el modal se renderice en la página principal
        await page.waitForSelector('a[href*="eventocurrence"]', { timeout: 5000 }).catch(() => {});

        const resultado = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a'));
            
            // Filtramos links que contengan 'eventocurrence' y descartamos los que tengan '#'
            const reales = links.filter(a => 
                a.href.includes('eventocurrence=') && 
                !a.href.includes('#')
            );

            if (reales.length > 0) {
                return { 
                    url: reales[0].href, 
                    tipo: 'PATA NEGRA (Directo)', 
                    exito: true 
                };
            }
            
            return { url: null, exito: false };
        });

        if (resultado.exito) {
            console.log(`[EXTRACTOR] ✅ Link obtenido: ${resultado.url}`);
            return { url: resultado.url, metodo: resultado.tipo, exito: true };
        } else {
            throw new Error("Modal abierto pero no se encontró link con 'eventocurrence'.");
        }

    } catch (error) {
        // PASO 3: Manejo de Errores y Retorno Genérico
        console.error(`[EXTRACTOR] ⚠️ Error en extracción: ${error.message}`);
        console.log(`[EXTRACTOR] 🔄 Retornando link de respaldo (Cartelera General).`);
        return { 
            url: 'https://compras.abonoteatro.com/teatro/', 
            metodo: 'Respaldo (General)', 
            exito: false 
        };

    } finally {
        // PASO 4: Limpieza de Memoria y Cierre de Modal (Crucial para Render)
        try {
            await page.keyboard.press('Escape'); // Cerramos el pop-up
            await new Promise(r => setTimeout(r, 500)); // Breve pausa para estabilidad
            const finReloj = Date.now();
            console.log(`[EXTRACTOR] 🧹 Limpieza finalizada. Tiempo total: ${finReloj - inicioReloj}ms`);
        } catch (e) {
            console.log(`[EXTRACTOR] Error menor en limpieza: ${e.message}`);
        }
    }
}

module.exports = { extraerLinkCompra };
