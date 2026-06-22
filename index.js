const express = require('express');
const axios = require('axios');
const { realizarLoginYExtraerCookies } = require('./auth');
const { extraerLinkCompra } = require('./extractor');
const { enviarNotificacion } = require('./notificaciones');

const app = express();
let listaLimpia = []; 
let sessionCookie = "";

app.get('/', (req, res) => res.send('OK'));

async function iniciarMonitor() {
    console.log("🚀 [SISTEMA] Monitor V5.0 (API Mode) Iniciado");
    await enviarNotificacion("✅ SISTEMA ONLINE");

    // Login inicial
    try {
        sessionCookie = await realizarLoginYExtraerCookies();
        console.log("🍪 [AUTH] Cookie de sesión obtenida.");
    } catch (err) {
        console.error("❌ [AUTH] Fallo al iniciar sesión:", err.message);
        process.exit(1); 
    }

    while (true) {
        const ahoraES = new Date(new Date().toLocaleString("en-US", {timeZone: "Europe/Madrid"}));
        const hora = ahoraES.getHours();

        if (hora >= 23 || hora < 6) {
            console.log(`🌙 [NOCHE] ${ahoraES.toLocaleTimeString()} - Modo reposo.`);
        } else {
            console.log(`📡 [SCAN] --- CICLO API: ${ahoraES.toLocaleTimeString()} ---`);
            try {
                const response = await axios.get("https://api.abonoteatro.com/api/web/events?page=1&itemsPerPage=50", {
                    headers: { 
                        'Cookie': sessionCookie,
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' 
                    }
                });

                const eventos = response.data.items || [];
                const nombresActuales = eventos.map(e => e.name);

                if (listaLimpia.length > 0) {
                    const detectadosAhora = nombresActuales.filter(n => !listaLimpia.includes(n));
                    for (const nombre of detectadosAhora) {
                        try {
                            const linkInfo = await extraerLinkCompra(nombre, sessionCookie);
                            await enviarNotificacion(linkInfo.mensajeFormateado);
                        } catch (err) {
                            console.log(`❌ Error procesando: ${nombre}`);
                        }
                    }
                }
                listaLimpia = [...nombresActuales];

            } catch (err) {
                console.log("⚠️ Error en ciclo API:", err.message);
                if (err.response && (err.response.status === 401 || err.response.status === 403)) {
                    console.log("🔄 Sesión caducada, re-autenticando...");
                    sessionCookie = await realizarLoginYExtraerCookies();
                }
            }
        }

        const espera = Math.floor(Math.random() * (180 - 60 + 1) + 60);
        await new Promise(r => setTimeout(r, espera * 1000));
    }
}

function programarReinicio() {
    const calcularMs = () => {
        const ahora = new Date();
        const ahoraES = new Date(ahora.toLocaleString("en-US", {timeZone: "Europe/Madrid"}));
        let target = new Date(ahoraES);
        target.setHours(6, 0, 0, 0);
        if (ahoraES >= target) target.setDate(target.getDate() + 1);
        return target - ahoraES;
    };
    setTimeout(() => {
        console.log("🕒 [SISTEMA] Reinicio preventivo (06:00 AM).");
        process.exit(0);
    }, calcularMs());
}

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Servidor activo en puerto ${PORT}`);
    iniciarMonitor();
    programarReinicio();
});
