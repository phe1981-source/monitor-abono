async function extraerLinkCompra(browser, page, frame, nombreEvento) {
    console.log(`\n--- 🛠️ INICIANDO EXTRACCIÓN: ${nombreEvento} ---`);
    
    try {
        // 1. Intentar localizar el enlace en TODOS los frames disponibles
        const allFrames = page.frames();
        console.log(`📦 Frames detectados: ${allFrames.length}`);

        let targetElement = null;
        let activeFrame = frame;

        // Buscamos el texto en el frame principal y secundarios
        for (const f of allFrames) {
            const found = await f.evaluateHandle((nombre) => {
                const anchors = Array.from(document.querySelectorAll('a, button, span'));
                return anchors.find(el => el.innerText.trim().toLowerCase().includes(nombre.toLowerCase()));
            }, nombreEvento);

            if (found.asElement()) {
                targetElement = found;
                activeFrame = f;
                console.log(`🎯 Texto encontrado en frame: ${f.url().substring(0, 40)}...`);
                break;
            }
        }

        if (!targetElement) {
            console.log(`❌ No se encontró el elemento visual para: ${nombreEvento}`);
            return null;
        }

        // 2. Click con scroll previo
        console.log(`🖱️ Ejecutando scroll y click...`);
        await activeFrame.evaluate(el => el.scrollIntoView(), targetElement);
        await targetElement.click();

        // 3. Detectar si se ha abierto una pestaña nueva o si el frame cambió
        console.log(`⏳ Esperando respuesta del servidor (5s)...`);
        await new Promise(r => setTimeout(r, 5000));

        // 4. Buscar el botón final de "COMPRAR" o "RESERVAR"
        const linkFinal = await activeFrame.evaluate(() => {
            const selectores = [
                '.buyBtn', '.button-buy', '#btn_comprar', 
                'a[href*="pasarela"]', 'input[type="submit"]',
                '.tribe-events-button'
            ];
            
            for (let sel of selectores) {
                const btn = document.querySelector(sel);
                if (btn) return btn.href || window.location.href;
            }
            return null;
        });

        if (linkFinal) {
            console.log(`✅ ÉXITO: Link capturado: ${linkFinal}`);
            return { url: linkFinal, metodo: 'Auto' };
        } else {
            console.log(`⚠️ Llegamos a la ficha pero el botón de compra no es estándar.`);
            const currentUrl = await activeFrame.url();
            return { url: currentUrl, metodo: 'Manual' };
        }

    } catch (error) {
        console.error(`🔥 ERROR en extractor: ${error.message}`);
        return null;
    }
}

module.exports = { extraerLinkCompra };
