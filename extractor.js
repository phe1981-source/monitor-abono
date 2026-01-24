// extractor.js - Versión V4.0 (Base Jules + Lógica VIP)
async function extraerLinkCompra(browser, page, frame, nombreEvento) {
    try {
        const result = await frame.evaluate((nombre) => {
            // Selectores ampliados de la V4.0 para no perder nada
            const selectores = '.tribe-events-list-event-title a, button.buyBtn, h3 a, .tribe-events-calendar-list__event-title a';
            const elementos = Array.from(document.querySelectorAll(selectores));
            const objetivo = elementos.find(el => el.innerText.trim().toLowerCase().includes(nombre.toLowerCase()));
            
            if (objetivo) {
                const onclickStr = objetivo.getAttribute('onclick') || "";
                const match = onclickStr.match(/\d+/);
                const id = match ? match[0] : null;

                // Búsqueda de teatro ultra-resistente de la V4.0
                let teatro = "Teatro no especificado";
                const container = objetivo.closest('.type-tribe_events, .tribe-events-list-event-wrapper, .tribe-events-calendar-list__event-row');
                if (container) {
                    const venue = container.querySelector('.tribe-events-venue-details a, .tribe-venue a, .tribe-events-calendar-list__event-venue');
                    if (venue) teatro = venue.innerText.trim();
                }
                return { id, teatro };
            }
            return null;
        }, nombreEvento);

        if (result && result.id) {
            // Usamos tu URL preferida que confirmas que funciona
            const urlFinal = `https://compras.abonoteatro.com/?pagename=espectaculo&eventid=${result.id}`;
            
            const teatrosVIP = ["Gran Teatro CaixaBank Príncipe Pío", "IFEMA", "Teatro Pavón"];
            const esVIP = teatrosVIP.some(t => result.teatro.toUpperCase().includes(t.toUpperCase()));
            const prefijo = esVIP ? "🎯 " : "";

            const mensajeTelegram = `${prefijo}${nombreEvento}\n🏛️ ${result.teatro}\n🔗 ${urlFinal}`;
            
            return { url: urlFinal, exito: true, mensajeFormateado: mensajeTelegram };
        }
        throw new Error("ID no capturado");
    } catch (error) {
        return { url: 'https://compras.abonoteatro.com/teatro/', exito: false, mensajeFormateado: `${nombreEvento}\n🏛️ Revisa en la web\n🔗 https://compras.abonoteatro.com/teatro/` };
    }
}
module.exports = { extraerLinkCompra };
