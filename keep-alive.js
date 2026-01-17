// keep-alive.js
const express = require('express');

function setupKeepAlive(app) {
    app.get('/keep-alive', (req, res) => {
        const now = new Date();
        
        // Obtenemos la hora en España (península)
        const options = { 
            timeZone: 'Europe/Madrid', 
            hour: 'numeric', 
            hour12: false 
        };
        const spainHour = parseInt(new Intl.DateTimeFormat('en-GB', options).format(now));
        
        const isActiveRange = spainHour >= 7 && spainHour < 22;
        
        console.log(`[KEEP-ALIVE] 📡 Ping recibido a las ${now.toISOString()} (Hora España: ${spainHour}h). Rango crítico: ${isActiveRange ? 'SÍ' : 'NO'}`);
        
        res.status(200).json({
            status: 'ok',
            spainHour: spainHour,
            activeRange: isActiveRange,
            timestamp: now.toISOString()
        });
    });
}

module.exports = { setupKeepAlive };
