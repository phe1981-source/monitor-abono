const axios = require('axios');

async function extraerLinkCompra(nombreEvento, bearerToken) {
    try {
        const response = await axios.get("https://api.abonoteatro.com/api/web/events?page=1&itemsPerPage=50", {
            headers: {
                'Authorization': `Bearer ${bearerToken}`,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
                'accept': 'application/json, text/plain, */*',
                'origin': 'https://www.abonoteatro.com',
                'referer': 'https://www.abonoteatro.com/',
                'x-locale': 'es_ES',
                'x-market': '01833ce0-3486-7bfd-84a1-ad157cf64005',
                'x-user-type': 'SUBSCRIBER'
            }
        });

        const evento = response.data.items.find(e =>
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
        throw new Error("No encontrado");
    } catch (error) {
        return { exito: false, mensajeFormateado: `${nombreEvento}\n🔗 Revisa la web manualmente.` };
    }
}

module.exports = { extraerLinkCompra };
