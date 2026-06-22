// auth.js
async function realizarLoginYExtraerCookies() {
    console.log("🍪 [AUTH] Usando cookie de sesión fija.");
    const cookie = process.env.COOKIE_SESION;
    if (!cookie) {
        throw new Error("❌ COOKIE_SESION no configurada en Render.");
    }
    return cookie;
}
module.exports = { realizarLoginYExtraerCookies };
