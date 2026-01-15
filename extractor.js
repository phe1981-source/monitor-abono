/**
 * extractor.js - Versión 5.1 (Force Click + Network Interception + Stability)
 */
async function extraerLinkCompra(browser, pagePrincipal, frame, nombreEvento) {
    console.log(`📡 [SNIPER V5.1] Acechando: "${nombreEvento}"`);
    let urlFinal = null;

    try {
        // 1. Escucha de red inteligente
        const capturador = new Promise((resolve) => {
            const listener = (request) => {
                const url = request.url();
                // Capturamos cualquier URL que sea de compra, pasarela o sesión
                if (url.includes('id_evento=') || 
                    url.includes('id_sesion=') || 
                    url.includes('pasarela') || 
                    url.includes('tpv')) {
                    resolve(url);
                }
            };
            pagePrincipal.on('request', listener);
            // 15 segundos de paciencia para Render
            setTimeout(() => resolve(null), 15000);
        });

        // 2. CLIC DE FUERZA BRUTA (Mejorado)
        await frame.evaluate((n) => {
            const el = Array.from(document.querySelectorAll('a'))
                            .find(a => a.innerText.trim().toLowerCase().includes(n.toLowerCase()));
            if (el) {
                el.scrollIntoView();
                
                // Método A: Clic estándar
                el.click();
                
                // Método B: Evento de ratón real (para saltar bloqueos de bots)
                const opts = { bubbles: true, cancelable: true, view: window };
                el.dispatchEvent(new MouseEvent('mousedown', opts));
                el.dispatchEvent(new MouseEvent('mouseup', opts));
                el.dispatchEvent(new MouseEvent('click', opts));
                
                // Método C: Si tiene un link real, lo abrimos en pestaña nueva para no romper el bot
                if(el.href && el.href !== '#' && !el.href.startsWith('javascript')) {
                    window.open(el.href, '_blank');
                }
                return true;
            }
            return false;
        }, nombreEvento);

        console.log(`🖱️ [SNIPER V5.1] Clics múltiples enviados. Esperando tráfico...`);

        // 3. Resultado de la intercepción
        urlFinal = await capturador;
        pagePrincipal.removeAllListeners('request');

    } catch (e) {
        console.log(`🛑 [SNIPER V5.1 ERROR] ${e.message}`);
    } finally {
        // LIMPIEZA: Cerramos cualquier basura/pop-up que los 3 clics hayan abierto
        const pages = await browser.pages();
        for (let i = 0; i < pages.length; i++) {
            if (pages[i] !== pagePrincipal) await pages[i].close().catch(() => {});
        }
    }

    if (urlFinal) {
        console.log(`🎯 [SNIPER V5.1] ¡URL CAPTURADA!: ${urlFinal.substring(0, 70)}...`);
        return { url: urlFinal, metodo: "Force-Sniper-V5.1" };
    } else {
        return { error: "Sin tráfico tras clics de fuerza bruta" };
    }
}

module.exports = { extraerLinkCompra };
