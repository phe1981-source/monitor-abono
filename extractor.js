/**
 * Lógica dedicada a navegar y extraer el link de compra
 */
async function extraerLinkCompra(browser, pagePrincipal, frame, nombreEvento) {
    console.log(`🔎 [EXTRACTOR] Investigando: ${nombreEvento}`);
    try {
        // 1. Buscar y hacer clic en el nombre dentro del iframe
        const resBusqueda = await frame.evaluate((n) => {
            const links = Array.from(document.querySelectorAll('a'));
            const target = links.find(a => a.innerText.trim().toLowerCase().includes(n.toLowerCase()));
            if (!target) return { ok: false, razon: "Texto no hallado en enlaces <a>" };
            
            target.scrollIntoView();
            target.click(); // Esto suele abrir una pestaña nueva
            return { ok: true };
        }, nombreEvento);

        if (!resBusqueda.ok) {
            return { error: resBusqueda.razon };
        }

        console.log(`🚀 [EXTRACTOR] Click OK. Esperando pestaña de evento...`);

        // 2. Capturar la nueva pestaña (Pestaña del Evento)
        const nuevoTarget = await browser.waitForTarget(t => t.opener() === pagePrincipal.target(), { timeout: 12000 });
        const pageEvento = await nuevoTarget.page();

        if (pageEvento) {
            console.log(`📄 [EXTRACTOR] Pestaña abierta: ${pageEvento.url().substring(0, 40)}...`);
            
            // Esperar al botón de compra
            await pageEvento.waitForSelector('a.buyBtn', { timeout: 10000 });
            const botones = await pageEvento.$$('a.buyBtn');
            console.log(`🔘 [EXTRACTOR] Botones encontrados: ${botones.length}`);

            if (botones.length >= 2) {
                // 3. Clic en el segundo botón (Pasarela de pago)
                const targetPasarelaPromise = browser.waitForTarget(t => t.opener() === nuevoTarget.target(), { timeout: 12000 });
                await botones[1].click();
                
                const pagePasarela = await targetPasarelaPromise.page();
                if (pagePasarela) {
                    const urlFinal = pagePasarela.url();
                    await pagePasarela.close().catch(() => {});
                    await pageEvento.close().catch(() => {});
                    return { url: urlFinal };
                }
            } else {
                await pageEvento.close().catch(() => {});
                return { error: `Faltan botones de compra (${botones.length})` };
            }
        }
    } catch (e) {
        return { error: e.message };
    }
    return { error: "Error desconocido en el proceso" };
}

module.exports = { extraerLinkCompra };
