async function extraerLinkCompra(nombreEvento, bearerToken, eventosCache) {
    try {
        const evento = eventosCache?.find(e =>
            e.name.toLowerCase().includes(nombreEvento.toLowerCase())
        );

        if (evento) {
            const urlFinal = `https://www.abonoteatro.com/evento/${evento.id}`;
            const teatro = evento.enclosure?.name || "Teatro no especificado";
            const teatrosVIP = ["Gran Teatro CaixaBank Príncipe Pío", "IFEMA", "Teatro Pavón"];
            const esVIP = teatrosVIP.some(t => teatro.toUpperCase().includes(t.toUpperCase()));
            return {
                exito: true,
                mensajeFormateado: `${esVIP ? "🎯 " : ""}${evento.name}\n🏛️ ${teatro}\n🔗 ${urlFinal}`
            };
        }
        throw new Error("No encontrado en cache");
    } catch (error) {
        console.log(`❌ [EXTRACTOR] Error: ${error.message}`);
        return { exito: false, mensajeFormateado: `${nombreEvento}\n🔗 Revisa la web manualmente.` };
    }
}

module.exports = { extraerLinkCompra };
