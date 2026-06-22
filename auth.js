const axios = require('axios');

async function realizarLoginYExtraerCookies() {
    const usuario = process.env.ABONO_USUARIO;
    const password = process.env.ABONO_PASSWORD;

    const response = await axios.post(
        'https://api.abonoteatro.com/api/web/login', // ⚠️ you need to confirm this endpoint
        { email: usuario, password: password },
        { headers: { 'Content-Type': 'application/json' } }
    );

    const setCookie = response.headers['set-cookie'];
    if (!setCookie) throw new Error("No se recibió cookie tras el login.");
    
    return setCookie.map(c => c.split(';')[0]).join('; ');
}
