/**
 * extractor.js - Versión Robusta y Verbose
 */
async function extraerLinkCompra(browser, pagePrincipal, frame, nombreEvento) {
    console.log(`🔎 [EXTRACTOR] Iniciando para: "${nombreEvento}"`);
    let pageEvento = null;
    let pagePasarela = null;

    try {
        // 1. Buscamos el link en el iframe
        const resBusqueda = await frame.evaluate((n) => {
            const links = Array.from(document.querySelectorAll('a'));
            const target = links.find(a => a.innerText.trim().toLowerCase().includes(n.toLowerCase()));
            if (!target) return { ok: false, razon: "Texto no hallado en <a>" };
            target.click(); // Intenta abrir pestaña
            return { ok: true };
        }, nombreEvento);

        if (!resBusqueda.ok) {
            console.log(`❌ [EXTRACTOR] ${resBusqueda.razon}`);
            return { error: resBusqueda.razon };
        }

        // 2. Esperamos la pestaña del evento (máximo 8 segundos)
        console.log(`🚀 [EXTRACTOR] Click enviado. Esperando pestaña...`);
        const nuevoTarget = await browser.waitForTarget(t => t.opener() === pagePrincipal.target(), { timeout: 8000 });
        pageEvento = await nuevoTarget.page();

        if (pageEvento) {
            console.log(`📄 [EXTRACTOR] Pestaña abierta. Buscando botón .buyBtn...`);
            
            // Espera corta para el botón
            await pageEvento.waitForSelector('a.buyBtn', { timeout: 7000 });
            const botones = await pageEvento.$$('a.buyBtn');
            console.log(`🔘 [EXTRACTOR] Botones .buyBtn encontrados: ${botones.length}`);

            if (botones.length >= 2) {
                console.log(`🛒 [EXTRACTOR] Click en botón de compra...`);
                const targetPasarelaPromise = browser.waitForTarget(t => t.opener() === nuevoTarget.target(), { timeout: 8000 });
                await botones[1].click();
                
                pagePasarela = await targetPasarelaPromise.page();
                if (pagePasarela) {
                    const urlFinal = pagePasarela.url();
                    console.log(`✅ [EXTRACTOR] URL capturada con éxito.`);
                    return { url: urlFinal };
                }
            } else {
                return { error: `Solo hay ${botones.length} botones, se necesitan 2.` };
            }
        }
    } catch (e) {
        console.log(`🛑 [EXTRACTOR ERROR] Detalle: ${e.message}`);
        return { error: "Timeout o error de navegación" };
    } finally {
        // --- LIMPIEZA ABSOLUTA DE MEMORIA ---
        // Cerramos todas las pestañas extras para que Render no se sature
        try {
            const pages = await browser.pages();
            for (let i = 0; i < pages.length; i++) {
                // Si la página NO es la principal (la primera), la cerramos
                if (pages[i] !== pagePrincipal) {
                    await pages[i].close().catch(() => {});
                }
            }
            console.log(`🧹 [EXTRACTOR] Memoria limpia. Pestañas extra cerradas.`);
        } catch (err) {
            console.log(`⚠️ [EXTRACTOR] Error al limpiar pestañas.`);
        }
    }
    return { error: "Proceso incompleto" };
}

module.exports = { extraerLinkCompra };
