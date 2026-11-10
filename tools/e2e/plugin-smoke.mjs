import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXT = path.resolve(__dirname, '..', '..');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'tabvale-e2e-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const child = spawn(CHROME, [
  '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--disable-features=DisableLoadExtensionCommandLineSwitch',
  '--window-position=-32000,-32000', '--window-size=1280,900',
  `--user-data-dir=${profile}`,
  '--remote-debugging-port=0', 'about:blank',
], { stdio: 'ignore' });

const portFile = path.join(profile, 'DevToolsActivePort');
for (let i = 0; i < 100 && !fs.existsSync(portFile); i++) await sleep(100);
const portLines = fs.readFileSync(portFile, 'utf8').trim().split('\n');
const port = portLines[0].trim();
const browserWsPath = portLines[1]?.trim();

let loadedId = '';
let createdTargetId = '';
if (browserWsPath) {
  const browserWs = new WebSocket(`ws://127.0.0.1:${port}${browserWsPath}`);
  await new Promise((res, rej) => { browserWs.addEventListener('open', res, { once: true }); browserWs.addEventListener('error', rej, { once: true }); });
  const result = await new Promise((resolve) => {
    browserWs.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === 1) resolve(msg.result || msg.error || {});
    });
    browserWs.send(JSON.stringify({ id: 1, method: 'Extensions.loadUnpacked', params: { path: EXT } }));
  });
  loadedId = result.id || '';
  console.log('Extensions.loadUnpacked:', result.id || result.message || result);
  if (loadedId) {
    const created = await new Promise((resolve) => {
      browserWs.addEventListener('message', (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id === 2) resolve(msg.result || msg.error || {});
      });
      browserWs.send(JSON.stringify({
        id: 2,
        method: 'Target.createTarget',
        params: { url: `chrome-extension://${loadedId}/newtab/index.html` },
      }));
    });
    createdTargetId = created.targetId || '';
    console.log('Target.createTarget:', created);
  }
  browserWs.close();
  await new Promise((r) => setTimeout(r, 1500));
}

const targets = async () => (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json());
let list = await targets();
let extId = '';
for (let i = 0; i < 20 && !extId; i++) {
  for (const t of list) {
    const m = /^chrome-extension:\/\/([a-p]{32})\//.exec(t.url);
    if (m) { extId = m[1]; break; }
  }
  if (!extId) { await sleep(250); list = await targets(); }
}
const idFor = (value) => crypto.createHash('sha256').update(value).digest('hex')
  .slice(0, 32).split('').map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');

const targetIds = [...new Set(list.map((t) => /^chrome-extension:\/\/([a-p]{32})\//.exec(t.url)?.[1]).filter(Boolean))];
const candidates = [...new Set([
  loadedId,
  ...targetIds,
  ...[EXT, EXT.replaceAll('/', '\\'), EXT + '/', EXT.replaceAll('/', '\\') + '\\'].map(idFor),
].filter(Boolean))];
console.log('targets:', list.map((t) => `${t.type} ${t.url}`).slice(0, 8));
console.log('path ids:', candidates, '| target id:', extId);
console.log('extension candidates:', candidates);

list = await targets();
const page = list.find((t) => t.type === 'page' && loadedId && t.url.includes(loadedId)) || list.find((t) => t.type === 'page');
const pageWsUrl = createdTargetId
  ? `ws://127.0.0.1:${port}/devtools/page/${createdTargetId}`
  : page.webSocketDebuggerUrl;
console.log('page ws:', pageWsUrl);
const ws = new WebSocket(pageWsUrl);
await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });

let seq = 0;
const pending = new Map();
const errors = [];
const logs = [];
ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data);
  if (msg.method === 'Runtime.exceptionThrown') {
    errors.push(msg.params.exceptionDetails?.text || 'exception');
  }
  if (msg.method === 'Runtime.consoleAPICalled') {
    logs.push(msg.params.args.map((arg) => arg.value ?? arg.description ?? '').join(' '));
  }
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
  }
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++seq;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression, contextId) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, contextId });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
  return r.result.value;
};

await send('Page.enable');
await send('Runtime.enable');

let opened = loadedId;
if (!opened) {
  for (const candidate of candidates) {
    await send('Page.navigate', { url: `chrome-extension://${candidate}/newtab/index.html` });
    await sleep(1200);
    const probe = await evaluate(`({ href: location.href, hasChrome: !!globalThis.chrome?.runtime })`);
    console.log('probe', candidate, probe);
    if (probe.hasChrome) { opened = candidate; break; }
  }
}
if (!opened) {
  console.log('extension page did not load');
  ws.close();
  child.kill();
  process.exit(1);
}
extId = opened;
await sleep(2500);

