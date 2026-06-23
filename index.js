const express = require('express');
const axios = require('axios');
const { realizarLoginYExtraerCookies } = require('./auth');
const { extraerLinkCompra } = require('./extractor');
const { enviarNotificacion } = require('./notificaciones');

const app = express();
let listaLimpia = [];
let bearerToken = "";

app.get('/', (req, res) => res.send('OK'));

const API_HEADERS = () => ({
    'Authorization': `Bearer ${bearerToken}`,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
    'accept': 'application/json, text/plain, */*',
    'origin': 'https://www.abonoteatro.com',
    'referer': 'https://www.abonoteatro.com/',
    'x-locale': 'es_ES',
    'x-market': '01833ce0-3486-7bfd-84a1-ad157cf64005',
    'x-user-type': 'SUBSCRIBER'
});

// FUNCIÓN DE PAGINACIÓN: Obtiene todo el catálogo
async function obtenerTodosLosEventos() {
    let todosLosEventos = [];
    let pagina = 1;
    let continuar = true;

    while (continuar) {
        try {
            const response = await axios.get(
                `https://api.abonoteatro.com/api/web/events?page=${pagina}&itemsPerPage=50`,
                { headers: API_HEADERS() }
            );

            const items = response.data.items || [];
            if (items.length > 0) {
                todosLosEventos = [...todosLosEventos, ...items];
                // Si la API nos da 50 items, asumimos que hay otra página
                if (items.length === 50) {
                    pagina++;
                } else {
                    continuar = false;
                }
            } else {
                continuar = false;
            }
        } catch (err) {
            console.error(`❌ Error en paginación (pág ${pagina}):`, err.message);
            throw err; // Propaga el error para que el ciclo principal lo maneje
        }
    }
    return todosLosEventos;
}

async function iniciarMonitor() {
    console.log("🚀 [SISTEMA] Monitor V5.0 (Paginado) Iniciado");
    await enviarNotificacion("✅ SISTEMA ONLINE");

    try {
        bearerToken = await realizarLoginYExtraerCookies();
        console.log("🔑 [AUTH] Bearer token obtenido.");
    } catch (err) {
        console.error("❌ [AUTH] Fallo al iniciar:", err.message);
        // Espera de seguridad antes de reintentar el inicio
        const espera = Math.floor(Math.random() * (180000 - 60000 + 1) + 60000);
        console.log(`⏱️ Fallo inicial. Reintentando inicio en ${Math.round(espera / 1000)}s...`);
        await new Promise(r => setTimeout(r, espera));
        return iniciarMonitor();
    }

    while (true) {
        const ahoraES = new Date(new Date().toLocaleString("en-US", {timeZone: "Europe/Madrid"}));
        
        if (ahoraES.getHours() >= 23 || ahoraES.getHours() < 6) {
            console.log(`🌙 [NOCHE] Reposo.`);
            await new Promise(r => setTimeout(r, 600000));
        } else {
            console.log(`📡 [SCAN] --- INICIO DE ESCANEO TOTAL ---`);
            const inicio = Date.now();
            try {
                const eventos = await obtenerTodosLosEventos();
                const duracion = ((Date.now() - inicio) / 1000).toFixed(2);
                const horaActual = new Date().toLocaleTimeString('es-ES', { hour12: false });

                console.log(`✅ [SCAN] Escaneado a las ${horaActual} | ${eventos.length} eventos procesados en ${duracion}s.`);

                const nombresActuales = eventos.map(e => e.name);

                if (listaLimpia.length > 0) {
                    const detectadosAhora = nombresActuales.filter(n => !listaLimpia.includes(n));
                    if (detectadosAhora.length > 0) {
                        console.log(`✨ [NOVEDADES] Detectados ${detectadosAhora.length} nuevos eventos.`);
                    }
                    
                    for (const nombre of detectadosAhora) {
                        try {
                            const linkInfo = await extraerLinkCompra(nombre, bearerToken, eventos);
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
                    console.log("🔄 Token caducado, re-autenticando...");
                    bearerToken = await realizarLoginYExtraerCookies();
                }
            }

            const esperaMs = Math.floor(Math.random() * (180000 - 60000 + 1) + 60000);
            const proximoEscaneo = new Date(Date.now() + esperaMs);
            const horaProximo = proximoEscaneo.toLocaleTimeString('es-ES', { hour12: false });
            
            console.log(`⏱️ Próximo escaneo programado para las ${horaProximo}.`);
            await new Promise(r => setTimeout(r, esperaMs));
        }
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
