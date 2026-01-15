/**
 * extractor.js - Versión Sniper Pro
 * Especializado en detección de modales y filtrado de enlaces reales
 */

async function extraerLinkCompra(browser, page, frame, nombreEvento) {
    console.log(`\n--- 🎯 OBJETIVO DETECTADO: ${nombreEvento} ---`);
    
    try {
        // 1. LOCALIZAR Y ABRIR EL MODAL (VENTANA EMERGENTE)
        // Buscamos en el listado principal el título o la imagen para hacer clic
        const targetElement = await frame.evaluateHandle((nombre) => {
            const elementos = Array.from(document.querySelectorAll('a, h3, .tribe-events-list-event-title, img'));
            // Buscamos coincidencia por texto o por el atributo 'alt' de las imágenes
            return elementos.find(el => 
                (el.innerText && el.innerText.trim().toLowerCase().includes(nombre.toLowerCase())) || 
                (el.alt && el.alt.toLowerCase().includes(nombre.toLowerCase()))
            );
        }, nombreEvento);

        if (!targetElement || !targetElement.asElement()) {
            console.log(`❌ No se encontró el elemento visual para abrir el modal.`);
            return null;
        }

        console.log(`🖱️ Abriendo ventana emergente (Modal)...`);
        // Forzamos el clic vía JavaScript para evitar bloqueos de elementos superpuestos
        await frame.evaluate(el => el.click(), targetElement);

        // 2. ESPERAR CARGA DEL CONTENIDO INTERNO
        // Damos 4 segundos para que el servidor cargue las fechas y botones dentro del modal
        await new Promise(r => setTimeout(r, 4000));

        // 3. EXTRAER EL PRIMER ENLACE DE COMPRA REAL
        const resultado = await frame.evaluate(() => {
            // Buscamos todos los enlaces que lleven a la ruta de compra
            const todosLosLinks = Array.from(document.querySelectorAll('a[href*="compra"]'));
            
            // FILTRO CRÍTICO: Buscamos el primero que tenga el ID de evento real (eventocurrence)
            // Esto ignora automáticamente los botones estéticos que llevan a "#compradias"
            const linkReal = todosLosLinks.find(a => a.href.includes('eventocurrence='));

            if (linkReal) {
                return { url: linkReal.href, encontrado: true, tipo: 'Directo' };
            }
            
            // PLAN B: Si no hay link con ID, buscamos cualquier botón de "COMPRAR" visible
            // que no sea una simple ancla (#)
            const botones = Array.from(document.querySelectorAll('.buyBtn, .button, a, button'));
            const btnAlternativo = botones.find(b => 
                b.innerText && b.innerText.toUpperCase().includes('COMPRAR') && 
                !b.href?.includes('#') &&
                b.offsetHeight > 0 // Solo botones visibles
            );

            if (btnAlternativo) {
                return { url: btnAlternativo.href || window.location.href, encontrado: true, tipo: 'Ficha' };
            }

            return { url: window.location.href, encontrado: false, tipo: 'Página Actual' };
        });

        // Verificación final de seguridad para evitar URLs vacías
        const urlFinal = (resultado.url && resultado.url !== "about:blank") ? resultado.url : await frame.url();
        
        console.log(`✅ ¡ENLACE CAPTURADO!: ${urlFinal}`);
        return { 
            url: urlFinal, 
            metodo: resultado.tipo 
        };

    } catch (error) {
        console.error(`🔥 [ERROR EXTRACTOR]: ${error.message}`);
        return null;
    }
}

module.exports = { extraerLinkCompra };
