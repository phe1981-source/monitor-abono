const express = require('express');
const axios = require('axios');
const { realizarLoginYExtraerCookies } = require('./auth'); // Importamos la nueva función
const { extraerLinkCompra } = require('./extractor');
const { enviarNotificacion } = require('./notificaciones');

const app = express();
let listaLimpia = []; 
let sessionCookie = ""; // Variable para guardar la sesión

app.get('/', (req, res) => res.send('OK'));

async function iniciarMonitor() {
    console.log("🚀 [SISTEMA] Monitor V5.0 (API + Auth Mode) Iniciado");
    await enviarNotificacion("✅ SISTEMA ONLINE");

    // Realizamos el login una sola vez al arrancar
    try {
        sessionCookie = await realizarLoginYExtraerCookies();
        console.log("🍪 [AUTH] Cookie de sesión obtenida.");
    } catch (err) {
        console.error("❌ [AUTH] Fallo al iniciar sesión:", err.message);
        return; // Detenemos si no hay sesión
    }

    while (true) {
        const ahoraES = new Date(new Date().toLocaleString("en-US", {timeZone: "Europe/Madrid"}));
        const hora = ahoraES.getHours();

        if (hora >= 23 || hora < 6) {
            console.log(`🌙 [NOCHE] ${ahoraES.toLocaleTimeString()} - Modo reposo.`);
        } else {
            console.log(`📡 [SCAN] --- CICLO API: ${ahoraES.toLocaleTimeString()} ---`);
            try {
                // LLAMADA A LA API CON LA COOKIE
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
                            // Pasamos la cookie también al extractor si este usa axios internamente
                            const linkInfo = await extraerLinkCompra(nombre, sessionCookie);
                            await enviarNotificacion(linkInfo.mensajeFormateado);
                        } catch (err) {
                            console.log(`❌ Error procesando: ${nombre}`);
                        }
                    }
                }
                listaLimpia = [...nombresActuales];

            } catch (err) {
                console.log("⚠️ Error en ciclo API (quizás sesión caducada):", err.message);
                // Opcional: si da error 401/403, forzar un nuevo login:
                // sessionCookie = await realizarLoginYExtraerCookies();
            }
        }

        const espera = Math.floor(Math.random() * (180 - 60 + 1) + 60);
        await new Promise(r => setTimeout(r, espera * 1000));
    }
}

// Asegúrate de tener programarReinicio() y app.listen() definidos abajo...