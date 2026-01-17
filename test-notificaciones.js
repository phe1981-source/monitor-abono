// test-notificaciones.js
const { enviarNotificacion } = require('./notificaciones');

async function test() {
    console.log("🧪 [TEST] Iniciando prueba de notificación...");
    const resultado = await enviarNotificacion("Prueba de sistema: <b>El monitor está activo</b> 🚀");
    console.log(`🧪 [TEST] Resultado del envío: ${resultado ? 'EXITO' : 'FALLO (Esperado si no hay tokens)'}`);
}

test();
