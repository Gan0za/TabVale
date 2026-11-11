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
    errors.push(msg.params.exceptionDetails?.exception?.description
      || msg.params.exceptionDetails?.text || 'exception');
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

async function readSandboxFrames() {
  const list = await targets();
  const frames = [];
  for (const target of list.filter((item) => item.url.includes('sandbox/plugin-host.html'))) {
    try {
      const frameWs = new WebSocket(target.webSocketDebuggerUrl);
      await new Promise((res, rej) => {
        frameWs.addEventListener('open', res, { once: true });
        frameWs.addEventListener('error', rej, { once: true });
      });
      const result = await new Promise((resolve) => {
        frameWs.addEventListener('message', (event) => {
          const msg = JSON.parse(event.data);
          if (msg.id === 1) resolve(msg.result);
        });
        frameWs.send(JSON.stringify({
          id: 1,
          method: 'Runtime.evaluate',
          params: {
            expression: `JSON.stringify({
              docTitle: document.title,
              text: document.body.innerText,
              scrollH: document.documentElement.scrollHeight,
              clientH: document.documentElement.clientHeight,
            })`,
            returnByValue: true,
          },
        }));
      });
      frames.push(JSON.parse(String(result?.result?.value || '{}')));
      frameWs.close();
    } catch {
      // кадр мог закрыться между списком целей и подключением
    }
  }
  return frames;
}

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
let darkSandboxBg = '';
let lightSandboxBg = '';
let localizedManagerName = '';
let pomodoroFits = false;
let appLauncherFits = false;
let tileWorks = false;
if (dock.count) {
  await evaluate(`document.querySelector('.plugin-dock-button[data-plugin-id="com.tabvale.layout"]').click()`);
  await sleep(1500);
  panel = await evaluate(`(() => {
    const panel = document.querySelector('.plugin-panel');
    const frame = document.querySelector('.plugin-panel-frame');
    const root = getComputedStyle(document.documentElement);
    return {
      open: !!panel,
      frame: !!frame,
      src: frame?.getAttribute('src') || '',
      panelBg: panel ? getComputedStyle(panel).backgroundColor : '',
      rootText: root.getPropertyValue('--text').trim(),
      rootGlass: root.getPropertyValue('--glass-strong').trim(),
      theme: document.documentElement.dataset.theme || '',
    };
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
          params: {
            expression: `JSON.stringify({
              docTitle: document.title,
              text: document.body.innerText,
              color: getComputedStyle(document.body).color,
              bg: getComputedStyle(document.body).backgroundColor,
              textVar: getComputedStyle(document.documentElement).getPropertyValue('--tabvale-text').trim(),
              bgVar: getComputedStyle(document.documentElement).getPropertyValue('--tabvale-bg').trim(),
              scrollH: document.documentElement.scrollHeight,
              clientH: document.documentElement.clientHeight,
            })`,
            returnByValue: true,
          },
        }));
      });
      const info = JSON.parse(String(frameResult?.result?.value || '{}'));
      frameTexts.push({ title: info.docTitle || target.title || '', ...info, text: String(info.text || '') });
      frameWs.close();
    } catch (error) {
      console.log('sandbox read failed:', error.message);
    }
  }

  console.log('sandbox frames:', frameTexts.map((item) => ({
    title: item.title, text: item.text.slice(0, 40), color: item.color, bg: item.bg,
    textVar: item.textVar, bgVar: item.bgVar, scrollH: item.scrollH, clientH: item.clientH,
  })));
  const stripEntry = frameTexts.find((item) => /com\.tabvale\.clock \(strip\)/.test(item.title))
    || frameTexts.find((item) => /\(strip\)/.test(item.title))
    || frameTexts[0];
  const panelEntry = frameTexts.find((item) => /com\.tabvale\.layout \(panel\)/.test(item.title))
    || frameTexts.find((item) => /\(panel\)/.test(item.title))
    || frameTexts.find((item) => item !== stripEntry);
  stripText = stripEntry?.text || '';
  panelText = panelEntry?.text || '';
  sandboxText = stripText || panelText;

  const pomodoroEntry = frameTexts.find((item) => /com\.tabvale\.pomodoro \(strip\)/.test(item.title));
  pomodoroFits = !!pomodoroEntry && pomodoroEntry.scrollH <= pomodoroEntry.clientH + 1;

  const themeTarget = sandboxTargets[0];
  const readSandboxBackground = async () => {
    const frameWs = new WebSocket(themeTarget.webSocketDebuggerUrl);
    await new Promise((res, rej) => { frameWs.addEventListener('open', res, { once: true }); frameWs.addEventListener('error', rej, { once: true }); });
    const result = await new Promise((resolve) => {
      frameWs.addEventListener('message', (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id === 1) resolve(msg.result);
      });
      frameWs.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: { expression: 'getComputedStyle(document.body).backgroundColor', returnByValue: true },
      }));
    });
    frameWs.close();
    return String(result?.result?.value || '');
  };

  darkSandboxBg = await readSandboxBackground();
  await evaluate(`document.documentElement.dataset.theme = 'light'`);
  await sleep(600);
  lightSandboxBg = await readSandboxBackground();
  await evaluate(`document.documentElement.dataset.theme = 'dark'`);
  await sleep(300);
  console.log('theme broadcast:', { darkSandboxBg, lightSandboxBg });
}

const manager = await evaluate(`(() => {
  document.getElementById('settings-button')?.click();
  const tab = [...document.querySelectorAll('.settings-tab')].find((item) => item.dataset.tab === 'plugins');
  tab?.click();
  return { rows: document.querySelectorAll('.plugin-manager-item').length };
})()`);
console.log('manager:', manager);
const baselineDock = dock.count;
const baselineStrip = strip.count;
const baselineRows = manager.rows;

localizedManagerName = await evaluate(`(async () => {
  const previous = document.documentElement.lang;
  document.documentElement.lang = 'ru';
  await new Promise((resolve) => setTimeout(resolve, 300));
  const name = document.querySelector('.plugin-manager-item[data-plugin-id="com.tabvale.clock"] .plugin-manager-name')?.textContent || '';
  document.documentElement.lang = previous;
  return name;
})()`);
console.log('localized manager name:', localizedManagerName);

const openByManager = await evaluate(`(async () => {
  document.querySelector('.plugin-manager-item[data-plugin-id="com.tabvale.clock"] .plugin-manager-open')?.click();
  await new Promise((resolve) => setTimeout(resolve, 800));
  return {
    panel: !!document.querySelector('.plugin-panel'),
    dock: document.querySelectorAll('.plugin-dock-button').length,
    strip: document.querySelectorAll('.plugin-strip-item').length,
  };
})()`);
console.log('open by manager:', openByManager);
await evaluate(`document.querySelector('.plugin-panel-close')?.click()`);
await sleep(300);

const backToStrip = await evaluate(`(async () => {
  const select = document.querySelector('.plugin-manager-item[data-plugin-id="com.tabvale.clock"] .plugin-manager-surface');
  select.value = 'strip:top';
  select.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 500));
  return {
    panel: !!document.querySelector('.plugin-panel'),
    dock: document.querySelectorAll('.plugin-dock-button').length,
    strip: document.querySelectorAll('.plugin-strip-item').length,
  };
})()`);
console.log('back to strip:', backToStrip);

const zone = await evaluate(`(async () => {
  const select = document.querySelector('.plugin-manager-item[data-plugin-id="com.tabvale.clock"] .plugin-manager-surface');
  if (!select) return { top: 0, bottom: 0 };
  select.value = 'strip:bottom';
  select.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 500));
  return {
    top: document.querySelectorAll('#plugin-strip-top .plugin-strip-item[data-plugin-id="com.tabvale.clock"]').length,
    bottom: document.querySelectorAll('#plugin-strip-bottom .plugin-strip-item[data-plugin-id="com.tabvale.clock"]').length,
  };
})()`);
console.log('zone:', zone);

const removal = await evaluate(`(async () => {
  window.confirm = () => true;
  document.querySelector('.plugin-manager-item[data-plugin-id="com.tabvale.clock"] .plugin-manager-remove')?.click();
  await new Promise((resolve) => setTimeout(resolve, 600));
  return {
    rows: document.querySelectorAll('.plugin-manager-item').length,
    dock: document.querySelectorAll('.plugin-dock-button').length,
  };
})()`);
console.log('removal:', removal);

await send('Page.reload');
await sleep(2500);
const afterReload = await evaluate(`({
  dock: document.querySelectorAll('.plugin-dock-button').length,
  strip: document.querySelectorAll('.plugin-strip-item').length,
})`);
console.log('after reload:', afterReload);

const restored = await evaluate(`(async () => {
  document.getElementById('settings-button')?.click();
  const tab = [...document.querySelectorAll('.settings-tab')].find((item) => item.dataset.tab === 'plugins');
  tab?.click();
  document.querySelector('.plugin-manager-restore')?.click();
  await new Promise((resolve) => setTimeout(resolve, 900));
  return { dock: document.querySelectorAll('.plugin-dock-button').length };
})()`);
console.log('restored:', restored);

const testPackage = path.join(os.tmpdir(), 'tabvale-test-plugin.json');
fs.writeFileSync(testPackage, JSON.stringify({
  manifest: {
    schema: 1,
    id: 'com.test.hello',
    name: 'Hello test',
    version: '1.0.0',
    apiVersion: 1,
    entry: 'plugin.js',
    permissions: { network: [], capabilities: [], storageKB: 16 },
    surfaces: {
      panel: { sides: ['right'], width: [280, 360], height: [200, 300], mode: ['overlay'] },
    },
  },
  code: 'function mount(api) { document.body.textContent = "Hello plugin"; api.ui.ready(); }',
}));

await send('DOM.enable');
await evaluate('window.confirm = () => true');
const documentNode = await send('DOM.getDocument');
const fileInput = await send('DOM.querySelector', {
  nodeId: documentNode.root.nodeId,
  selector: '#plugin-package-file',
});
await send('DOM.setFileInputFiles', { files: [testPackage], nodeId: fileInput.nodeId });
await sleep(1200);
const installed = await evaluate(`({
  dock: document.querySelectorAll('.plugin-dock-button').length,
  rows: document.querySelectorAll('.plugin-manager-item').length,
})`);
console.log('installed from file:', installed);

await evaluate(`document.querySelector('.plugin-manager-item[data-plugin-id="com.test.hello"] .plugin-manager-remove')?.click()`);
await sleep(500);
const cleaned = await evaluate(`({ dock: document.querySelectorAll('.plugin-dock-button').length })`);
console.log('imported plugin removed:', cleaned);
fs.unlinkSync(testPackage);

const off = await evaluate(`(async () => {
  const select = document.querySelector('.plugin-manager-item[data-plugin-id="com.tabvale.clock"] .plugin-manager-surface');
  select.value = 'off';
  select.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 400));
  return {
    dock: document.querySelectorAll('.plugin-dock-button').length,
    strip: document.querySelectorAll('.plugin-strip-item').length,
  };
})()`);
console.log('placement off:', off);

const panelOnly = await evaluate(`(async () => {
  const select = document.querySelector('.plugin-manager-item[data-plugin-id="com.tabvale.clock"] .plugin-manager-surface');
  select.value = 'panel';
  select.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 400));
  return {
    dock: document.querySelectorAll('.plugin-dock-button').length,
    strip: document.querySelectorAll('.plugin-strip-item').length,
  };
})()`);
console.log('placement panel:', panelOnly);

await evaluate(`(async () => {
  const select = document.querySelector('.plugin-manager-item[data-plugin-id="com.tabvale.apps"] .plugin-manager-surface');
  select.value = 'strip:bottom';
  select.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 700));
})()`);
const launcherFrames = await readSandboxFrames();
const launcherFrame = launcherFrames.find((item) => /com\.tabvale\.apps \(strip\)/.test(item.docTitle));
appLauncherFits = !!launcherFrame
    && /Obsidian/.test(launcherFrame.text)
    && /VS Code/.test(launcherFrame.text)
    && launcherFrame.scrollH <= launcherFrame.clientH + 1;
console.log('app launcher strip:', launcherFrame, 'fits:', appLauncherFits);

await evaluate(`(async () => {
  const select = document.querySelector('.plugin-manager-item[data-plugin-id="com.tabvale.clock"] .plugin-manager-surface');
  select.value = 'tiles';
  select.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 600));
})()`);
const tileCount = await evaluate(`document.querySelectorAll('.plugin-tile[data-plugin-id="com.tabvale.clock"]').length`);
await evaluate(`document.querySelector('.plugin-tile[data-plugin-id="com.tabvale.clock"]')?.click()`);
await sleep(800);
const tilePanel = await evaluate(`!!document.querySelector('.plugin-panel')`);
tileWorks = tileCount === 1 && tilePanel;
console.log('plugin tile:', { tileCount, tilePanel });
await evaluate(`document.querySelector('.plugin-panel-close')?.click()`);
await sleep(300);

const networkProbe = await evaluate(`(async () => {
  const urls = [
    'https://api.open-meteo.com/v1/forecast?latitude=55.7558&longitude=37.6173&current=temperature_2m',
    'https://api.github.com/repos/Gan0za/TabVale',
    'https://habr.com/ru/rss/news/',
  ];
  const result = {};
  for (const url of urls) {
    try {
      const response = await fetch(url);
      result[new URL(url).host] = response.status;
    } catch (error) {
      result[new URL(url).host] = String(error);
    }
  }
  return result;
})()`);
console.log('network probe:', networkProbe);

console.log('logs:', logs.slice(-8));
console.log('exceptions:', errors.slice(0, 5));
ws.close();
child.kill();

const timePattern = /^\d{1,2}:\d{2}/;
const passed = dock.count > 0
    && strip.count > 0
    && panel?.open === true
    && timePattern.test(stripText.trim())
    && panelText.trim().length > 0
    && manager.rows > 0
    && openByManager.panel === true
    && openByManager.dock === baselineDock + 1 && openByManager.strip === baselineStrip - 1
    && backToStrip.panel === false
    && backToStrip.dock === baselineDock && backToStrip.strip === baselineStrip
    && zone.bottom === 1 && zone.top === 0
    && removal.rows === baselineRows - 1 && removal.dock === baselineDock
    && afterReload.dock === baselineDock && afterReload.strip === baselineStrip - 1
    && restored.dock === baselineDock
    && installed.dock === baselineDock + 1 && installed.rows === baselineRows + 1
    && cleaned.dock === baselineDock
    && off.dock === baselineDock && off.strip === baselineStrip - 1
    && panelOnly.dock === baselineDock + 1 && panelOnly.strip === baselineStrip - 1
    && darkSandboxBg === 'rgb(36, 48, 60)'
    && lightSandboxBg === 'rgb(242, 245, 248)'
    && localizedManagerName === 'Часы'
    && pomodoroFits
    && appLauncherFits
    && tileWorks
    && errors.length === 0;
console.log(passed ? 'SMOKE PASS' : 'SMOKE FAIL');
process.exit(passed ? 0 : 1);
