const axios = require('axios');

async function realizarLoginYExtraerCookies() {
    const usuario = process.env.ABONO_USUARIO;
    const password = process.env.ABONO_PASS;

    if (!usuario || !password) {
        throw new Error("❌ ABONO_USUARIO o ABONO_PASS no configurados.");
    }

    console.log("🔐 [AUTH] Obteniendo CSRF token...");

    const csrfResponse = await axios.get('https://www.abonoteatro.com/api/auth/csrf', {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'
        }
    });

    const csrfToken = csrfResponse.data.csrfToken;
    const csrfCookie = csrfResponse.headers['set-cookie']
        ?.map(c => c.split(';')[0]).join('; ');

    console.log("🔍 [AUTH] CSRF Token:", csrfToken);
    console.log("🔍 [AUTH] CSRF Cookie:", csrfCookie);

    if (!csrfToken) throw new Error("❌ No se pudo obtener el CSRF token.");

    const params = new URLSearchParams();
    params.append('email', usuario);
    params.append('password', password);
    params.append('redirect', 'false');
    params.append('csrfToken', csrfToken);
    params.append('callbackUrl', 'https://www.abonoteatro.com/auth/login');
    params.append('json', 'true');

    console.log("🔍 [AUTH] Enviando login POST...");

    const loginResponse = await axios.post(
        'https://www.abonoteatro.com/api/auth/callback/credentials',
        params,
        {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cookie': csrfCookie,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'
            },
            maxRedirects: 0,
            validateStatus: s => s < 500  // show us 401/403 bodies too
        }
    );

    console.log("🔍 [AUTH] Login status:", loginResponse.status);
    console.log("🔍 [AUTH] Login response:", JSON.stringify(loginResponse.data));
    console.log("🔍 [AUTH] Login cookies:", loginResponse.headers['set-cookie']);

    const setCookie = loginResponse.headers['set-cookie'];
    if (!setCookie || setCookie.length === 0) {
        throw new Error("❌ Login fallido - sin cookie en respuesta.");
    }

// Only keep the session token - that's what the API needs
const sessionCookie = setCookie
    .map(c => c.split(';')[0])
    .find(c => c.includes('session-token'));

if (!sessionCookie) throw new Error("❌ No se encontró session-token en la respuesta.");

const cookie = `${csrfCookie}; ${sessionCookie}`;
    console.log("✅ [AUTH] Sesión iniciada correctamente.");
    return cookie;
}

module.exports = { realizarLoginYExtraerCookies };
