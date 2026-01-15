/**
 * extractor.js - Versión 3.6 (Multi-Método)
 */
async function extraerLinkCompra(browser, pagePrincipal, frame, nombreEvento) {
    console.log(`🧪 [LAB] Iniciando pruebas para: "${nombreEvento}"`);
    let resultados = { m1: "No probado", m2: "No probado", m3: "No probado" };
    const urlOriginal = pagePrincipal.url();

    // MODO 1: Click Clásico (Pestaña hija)
    try {
        console.log("🔹 [M1] Probando Click Clásico...");
        await frame.evaluate((n) => {
            const target = Array.from(document.querySelectorAll('a')).find(a => a.innerText.trim().toLowerCase().includes(n.toLowerCase()));
            if (target) target.click();
        }, nombreEvento);
        const t1 = await browser.waitForTarget(t => t.opener() === pagePrincipal.target(), { timeout: 5000 });
        const p1 = await t1.page();
        if (p1) {
            await p1.waitForSelector('a.buyBtn', { timeout: 4000 });
            resultados.m1 = await p1.evaluate(() => document.querySelectorAll('a.buyBtn')[1]?.href || "Btn no hallado");
            await p1.close();
        }
    } catch (e) { resultados.m1 = "Error/Timeout"; }

    if (resultados.m1.startsWith('http')) return { url: resultados.m1, metodo: "Click Clásico" };

    // MODO 2: New Page Directo (Robo de HREF)
    try {
        console.log("🔹 [M2] Probando Robo de HREF + New Page...");
        const href = await frame.evaluate((n) => {
            const target = Array.from(document.querySelectorAll('a')).find(a => a.innerText.trim().toLowerCase().includes(n.toLowerCase()));
            return target ? target.href : null;
        }, nombreEvento);
        
        if (href) {
            const p2 = await browser.newPage();
            await p2.goto(href, { waitUntil: 'domcontentloaded', timeout: 8000 });
            await p2.waitForSelector('a.buyBtn', { timeout: 4000 });
            resultados.m2 = await p2.evaluate(() => document.querySelectorAll('a.buyBtn')[1]?.href || "Btn no hallado");
            await p2.close();
        }
    } catch (e) { resultados.m2 = "Error/Timeout"; }

    if (resultados.m2.startsWith('http')) return { url: resultados.m2, metodo: "HREF Directo" };

    // MODO 3: Navegación In-Situ (Ir y Volver)
    try {
        console.log("🔹 [M3] Probando Navegación In-Situ...");
        const href = await frame.evaluate((n) => {
            const target = Array.from(document.querySelectorAll('a')).find(a => a.innerText.trim().toLowerCase().includes(n.toLowerCase()));
            return target ? target.href : null;
        }, nombreEvento);

        if (href) {
            await pagePrincipal.goto(href, { waitUntil: 'networkidle2', timeout: 8000 });
            await pagePrincipal.waitForSelector('a.buyBtn', { timeout: 4000 });
            resultados.m3 = await pagePrincipal.evaluate(() => document.querySelectorAll('a.buyBtn')[1]?.href || "Btn no hallado");
            await pagePrincipal.goto(urlOriginal, { waitUntil: 'domcontentloaded' });
        }
    } catch (e) { 
        resultados.m3 = "Error/Timeout";
        await pagePrincipal.goto(urlOriginal, { waitUntil: 'domcontentloaded' }).catch(() => {});
    }

    console.log(`📊 [RESULTADOS] M1: ${resultados.m1} | M2: ${resultados.m2} | M3: ${resultados.m3}`);
    
    if (resultados.m3.startsWith('http')) return { url: resultados.m3, metodo: "In-Situ" };
    
    return { error: `Fallo total. M1:${resultados.m1} M2:${resultados.m2} M3:${resultados.m3}` };
}

module.exports = { extraerLinkCompra };
