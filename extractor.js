// extractor.js - Versión ID-Extractor V3.8
async function extraerLinkCompra(browser, page, frame, nombreEvento) {
    console.log(`\n[EXTRACTOR] 🎯 Extrayendo ID para: "${nombreEvento}"`);
    
    try {
        // Buscamos el ID directamente en el atributo onclick del botón o el título
        const eventId = await frame.evaluate((nombre) => {
            // Buscamos el elemento que contiene el nombre de la obra
            const elementos = Array.from(document.querySelectorAll('.tribe-events-list-event-title a, button.buyBtn'));
            const objetivo = elementos.find(el => el.innerText.trim().toLowerCase().includes(nombre.toLowerCase()));
            
            if (objetivo) {
                // Extraemos el número del atributo 'onclick="javascript:show_event_modal(58627);"'
                const match = objetivo.getAttribute('onclick').match(/\d+/);
                return match ? match[0] : null;
            }
            return null;
        }, nombreEvento);

        if (eventId) {
            const urlFinal = `https://compras.abonoteatro.com/?pagename=espectaculo&eventid=${eventId}`;
            console.log(`[EXTRACTOR] ✅ ID Detectado: ${eventId}`);
            console.log(`[EXTRACTOR] 🔗 URL Generada: ${urlFinal}`);
            return { url: urlFinal, metodo: 'ID-Directo', exito: true };
        }

        throw new Error("No se pudo capturar el ID del evento");

    } catch (error) {
        console.error(`[EXTRACTOR] ⚠️ Error: ${error.message}`);
        return { url: 'https://compras.abonoteatro.com/teatro/', metodo: 'Respaldo', exito: false };
    }
}

module.exports = { extraerLinkCompra };
