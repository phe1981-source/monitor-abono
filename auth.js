// auth.js
const puppeteer = require('puppeteer');

const USER = 'phe1981@gmail.com';
const PASS = process.env.ABONO_PASS || 'fAsHaMp@gZie3g@';

async function realizarLoginYExtraerCookies() {
    console.log("🔑 [LOGIN] Iniciando navegador temporal para login...");
    const browser = await puppeteer.launch({ 
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    
    const page = await browser.newPage();
    
    try {
        await page.goto('https://compras.abonoteatro.com/login/', { 
            waitUntil: 'networkidle2', 
            timeout: 90000 
        });
        
        // Aceptar cookies
        await page.evaluate(() => {
            const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Aceptar'));
            if (btn) btn.click();
        }).catch(() => {});

        console.log("📝 [LOGIN] Insertando credenciales...");
        await page.type('#nabonadologin', USER);
        await page.type('#contrasenalogin', PASS);
        
        await Promise.all([
            page.click('input[value="Entrar"].buyBtn'),
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 90000 })
        ]);
        
        console.log("✅ [LOGIN] Autenticación exitosa.");

        // EXTRAER COOKIES
        const cookies = await page.cookies();
        const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
        
        await browser.close(); // CERRAMOS NAVEGADOR PARA LIBERAR RAM
        console.log("🚀 [LOGIN] Navegador cerrado. Usaremos cookies para la API.");
        
        return cookieString;
    } catch (error) {
        await browser.close();
        throw error;
    }
}

module.exports = { realizarLoginYExtraerCookies };