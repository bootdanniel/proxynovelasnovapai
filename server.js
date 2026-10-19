import express from 'express';
import axios from 'axios';
import fs from 'fs';

const app = express();
const PORT = 3000;

// Carrega o JSON na memória ao iniciar
let dbNovelas = { series: [] };
try {
    dbNovelas = JSON.parse(fs.readFileSync('./novelascompletabugouv1.json', 'utf8'));
    console.log(`[DB] JSON carregado: ${dbNovelas.series.length} séries.`);
} catch (e) {
    console.error(`[DB] Erro ao ler o JSON:`, e.message);
}

// ROTA 1: API que entrega o JSON apontando os links para o próprio Proxy
app.get('/api/novelas', (req, res) => {
    const host = req.headers.host;
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const baseProxy = `${protocol}://${host}/proxy?url=`;
    
    // Clona o JSON e substitui os links originais pela URL do proxy
    const jsonProxy = JSON.parse(JSON.stringify(dbNovelas));
    for (let s of jsonProxy.series) {
        for (let ep of s.episodios) {
            ep.u = baseProxy + encodeURIComponent(ep.u);
        }
    }
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(jsonProxy);
});

// ROTA 2: Proxy de Streaming (Repassa o vídeo burlando o WAF do Bugou)
app.get('/proxy', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send('Missing url');

    try {
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36',
            'Referer': 'https://embed.bugoumods.com/',
            'Origin': 'https://embed.bugoumods.com',
            'Accept': '*/*'
        };

        // Suporte a Range (permite avançar/retroceder no vídeo do player)
        if (req.headers.range) {
            headers['Range'] = req.headers.range;
        }

        const response = await axios.get(targetUrl, {
            headers: headers,
            responseType: 'stream',
            validateStatus: () => true,
            timeout: 60000
        });

        // Repassa os headers de controle do vídeo
        res.status(response.status);
        if (response.headers['content-length']) res.setHeader('Content-Length', response.headers['content-length']);
        if (response.headers['content-range']) res.setHeader('Content-Range', response.headers['content-range']);
        if (response.headers['accept-ranges']) res.setHeader('Accept-Ranges', response.headers['accept-ranges']);
        res.setHeader('Content-Type', response.headers['content-type'] || 'video/mp4');
        res.setHeader('Access-Control-Allow-Origin', '*');

        // Transmite o vídeo em tempo real sem salvar no disco
        response.data.pipe(res);
    } catch (e) {
        res.status(500).send(e.message);
    }
});

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
