/**
 * extractor.js - Versión 4.0 (Optimizada para Iframe Dinámico)
 */
async function extraerLinkCompra(browser, pagePrincipal, frame, nombreEvento) {
    console.log(`📡 [EXTRACTOR] Localizando: "${nombreEvento}"`);
    let urlDirecta = null;

    try {
        // 1. Aseguramos que estamos dentro del frame correcto para el clic
        // Buscamos el enlace por texto exacto o parcial
        const clickExitoso = await frame.evaluate((n) => {
            const links = Array.from(document.querySelectorAll('a'));
            const target = links.find(a => a.innerText.trim().toLowerCase().includes(n.toLowerCase()));
            if (target) {
                target.scrollIntoView();
                target.click();
                return true;
            }
            return false;
        }, nombreEvento);

        if (!clickExitoso) return { error: "No se encontró el enlace en el catálogo" };

        console.log(`🖱️ [EXTRACTOR] Clic enviado. Esperando ventana de compra...`);

        // 2. Capturar la nueva pestaña que abre la web
        const nuevoTarget = await browser.waitForTarget(t => t.opener() === pagePrincipal.target(), { timeout: 10000 });
        const pagePopup = await nuevoTarget.page();

        if (pagePopup) {
            // 3. Capturar el segundo botón .buyBtn (según tu descubrimiento)
            await pagePopup.waitForSelector('a.buyBtn', { timeout: 8000 });
            
            urlDirecta = await pagePopup.evaluate(() => {
                const btns = Array.from(document.querySelectorAll('a.buyBtn'));
                // Retornamos el segundo botón si existe, sino el primero
                return btns.length >= 2 ? btns[1].href : (btns[0] ? btns[0].href : null);
            });
            
            console.log(urlDirecta ? `✅ [EXTRACTOR] URL capturada: ${urlDirecta.substring(0, 40)}...` : "❌ [EXTRACTOR] No se halló el link en los botones");
        }

    } catch (e) {
        console.log(`🛑 [EXTRACTOR ERROR] ${e.message}`);
    } finally {
        // 4. Limpieza agresiva de memoria
        const pages = await browser.pages();
        for (const p of pages) {
            if (p !== pagePrincipal) await p.close().catch(() => {});
        }
    }

    return urlDirecta ? { url: urlDirecta, metodo: "PopUp-Directo" } : { error: "Fallo en extracción" };
}

module.exports = { extraerLinkCompra };
