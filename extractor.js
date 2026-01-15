/**
 * extractor.js - Versión Verbose Pro
 * Enfocado en transparencia total y filtrado de IDs de compra reales.
 */

async function extraerLinkCompra(browser, page, frame, nombreEvento) {
    const inicioReloj = Date.now();
    console.log(`\n[EXTRACTOR] 🎯 >>> OBJETIVO: "${nombreEvento}"`);
    
    try {
        // 1. Localización del elemento
        const targetElement = await frame.evaluateHandle((nombre) => {
            const elementos = Array.from(document.querySelectorAll('a, h3, .tribe-events-list-event-title, img'));
            return elementos.find(el => 
                (el.innerText && el.innerText.trim().toLowerCase().includes(nombre.toLowerCase())) || 
                (el.alt && el.alt.toLowerCase().includes(nombre.toLowerCase()))
            );
        }, nombreEvento);

        if (!targetElement || !targetElement.asElement()) {
            console.log(`[EXTRACTOR] ❌ Error: No se encontró el nombre o imagen en el listado.`);
            return null;
        }

        // 2. Acción de Click
        console.log(`[EXTRACTOR] 🖱️ Haciendo clic para abrir Modal...`);
        await frame.evaluate(el => el.click(), targetElement);

        // 3. Espera de carga con log de tiempo
        console.log(`[EXTRACTOR] ⏳ Esperando 4s para renderizado de botones internos...`);
        await new Promise(r => setTimeout(r, 4000));

        // 4. Extracción lógica
        const resultado = await frame.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a[href*="compra"]'));
            // Buscamos el ID real: eventocurrence
            const real = links.find(a => a.href.includes('eventocurrence='));

            if (real) {
                return { url: real.href, tipo: 'PATA NEGRA (Directo)', exito: true };
            }

            // Fallback si no hay ID pero hay botón de compra
            const btn = Array.from(document.querySelectorAll('.buyBtn, .button, a, button')).find(b => 
                b.innerText?.toUpperCase().includes('COMPRAR') && !b.href?.includes('#')
            );

            if (btn) return { url: btn.href || window.location.href, tipo: 'Botón Estándar', exito: true };
            
            return { url: window.location.href, tipo: 'URL de Ficha (No se halló botón)', exito: false };
        });

        const finReloj = Date.now();
        console.log(`[EXTRACTOR] ✅ Hallazgo (${resultado.tipo}): ${resultado.url}`);
        console.log(`[EXTRACTOR] ⏱️ Tiempo de extracción: ${finReloj - inicioReloj}ms`);

        return { url: resultado.url, metodo: resultado.tipo };

    } catch (error) {
        console.error(`[EXTRACTOR] 🔥 CRÍTICO en "${nombreEvento}": ${error.message}`);
        return null;
    }
}

module.exports = { extraerLinkCompra };
