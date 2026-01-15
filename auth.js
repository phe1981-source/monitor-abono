// auth.js
const USER = 'phe1981@gmail.com';
const PASS = process.env.ABONO_PASS || 'fAsHaMp@gZie3g@';

async function realizarLogin(page) {
    console.log("🔑 [LOGIN] Accediendo a la página...");
    await page.goto('https://compras.abonoteatro.com/login/', { 
        waitUntil: 'networkidle2', 
        timeout: 90000 
    });
    
    // Gestión de cookies Referencia
    await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Aceptar'));
        if (btn) btn.click();
    }).catch(() => {});

    console.log("📝 [LOGIN] Inserimento credenziali...");
    await page.type('#nabonadologin', USER);
    await page.type('#contrasenalogin', PASS);
    
    await Promise.all([
        page.click('input[value="Entrar"].buyBtn'),
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 90000 })
    ]);
    console.log("✅ [LOGIN] Successo.");
    return true;
}

module.exports = { realizarLogin };