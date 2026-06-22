const axios = require('axios');

async function realizarLoginYExtraerCookies() {
    const usuario = process.env.ABONO_USUARIO;
    const password = process.env.ABONO_PASS;

    if (!usuario || !password) throw new Error("❌ ABONO_USUARIO o ABONO_PASS no configurados.");

    console.log("🔐 [AUTH] Obteniendo CSRF token...");
    const csrfResponse = await axios.get('https://www.abonoteatro.com/api/auth/csrf', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' }
    });

    const csrfToken = csrfResponse.data.csrfToken;
    const csrfCookie = csrfResponse.headers['set-cookie']?.map(c => c.split(';')[0]).join('; ');
    if (!csrfToken) throw new Error("❌ No se pudo obtener el CSRF token.");

    const params = new URLSearchParams();
    params.append('email', usuario);
    params.append('password', password);
    params.append('redirect', 'false');
    params.append('csrfToken', csrfToken);
    params.append('callbackUrl', 'https://www.abonoteatro.com/auth/login');
    params.append('json', 'true');

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
            validateStatus: s => s < 500
        }
    );

    const setCookie = loginResponse.headers['set-cookie'];
    const sessionTokenCookie = setCookie?.map(c => c.split(';')[0]).find(c => c.includes('session-token'));
    if (!sessionTokenCookie) throw new Error("❌ No se encontró session-token.");

    const fullCookie = `${csrfCookie}; ${sessionTokenCookie}`;

    // Now get the Bearer token from /api/auth/session
    console.log("🔐 [AUTH] Obteniendo Bearer token...");
    const sessionResponse = await axios.get('https://www.abonoteatro.com/api/auth/session', {
        headers: {
            'Cookie': fullCookie,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'
        }
    });

    const bearerToken = sessionResponse.data?.user?.accessToken 
        || sessionResponse.data?.accessToken
        || sessionResponse.data?.token;

    console.log("🔍 [AUTH] Session data:", JSON.stringify(sessionResponse.data));

    if (!bearerToken) throw new Error("❌ No se encontró Bearer token en la sesión.");

    console.log("✅ [AUTH] Bearer token obtenido.");
    return bearerToken;
}

module.exports = { realizarLoginYExtraerCookies };
