const axios = require('axios');

async function realizarLoginYExtraerCookies() {
    const usuario = process.env.ABONO_USUARIO;
    const password = process.env.ABONO_PASS;

    if (!usuario || !password) {
        throw new Error("❌ ABONO_USUARIO o ABONO_PASS no configurados.");
    }

    console.log("🔐 [AUTH] Intentando login con email y contraseña...");

    const response = await axios.post(
        'https://api.abonoteatro.com/api/web/auth/login',
        { email: usuario, password: password },
        {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'
            },
            withCredentials: true
        }
    );

    const setCookie = response.headers['set-cookie'];
    if (!setCookie || setCookie.length === 0) {
        throw new Error("❌ Login exitoso pero sin cookie en respuesta.");
    }

    const cookie = setCookie.map(c => c.split(';')[0]).join('; ');
    console.log("✅ [AUTH] Cookie obtenida automáticamente.");
    return cookie;
}

module.exports = { realizarLoginYExtraerCookies };