const pageProbe = await evaluate(`({
  href: location.href,
  chromeType: typeof globalThis.chrome,
  runtimeType: typeof globalThis.chrome?.runtime,
  title: document.title
})`);
console.log('page probe:', pageProbe);

const diagnostics = await evaluate(`(async () => {
  const indexUrl = chrome.runtime.getURL('plugins/index.json');
  let fetchStatus = null, fetchText = '';
  try {
    const response = await fetch(indexUrl);
    fetchStatus = response.status;
    fetchText = (await response.text()).slice(0, 120);
  } catch (error) {
    fetchText = String(error);
  }
  let records = null;
  try { records = await dbGetAllPlugins(); } catch (error) { records = String(error); }
  return {
    indexUrl, fetchStatus, fetchText,
    records: Array.isArray(records) ? records.map((r) => r.id) : records,
    dockHtml: document.getElementById('plugin-dock')?.outerHTML?.slice(0, 160) || 'no dock',
  };
})()`);
console.log('diagnostics:', diagnostics);

const dock = await evaluate(`(() => {
  const buttons = [...document.querySelectorAll('.plugin-dock-button')];
  return { count: buttons.length, id: buttons[0]?.dataset.pluginId || '' };
})()`);
console.log('dock:', dock);

const strip = await evaluate(`(() => {
  const items = [...document.querySelectorAll('.plugin-strip-item')];
  return { count: items.length, id: items[0]?.dataset.pluginId || '' };
})()`);
console.log('strip:', strip);

let panel = null;
let sandboxText = '';
let stripText = '';
let panelText = '';
if (dock.count) {
  await evaluate(`document.querySelector('.plugin-dock-button').click()`);
  await sleep(1500);
  panel = await evaluate(`(() => {
    const panel = document.querySelector('.plugin-panel');
    const frame = document.querySelector('.plugin-panel-frame');
    return { open: !!panel, frame: !!frame, src: frame?.getAttribute('src') || '' };
  })()`);
  console.log('panel:', panel);

  const after = await targets();
  const sandboxTargets = after.filter((t) => t.url.includes('sandbox/plugin-host.html'));
  console.log('sandbox targets:', sandboxTargets.map((t) => ({ title: t.title || '' })));

  const frameTexts = [];
  for (const target of sandboxTargets) {
    try {
      const frameWs = new WebSocket(target.webSocketDebuggerUrl);
      await new Promise((res, rej) => { frameWs.addEventListener('open', res, { once: true }); frameWs.addEventListener('error', rej, { once: true }); });
      const frameResult = await new Promise((resolve) => {
        frameWs.addEventListener('message', (event) => {
          const msg = JSON.parse(event.data);
          if (msg.id === 1) resolve(msg.result);
        });
        frameWs.send(JSON.stringify({
          id: 1,
          method: 'Runtime.evaluate',
          params: { expression: 'document.body.innerText', returnByValue: true },
        }));
      });
      frameTexts.push({ title: target.title || '', text: String(frameResult?.result?.value || '') });
      frameWs.close();
    } catch (error) {
      console.log('sandbox read failed:', error.message);
    }
  }

  console.log('sandbox frames:', frameTexts.map((item) => ({ title: item.title, text: item.text.slice(0, 40) })));
  const stripEntry = frameTexts.find((item) => /\(strip\)/.test(item.title)) || frameTexts[0];
  const panelEntry = frameTexts.find((item) => /\(panel\)/.test(item.title))
    || frameTexts.find((item) => item !== stripEntry);
  stripText = stripEntry?.text || '';
  panelText = panelEntry?.text || '';
  sandboxText = stripText || panelText;
}

console.log('logs:', logs.slice(-8));
console.log('exceptions:', errors.slice(0, 5));
ws.close();
child.kill();

const timePattern = /^\d{1,2}:\d{2}/;
const passed = dock.count > 0
    && strip.count > 0
    && panel?.open === true
    && timePattern.test(stripText.trim())
    && timePattern.test(panelText.trim())
    && errors.length === 0;
console.log(passed ? 'SMOKE PASS' : 'SMOKE FAIL');
process.exit(passed ? 0 : 1);
