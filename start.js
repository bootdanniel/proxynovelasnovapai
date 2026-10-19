import './server.js';
import { spawn } from 'child_process';
import axios from 'axios';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = "bootdanniel";
const REPO_NAME = "proxynovelasnovapai";
const FILE_PATH = "apnovelas.txt";

if (!GITHUB_TOKEN) {
    console.error("[GitHub] ❌ ERRO FATAL: GITHUB_TOKEN não definido!");
    process.exit(1);
}
console.log(`[GitHub] Token carregado: ${GITHUB_TOKEN.substring(0, 10)}...`);

console.log("Iniciando o Cloudflare Tunnel...");
const tunnel = spawn('cloudflared', ['tunnel', '--no-autoupdate', '--protocol', 'http2', '--url', 'http://localhost:3000', '--metrics', '127.0.0.1:20241']);

let urlEncontrada = false;

async function atualizarGithub(url) {
    try {
        console.log(`[GitHub] Atualizando ${FILE_PATH}...`);
        const headers = {
            Authorization: `Bearer ${GITHUB_TOKEN}`,
            Accept: 'application/vnd.github.v3+json'
        };

        const getRes = await axios.get(
            `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`,
            { headers }
        );

        await axios.put(
            `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`,
            {
                message: "Atualizando URL do tunel automaticamente",
                content: Buffer.from(url).toString('base64'),
                sha: getRes.data.sha
            },
            { headers }
        );

        console.log(`[GitHub] ✅ Arquivo atualizado com a URL: ${url}`);
    } catch (e) {
        const status = e.response?.status;
        const msg = e.response?.data?.message || e.message;
        console.error(`[GitHub] ❌ Erro (${status}): ${msg}`);
    }
}

function capturar(s) {
    if (!urlEncontrada) {
        const m = s.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
        if (m) {
            urlEncontrada = true;
            console.log(`[Tunnel] ✅ URL encontrada: ${m[0]}`);
            atualizarGithub(m[0]);
        }
    }
}

tunnel.stdout.on('data', d => capturar(String(d)));
tunnel.stderr.on('data', d => capturar(String(d)));
