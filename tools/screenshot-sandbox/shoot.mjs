// Генератор скриншотов без Playwright/Puppeteer:
// локальный HTTP-сервер + headless Chrome/Edge.
//
// Запуск: node tools/screenshot-sandbox/shoot.mjs [--only=01-main-dark]

import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'docs', 'screenshots');

const ICONS = {
    gh: ['GH', '#24292f'],
    gl: ['GL', '#fc6d26'],
    so: ['SO', '#f48024'],
    mdn: ['MDN', '#111111'],
    yt: ['YT', '#ff0000'],
    reddit: ['R', '#ff4500'],
    x: ['X', '#111111'],
    wiki: ['W', '#333333'],
    jira: ['J', '#0052cc'],
    conf: ['C', '#0052cc'],
    figma: ['F', '#a259ff'],
    notion: ['N', '#111111'],
    slack: ['S', '#4a154b'],
    linear: ['L', '#5e6ad2'],
    coursera: ['C', '#0056d2'],
    leetcode: ['LC', '#ffa116'],
    arxiv: ['A', '#b31b1b'],
    duolingo: ['D', '#58cc02'],
    khan: ['K', '#14bf96'],
    google: ['G', '#4285f4'],
    ddg: ['D', '#de5833'],
    bing: ['B', '#008373'],
};

const SHOTS = [
    { name: '01-main-dark', shot: 'main', theme: 'dark' },
    { name: '02-main-light', shot: 'main', theme: 'light' },
    { name: '03-screens-dark', shot: 'screens', theme: 'dark' },
    { name: '04-screens-light', shot: 'screens', theme: 'light' },
    { name: '05-backgrounds-dark', shot: 'backgrounds', theme: 'dark' },
    { name: '06-search-engines-dark', shot: 'search-engines', theme: 'dark' },
    { name: '07-context-menu-dark', shot: 'context-menu', theme: 'dark' },
    { name: '08-delete-screen-dark', shot: 'delete-screen', theme: 'dark' },
    { name: '09-backgrounds-light', shot: 'backgrounds', theme: 'light' },
    { name: '10-search-engines-light', shot: 'search-engines', theme: 'light' },
    { name: '11-context-menu-light', shot: 'context-menu', theme: 'light' },
    { name: '12-delete-screen-light', shot: 'delete-screen', theme: 'light' },
];

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
};

function sandboxHtml() {
    let html = fs.readFileSync(path.join(ROOT, 'newtab', 'index.html'), 'utf8');
    html = html.replace('<head>', '<head>\n    <base href="/">');
    html = html.replace('href="styles.css"', 'href="/newtab/styles.css"');
    html = html.replace(/<script src="([^"]+)"><\/script>/g, '<script src="/newtab/$1"></script>');
    html = html.replace(
        '<script src="/newtab/core/config.js"></script>',
        '<script src="/sandbox/chrome-stub.js"></script>\n    <script src="/newtab/core/config.js"></script>'
    );
    html = html.replace(
        '<script src="/newtab/app.js"></script>',
        '<script src="/newtab/app.js"></script>\n    <script src="/sandbox/capture.js"></script>'
    );
    return html;
}

