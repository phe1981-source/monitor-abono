/**
 * extractor.js - Versión 5.0 (Force Click + Network Interception)
 */
async function extraerLinkCompra(browser, pagePrincipal, frame, nombreEvento) {
    console.log(`📡 [SNIPER V5] Acechando: "${nombreEvento}"`);
    let urlFinal = null;

    try {
        // 1. Escucha de red ampliada
        const capturador = new Promise((resolve) => {
            const listener = (request) => {
                const url = request.url();
                // Capturamos cualquier cosa que huela a evento o sesión
                if (url.includes('id_evento=') || url.includes('id_sesion=') || url.includes('compras.abonoteatro.com/pasarela')) {
                    resolve(url);
                }
            };
            pagePrincipal.on('request', listener);
            setTimeout(() => resolve(null), 15000); // 15 segundos de paciencia
        });

        // 2. CLIC DE FUERZA BRUTA
        // Intentamos tres formas de hacer clic al mismo tiempo
        await frame.evaluate((n) => {
            const el = Array.from(document.querySelectorAll('a')).find(a => a.innerText.trim().toLowerCase().includes(n.toLowerCase()));
            if (el) {
                el.scrollIntoView();
                // Método A: Clic estándar
                el.click();
                // Método B: Disparar evento MouseEvent (más real)
                el.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true, view: window}));
                // Método C: Navegar directamente si tiene HREF
                if(el.href && el.href !== '#' && !el.href.startsWith('javascript')) {
                    window.location.href = el.href;
                }
                return true;
            }
            return false;
        }, nombreEvento);

        console.log(`🖱️ [SNIPER V5] Clics múltiples enviados. Esperando tráfico...`);

        // 3. Ver si pescamos algo
        urlFinal = await capturador;
        pagePrincipal.removeAllListeners('request');

    } catch (e) {
        console.log(`🛑 [SNIPER V5 ERROR] ${e.message}`);
    } finally {
        // Cerramos pop-ups si se abrieron
        const pages = await browser.pages();
        for (let i = 1; i < pages.length; i++) { await pages[i].close().catch(() => {}); }
    }

    if (urlFinal) {
        console.log(`🎯 [SNIPER V5] ¡URL CAPTURADA!: ${urlFinal}`);
        return { url: urlFinal, metodo: "Sniper-V5" };
    } else {
        return { error: "Sin tráfico detectado tras clics" };
    }
}

module.exports = { extraerLinkCompra };
