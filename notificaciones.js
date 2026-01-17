// notificaciones.js
const https = require('https');

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function enviarNotificacion(mensaje) {
    if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
        console.warn('⚠️ [NOTIFICACIONES] Telegram Token o Chat ID no configurados. Saltando alerta.');
        return false;
    }

    const encodedMensaje = encodeURIComponent(mensaje);
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage?chat_id=${TELEGRAM_CHAT_ID}&text=${encodedMensaje}&parse_mode=HTML`;

    return new Promise((resolve) => {
        https.get(url, (res) => {
            if (res.statusCode === 200) {
                console.log('✅ [NOTIFICACIONES] Alerta enviada correctamente a Telegram.');
                resolve(true);
            } else {
                console.error(`❌ [NOTIFICACIONES] Error de API Telegram: Código ${res.statusCode}`);
                resolve(false);
            }
        }).on('error', (e) => {
            console.error(`❌ [NOTIFICACIONES] Error de conexión: ${e.message}`);
            resolve(false);
        });
    });
}

module.exports = { enviarNotificacion };