function iconSvg(key) {
    const [label, color] = ICONS[key] || ['?', '#666666'];
    const size = label.length > 2 ? 18 : label.length > 1 ? 24 : 30;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
<rect width="64" height="64" rx="14" fill="${color}"/>
<text x="32" y="42" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="${size}" fill="#ffffff">${label}</text>
</svg>`;
}

function findBrowser() {
    const candidates = [
        process.env.CHROME_PATH,
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    ].filter(Boolean);
    const found = candidates.find((file) => fs.existsSync(file));
    if (!found) throw new Error('Chrome/Edge не найден. Укажите CHROME_PATH.');
    return found;
}

function pngSize(file) {
    const buffer = fs.readFileSync(file);
    if (buffer.slice(1, 4).toString() !== 'PNG') throw new Error(`${file}: не PNG`);
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForFile(file, timeout = 10000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
        if (fs.existsSync(file) && fs.statSync(file).size > 0) return;
        await sleep(50);
    }
    throw new Error(`Не дождались ${file}`);
}

function connectCdp(url) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(url);
        ws.addEventListener('open', () => resolve(ws), { once: true });
        ws.addEventListener('error', (event) => reject(new Error(`WebSocket: ${event.message || 'error'}`)), { once: true });
    });
}

/**
 * Снимает страницу через CDP: ждёт shotReady, затем Page.captureScreenshot.
 * Так снимок не зависит от --screenshot и --virtual-time-budget.
 */
async function cdpCapture(browser, url, file) {
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'tabvale-shot-'));
    const portFile = path.join(profile, 'DevToolsActivePort');
    const child = spawn(browser, [
        '--headless=new',
        '--disable-gpu',
        '--hide-scrollbars',
        '--force-device-scale-factor=1',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-extensions',
        '--disable-background-networking',
        '--no-proxy-server',
        '--remote-debugging-port=0',
        `--user-data-dir=${profile}`,
        'about:blank',
    ], { stdio: ['ignore', 'ignore', 'pipe'] });

    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    const exited = new Promise((resolve) => child.on('close', resolve));
    let ws = null;

    try {
        await waitForFile(portFile);
        const port = Number(fs.readFileSync(portFile, 'utf8').trim().split(/\r?\n/)[0]);
        const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
        const page = targets.find((target) => target.type === 'page');
        if (!page) throw new Error('CDP: page target not found');

        ws = await connectCdp(page.webSocketDebuggerUrl);
        let nextId = 1;
        const pending = new Map();
        ws.addEventListener('message', (event) => {
            const message = JSON.parse(event.data);
            const entry = pending.get(message.id);
            if (!entry) return;
            pending.delete(message.id);
            if (message.error) entry.reject(new Error(message.error.message));
            else entry.resolve(message.result);
        });
        const send = (method, params = {}) => new Promise((resolve, reject) => {
            const id = nextId++;
            pending.set(id, { resolve, reject });
            ws.send(JSON.stringify({ id, method, params }));
        });

        await send('Page.enable');
        await send('Runtime.enable');
        await send('Emulation.setDeviceMetricsOverride', {
            width: 1280, height: 800, deviceScaleFactor: 1, mobile: false,
        });
        await send('Page.navigate', { url });

        const started = Date.now();
        let ready = false;
        while (Date.now() - started < 12000) {
            const result = await send('Runtime.evaluate', {
                expression: 'document.body && document.body.dataset.shotReady === "1"',
                returnByValue: true,
            });
            if (result.result?.value === true) { ready = true; break; }
            await sleep(100);
        }
        if (!ready) {
            const info = await send('Runtime.evaluate', {
                expression: 'JSON.stringify({ title: document.title, lang: document.documentElement.lang, text: document.body?.innerText?.slice(0, 400) })',
                returnByValue: true,
            });
            throw new Error(`Страница не готова: ${info.result?.value || 'unknown'}`);
        }

        const capture = await send('Page.captureScreenshot', {
            format: 'png', fromSurface: true, captureBeyondViewport: false,
        });
        fs.writeFileSync(file, Buffer.from(capture.data, 'base64'));
        try { ws.send(JSON.stringify({ id: nextId++, method: 'Browser.close' })); } catch {}
    } finally {
        try { ws?.close(); } catch {}
        const killTimer = setTimeout(() => child.kill(), 3000);
        await exited;
        clearTimeout(killTimer);
        try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
    }

    if (child.exitCode && child.exitCode !== 0) {
        throw new Error(`Chrome exited with ${child.exitCode}\n${stderr.slice(-2000)}`);
    }
}

async function main() {
    if (process.argv.includes('--dump-html')) {
        console.log(sandboxHtml().split('\n').filter((line) => /base|link rel|script src/.test(line)).join('\n'));
        return;
    }
    const onlyArg = process.argv.find((arg) => arg.startsWith('--only='));
    const only = onlyArg ? onlyArg.slice('--only='.length) : null;
    const shots = only ? SHOTS.filter((s) => s.name === only) : SHOTS;
    if (!shots.length) throw new Error(`Нет сценария: ${only}`);

    fs.mkdirSync(OUT_DIR, { recursive: true });
    const browser = findBrowser();
    const html = sandboxHtml();

    const server = http.createServer((req, res) => {
        try {
            const url = new URL(req.url, 'http://localhost');
            let pathname = decodeURIComponent(url.pathname);

            if (pathname === '/sandbox/index.html') {
                res.writeHead(200, { 'Content-Type': MIME['.html'] });
                res.end(html);
                return;
            }
            if (pathname.startsWith('/sandbox/icons/') && pathname.endsWith('.svg')) {
                const key = pathname.slice('/sandbox/icons/'.length, -'.svg'.length);
                res.writeHead(200, { 'Content-Type': MIME['.svg'] });
                res.end(iconSvg(key));
                return;
            }
            const sandboxFile = {
                '/sandbox/chrome-stub.js': 'chrome-stub.js',
                '/sandbox/capture.js': 'capture.js',
            }[pathname];
            if (sandboxFile) {
                res.writeHead(200, { 'Content-Type': MIME['.js'] });
                res.end(fs.readFileSync(path.join(__dirname, sandboxFile)));
                return;
            }

            const file = path.resolve(ROOT, '.' + pathname);
            if (!file.startsWith(ROOT) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
                res.writeHead(404);
                res.end('not found');
                return;
            }
            res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
            fs.createReadStream(file).pipe(res);
        } catch (error) {
            res.writeHead(500);
            res.end(String(error));
        }
    });

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
        for (const shot of shots) {
            const file = path.join(OUT_DIR, `${shot.name}.png`);
            const url = `${baseUrl}/sandbox/index.html?shot=${encodeURIComponent(shot.shot)}&theme=${shot.theme}`;

            await cdpCapture(browser, url, file);

            const { width, height } = pngSize(file);
            if (width !== 1280 || height !== 800) {
                throw new Error(`${shot.name}: ожидалось 1280x800, получено ${width}x${height}`);
            }
            const size = fs.statSync(file).size;
            console.log(`${shot.name}: ${width}x${height}, ${Math.round(size / 1024)} KB`);
        }
    } finally {
        server.close();
    }
}

main().catch((error) => {
    console.error(error.message);
    process.exit(1);
});
