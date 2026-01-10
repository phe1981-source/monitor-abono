app.get('/', (req, res) => {
  // Si la memoria está vacía, es que está escaneando por primera vez
  if (memoriaEventos.length === 0) {
    return res.send(`
      <body style="font-family:sans-serif; background:#000; color:#fff; display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh;">
        <h2 style="color:#B9C800;">Iniciando el Vigilante...</h2>
        <p>El robot está haciendo login en Abonoteatro. Espera 15 segundos y refresca.</p>
        <script>setTimeout(() => { location.reload(); }, 10000);</script>
      </body>
    `);
  }

  // Si ya tiene datos, los muestra siempre (aunque esté escaneando de fondo)
  res.send(`
    <body style="font-family: sans-serif; background: #000; color: #fff; padding: 20px;">
      <h2 style="color: #B9C800;">Vigilante Activo ⏱️</h2>
      <p>Escaneos realizados: ${escaneosRealizados} | Último: ${ultimaVez}</p>
      
      ${novedadesDetectadas.length > 0 ? `
        <div style="background: #f1c40f; color: #000; padding: 15px; border-radius: 10px; margin-bottom: 20px; border: 3px solid #fff;">
          <h3 style="margin-top:0;">⚠️ ¡ALERTA: CAMBIO DETECTADO!</h3>
          <ul>${novedadesDetectadas.map(n => `<li><strong>${n.titulo}</strong></li>`).join('')}</ul>
          <a href="/limpiar" style="background:#000; color:#fff; padding:5px 10px; text-decoration:none; border-radius:5px;">Borrar Aviso</a>
        </div>
      ` : "<p style='color: #666;'>No hay cambios nuevos aún.</p>"}

      <div style="background: #222; padding: 15px; border-radius: 10px;">
        <h3>Cartelera Actual (${memoriaEventos.length} eventos)</h3>
        <ul style="font-size: 0.8em; color: #ccc;">
          ${memoriaEventos.map(e => `<li>${e}</li>`).join('')}
        </ul>
      </div>
    </body>
  `);
});
