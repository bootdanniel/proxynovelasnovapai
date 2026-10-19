import './server.js';
import { spawn } from 'child_process';
import axios from 'axios';

const GITHUB_TOKEN = "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";
const REPO_OWNER = "bootdanniel";
const REPO_NAME = "proxynovelasnovapai";
const FILE_PATH = "apnovelas.txt"; // <-- SEU ARQUIVO TXT

console.log("Iniciando o Cloudflare Tunnel...");
const tunnel = spawn('cloudflared', ['tunnel', '--no-autoupdate', '--protocol', 'http2', '--url', 'http://localhost:3000', '--metrics', '127.0.0.1:20241']);

let urlEncontrada = false;

async function atualizarGithub(url) {
    try {
        console.log(`[GitHub] Atualizando ${FILE_PATH}...`);
        const getRes = await axios.get(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`, {
            headers: { Authorization: `token ${GITHUB_TOKEN}` }
        });
        
        await axios.put(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`, {
            message: "Atualizando URL do tunel automaticamente",
            content: Buffer.from(url).toString('base64'),
            sha: getRes.data.sha
        }, { headers: { Authorization: `token ${GITHUB_TOKEN}` } });
        
        console.log(`[GitHub] ✅ Arquivo atualizado com a URL: ${url}`);
    } catch (e) {
        console.error(`[GitHub] ❌ Erro ao atualizar:`, e.response ? e.response.data : e.message);
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
