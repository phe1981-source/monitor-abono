async function extraerLinkCompra(browser, page, frame, nombreEvento) {
    console.log(`\n--- 🎯 OBJETIVO DETECTADO: ${nombreEvento} ---`);
    
    try {
        // 1. Buscar el elemento en el listado principal para abrir el Pop-up
        const targetElement = await frame.evaluateHandle((nombre) => {
            // Buscamos cualquier enlace o título que contenga el nombre
            const elementos = Array.from(document.querySelectorAll('a, h3, .tribe-events-list-event-title'));
            return elementos.find(el => el.innerText.trim().toLowerCase().includes(nombre.toLowerCase()));
        }, nombreEvento);

        if (!targetElement.asElement()) {
            console.log(`❌ No se encontró el evento en la lista.`);
            return null;
        }

        // 2. Hacer clic para abrir el Pop-up (usamos click nativo del navegador para evitar bloqueos)
        console.log(`🖱️ Abriendo ventana emergente...`);
        await frame.evaluate(el => el.click(), targetElement);

        // 3. Esperar a que el Pop-up/Modal aparezca y se cargue el botón de COMPRAR
        console.log(`⏳ Esperando a que cargue el botón de compra en el modal...`);
        await new Promise(r => setTimeout(r, 3000)); // Pausa necesaria para la animación del modal

        // 4. Buscar el botón "COMPRAR" dentro de la ventana sobresaliente
        const resultado = await frame.evaluate(() => {
            // Buscamos el botón de comprar que esté visible ahora mismo (el del modal)
            const botones = Array.from(document.querySelectorAll('.buyBtn, .button, a'));
            const btnComprar = botones.find(b => 
                b.innerText.toUpperCase().includes('COMPRAR') && 
                b.offsetHeight > 0 // Asegura que el botón es visible en el pop-up
            );

            if (btnComprar) {
                return { url: btnComprar.href, encontrado: true };
            }
            return { url: window.location.href, encontrado: false };
        });

        if (resultado.encontrado) {
            console.log(`✅ ¡ENLACE CAPTURADO!: ${resultado.url}`);
            return { url: resultado.url, metodo: 'Modal-Directo' };
        } else {
            console.log(`⚠️ Modal abierto, pero no se extrajo link directo. Usando URL de ficha.`);
            return { url: resultado.url, metodo: 'Modal-Ficha' };
        }

    } catch (error) {
        console.error(`🔥 ERROR en la extracción: ${error.message}`);
        return null;
    }
}

module.exports = { extraerLinkCompra };
