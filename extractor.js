/**
 * extractor.js - Versión Verbose Pro V3.5
 * Corregido para buscar links de compra fuera del iframe (en el modal).
 */

async function extraerLinkCompra(browser, page, frame, nombreEvento) {
    const inicioReloj = Date.now();
    console.log(`\n[EXTRACTOR] 🎯 >>> OBJETIVO: "${nombreEvento}"`);
    
    try {
        // 1. Localización del elemento dentro del iframe
        const targetElement = await frame.evaluateHandle((nombre) => {
            const elementos = Array.from(document.querySelectorAll('a, h3, .tribe-events-list-event-title, img'));
            return elementos.find(el => 
                (el.innerText && el.innerText.trim().toLowerCase().includes(nombre.toLowerCase())) || 
                (el.alt && el.alt.toLowerCase().includes(nombre.toLowerCase()))
            );
        }, nombreEvento);

        if (!targetElement || !targetElement.asElement()) {
            console.log(`[EXTRACTOR] ❌ Error: No se encontró el nombre en el listado.`);
            return { url: 'https://compras.abonoteatro.com/teatro/', metodo: 'Respaldo' };
        }

        // 2. Acción de Click
        console.log(`[EXTRACTOR] 🖱️ Abriendo Modal...`);
        await frame.evaluate(el => el.click(), targetElement);

        // 3. Espera de carga (El modal se abre en la "page", no en el "frame")
        console.log(`[EXTRACTOR] ⏳ Esperando renderizado en página principal...`);
        // Esperamos a que aparezca cualquier link de compra con ID real
        await page.waitForSelector('a[href*="eventocurrence"]', { timeout: 6000 }).catch(() => {});

        // 4. Extracción lógica en la PÁGINA PRINCIPAL
        const resultado = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a[href*="compra"]'));
            
            // FILTRO PATA NEGRA: Buscamos el ID real: eventocurrence
            // Ignoramos los que terminan en #compradias (el "fake" de tu imagen)
            const real = links.find(a => a.href.includes('eventocurrence=') && !a.href.includes('#'));

            if (real) {
                return { url: real.href, tipo: 'PATA NEGRA (Directo)', exito: true };
            }

            // Fallback: Si no hay link de sesión, buscamos cualquier botón de compra que no sea el fake
            const btn = Array.from(document.querySelectorAll('.buyBtn, .button, a, button')).find(b => 
                b.innerText?.toUpperCase().includes('COMPRAR') && !b.href?.includes('#')
            );

            if (btn && btn.href) return { url: btn.href, tipo: 'Botón Estándar', exito: true };
            
            return { url: 'https://compras.abonoteatro.com/teatro/', tipo: 'Respaldo (General)', exito: false };
        });

        // 5. Limpieza: Cerramos el modal para no estorbar en el siguiente ciclo
        await page.keyboard.press('Escape');

        const finReloj = Date.now();
        console.log(`[EXTRACTOR] ✅ Hallazgo (${resultado.tipo}): ${resultado.url}`);
        console.log(`[EXTRACTOR] ⏱️ Tiempo: ${finReloj - inicioReloj}ms`);

        return { url: resultado.url, metodo: resultado.tipo };

    } catch (error) {
        console.error(`[EXTRACTOR] 🔥 CRÍTICO en "${nombreEvento}": ${error.message}`);
        return { url: 'https://compras.abonoteatro.com/teatro/', metodo: 'Error Fallback' };
    }
}

module.exports = { extraerLinkCompra };
