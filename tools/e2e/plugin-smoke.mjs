import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXT = path.resolve(__dirname, '..', '..');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'tabvale-e2e-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Минимальный zip для проверки установки пакета .tvp.
function zipBuffer(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name, 'utf8');
    const data = Buffer.from(file.data, 'utf8');
    const payload = zlib.deflateRawSync(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(name.length, 26);
    localParts.push(local, name, payload);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(payload.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += 30 + name.length + payload.length;
  }
  const centralBuffer = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, centralBuffer, end]);
}

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

// Выполняет выражение в том sandbox-кадре, чей document.title подходит
// под шаблон. Нужен для проверки кнопок внутри панели плагина.
async function frameEval(titlePattern, expression) {
  const list = await targets();
  for (const target of list.filter((item) => item.url.includes('sandbox/plugin-host.html'))) {
    const frameWs = new WebSocket(target.webSocketDebuggerUrl);
    try {
      await new Promise((res, rej) => {
        frameWs.addEventListener('open', res, { once: true });
        frameWs.addEventListener('error', rej, { once: true });
      });
      const evaluateInFrame = (id, expr) => new Promise((resolve) => {
        const onMessage = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.id === id) { frameWs.removeEventListener('message', onMessage); resolve(msg.result); }
        };
        frameWs.addEventListener('message', onMessage);
        frameWs.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true, awaitPromise: true } }));
      });
      const title = await evaluateInFrame(1, 'document.title');
      if (!titlePattern.test(String(title?.result?.value || ''))) continue;
      const value = await evaluateInFrame(2, expression);
      return value?.result?.value;
    } catch {
      // кадр мог закрыться между списком целей и подключением
    } finally {
      frameWs.close();
    }
  }
  return undefined;
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

// Иконки: у каждого встроенного плагина картинка в доке и менеджере.
const icons = await evaluate(`(() => {
  const buttons = [...document.querySelectorAll('.plugin-dock-button')];
  const rows = [...document.querySelectorAll('.plugin-manager-item')];
  return {
    dock: buttons.length,
    dockWithImage: buttons.filter((button) => !!button.querySelector('img')).length,
    rows: rows.length,
    rowsWithImage: rows.filter((row) => !!row.querySelector('img.plugin-manager-icon')).length,
  };
})()`);
console.log('plugin icons:', icons);

// Иконки закладок: байты должны прийти из favicon-кэша браузера и осесть
// в IndexedDB, чтобы пережить оффлайн и недоступность сайта.
await sleep(1200);
const bookmarkIcons = await evaluate(`(async () => {
  const tiles = [...document.querySelectorAll('.bookmark img')];
  const db = await new Promise((resolve) => {
    const request = indexedDB.open('tabvale-icons', 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
  let records = [];
  if (db && db.objectStoreNames.contains('icons')) {
    records = await new Promise((resolve) => {
      const all = db.transaction('icons', 'readonly').objectStore('icons').getAll();
      all.onsuccess = () => resolve(all.result || []);
      all.onerror = () => resolve([]);
    });
  }
  return {
    tiles: tiles.length,
    dataTiles: tiles.filter((img) => String(img.getAttribute('src') || '').startsWith('data:')).length,
    cached: records.length,
    cachedBytes: records.filter((record) => String(record.dataUrl || '').startsWith('data:')).length,
  };
})()`);
console.log('bookmark icons:', bookmarkIcons);

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
let layoutModes = false;
if (dock.count) {
  await evaluate(`document.querySelector('.plugin-dock-button[data-plugin-id="com.tabvale.layout"]').click()`);
  await sleep(1500);
  panel = await evaluate(`(() => {
    const panel = document.querySelector('.plugin-panel');
    const frame = document.querySelector('.plugin-panel-frame');
    const root = getComputedStyle(document.documentElement);
    return {
      open: !!panel,
      headingIcon: !!panel?.querySelector('.plugin-panel-heading img'),
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
  // Плагин раскладки: два поля и три режима, как на allcalc.
  layoutModes = ['На русский', 'На латиницу', 'Смешанный'].every((label) => panelText.includes(label));

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

const tvpPackage = path.join(os.tmpdir(), 'tabvale-test-plugin.tvp');
fs.writeFileSync(tvpPackage, zipBuffer([
  {
    name: 'manifest.json',
    data: JSON.stringify({
      schema: 1,
      id: 'com.test.zipped',
      name: 'Zipped test',
      version: '1.0.0',
      apiVersion: 1,
      entry: 'plugin.js',
      icon: 'icon.svg',
      permissions: { network: [], capabilities: [], storageKB: 16 },
      surfaces: {
        panel: { sides: ['right'], width: [280, 360], height: [200, 300], mode: ['overlay'] },
      },
    }),
  },
  { name: 'plugin.js', data: 'function mount(api) { document.body.textContent = "Zipped plugin"; api.ui.ready(); }' },
  { name: 'icon.svg', data: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><circle cx="4" cy="4" r="3" fill="#4DB6E2"/></svg>' },
]));
await send('DOM.setFileInputFiles', { files: [tvpPackage], nodeId: fileInput.nodeId });
await sleep(1200);
const tvpInstalled = await evaluate(`({
  dock: document.querySelectorAll('.plugin-dock-button').length,
  rows: document.querySelectorAll('.plugin-manager-item').length,
})`);
console.log('installed from tvp:', tvpInstalled);
const tvpIcon = await evaluate(`(() => {
  const image = document.querySelector('.plugin-manager-item[data-plugin-id="com.test.zipped"] img.plugin-manager-icon');
  return image ? image.getAttribute('src') || '' : '';
})()`);
console.log('tvp icon source:', String(tvpIcon).slice(0, 30));
// Код из архива должен не просто записаться, а исполниться в песочнице.
await evaluate(`document.querySelector('.plugin-dock-button[data-plugin-id="com.test.zipped"]')?.click()`);
await sleep(1000);
// document.title кадра — это id плагина и поверхность, а не имя из манифеста.
const tvpFrameText = await frameEval(/com\.test\.zipped \(panel\)/, 'document.body.textContent');
console.log('tvp plugin frame:', tvpFrameText);
await evaluate(`document.querySelector('.plugin-panel-close')?.click()`);
await sleep(300);
await evaluate(`document.querySelector('.plugin-manager-item[data-plugin-id="com.test.zipped"] .plugin-manager-remove')?.click()`);
await sleep(500);
const tvpCleaned = await evaluate(`({ dock: document.querySelectorAll('.plugin-dock-button').length })`);
console.log('tvp removed:', tvpCleaned);
fs.unlinkSync(tvpPackage);

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

// Плавающее окно: появляется, перетаскивается, закрывается и возвращается из дока.
await evaluate(`(async () => {
  const select = document.querySelector('.plugin-manager-item[data-plugin-id="com.tabvale.clock"] .plugin-manager-surface');
  select.value = 'floating';
  select.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 800));
})()`);
// Настройки закрываем: их подложка перекрывает окно и перехватила бы мышь.
await evaluate(`(() => {
  document.getElementById('settings-modal')?.classList.add('hidden');
  document.getElementById('overlay')?.classList.add('hidden');
})()`);
await sleep(200);
const floatingStart = await evaluate(`(() => {
  const root = document.querySelector('.plugin-floating[data-plugin-id="com.tabvale.clock"]');
  if (!root) return null;
  const rect = root.getBoundingClientRect();
  return {
    x: rect.left,
    y: rect.top,
    w: rect.width,
    h: rect.height,
    hidden: root.hidden,
    headerIcon: !!root.querySelector('.plugin-floating-header img'),
  };
})()`);
const floatingText = await frameEval(/com\.tabvale\.clock \(floating\)/, 'document.body.textContent');
// Тянем настоящим вводом: CDP порождает pointer-события, как мышь.
const floatingHandle = await evaluate(`(() => {
  const root = document.querySelector('.plugin-floating[data-plugin-id="com.tabvale.clock"]');
  if (!root) return null;
  const rect = root.getBoundingClientRect();
  return { x: rect.left + 40, y: rect.top + 12 };
})()`);
if (floatingHandle) {
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: floatingHandle.x, y: floatingHandle.y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: floatingHandle.x - 150, y: floatingHandle.y + 60, button: 'left', buttons: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: floatingHandle.x - 150, y: floatingHandle.y + 60, button: 'left', clickCount: 1 });
  await sleep(200);
}
const floatingMoved = await evaluate(`(() => {
  const root = document.querySelector('.plugin-floating[data-plugin-id="com.tabvale.clock"]');
  if (!root) return null;
  const moved = root.getBoundingClientRect();
  return { left: moved.left, top: moved.top };
})()`);
await sleep(200);
const floatingSaved = await evaluate(`(async () => {
  const data = await new Promise((resolve) => chrome.storage.local.get('pluginPlacements', resolve));
  return (data.pluginPlacements || []).find((item) => item.pluginId === 'com.tabvale.clock') || null;
})()`);
await evaluate(`document.querySelector('.plugin-floating[data-plugin-id="com.tabvale.clock"] .plugin-floating-close')?.click()`);
await sleep(250);
const floatingHidden = await evaluate(`document.querySelector('.plugin-floating[data-plugin-id="com.tabvale.clock"]')?.hidden === true`);
await evaluate(`document.querySelector('.plugin-dock-button[data-plugin-id="com.tabvale.clock"]')?.click()`);
await sleep(250);
const floatingRestored = await evaluate(`document.querySelector('.plugin-floating[data-plugin-id="com.tabvale.clock"]')?.hidden === false`);
// Уменьшаем окно: плавающее окно должно остаться в видимой области.
await send('Emulation.setDeviceMetricsOverride', { width: 600, height: 500, deviceScaleFactor: 1, mobile: false });
await sleep(400);
const floatingClamped = await evaluate(`(() => {
  const root = document.querySelector('.plugin-floating[data-plugin-id="com.tabvale.clock"]');
  if (!root) return null;
  const rect = root.getBoundingClientRect();
  return {
    fitsX: rect.right <= window.innerWidth + 1,
    fitsY: rect.bottom <= window.innerHeight + 1,
    viewport: [window.innerWidth, window.innerHeight],
    rect: [Math.round(rect.left), Math.round(rect.top), Math.round(rect.width), Math.round(rect.height)],
  };
})()`);
await send('Emulation.clearDeviceMetricsOverride');
await sleep(300);
console.log('floating after resize:', floatingClamped);
const floatingWorks = !!floatingStart
    && floatingStart.hidden === false
    && /^\d{1,2}:\d{2}/.test(String(floatingText || '').trim())
    && floatingStart.w > 0 && floatingStart.h > 0
    && !!floatingMoved && Math.abs(floatingMoved.left - floatingStart.x) > 50
    && floatingSaved?.surface === 'floating' && Number.isFinite(floatingSaved?.x)
    && floatingHidden && floatingRestored
    && !!floatingClamped && floatingClamped.fitsX && floatingClamped.fitsY;
console.log('floating window:', { floatingStart, floatingMoved, saved: floatingSaved && { surface: floatingSaved.surface, x: floatingSaved.x, y: floatingSaved.y }, floatingHidden, floatingRestored, works: floatingWorks });

// Панель импортёра без доступа ведёт прямо к менеджеру: кнопка внутри
// кадра открывает настройки на вкладке плагинов и подсвечивает строку.
await evaluate(`(() => {
  document.querySelector('.settings-tab[data-tab="bookmarks"]')?.click();
  document.getElementById('settings-modal')?.classList.add('hidden');
  document.getElementById('overlay')?.classList.add('hidden');
  document.querySelector('.plugin-dock-button[data-plugin-id="com.tabvale.bookmarks"]')?.click();
})()`);
await sleep(1200);
const grantButtonClicked = await frameEval(/\(panel\)/, `(() => {
  const button = [...document.querySelectorAll('button')]
    .find((item) => /Разрешить доступ|Allow access/.test(item.textContent));
  if (!button) return false;
  button.click();
  return true;
})()`);
await sleep(600);
const panelToManager = await evaluate(`(() => ({
  open: !document.getElementById('settings-modal')?.classList.contains('hidden'),
  pane: document.querySelector('.settings-pane[data-pane="plugins"]')?.classList.contains('active') || false,
  highlighted: !!document.querySelector('.plugin-manager-item[data-plugin-id="com.tabvale.bookmarks"].plugin-manager-highlight'),
}))()`);
panelToManager.clicked = grantButtonClicked === true;
console.log('panel to manager:', panelToManager);
await evaluate(`document.querySelector('.plugin-panel-close')?.click()`);
await sleep(300);

await evaluate(`(() => {
  window.__alerts = [];
  window.alert = (message) => { window.__alerts.push(String(message)); };
})()`);
const grantRect = await evaluate(`(() => {
  const button = document.querySelector('.plugin-manager-item[data-plugin-id="com.tabvale.bookmarks"] .plugin-manager-grant');
  if (!button) return null;
  window.__grantEvents = [];
  window.__permLog = [];
  for (const type of ['pointerdown', 'mousedown', 'click']) {
    button.addEventListener(type, () => window.__grantEvents.push(type));
  }
  const nativeRequest = chrome.permissions.request.bind(chrome.permissions);
  chrome.permissions.request = (perms, callback) => {
    window.__permLog.push({ called: perms });
    try {
      return nativeRequest(perms, (granted) => {
        window.__permLog.push({ callback: granted, error: chrome.runtime?.lastError?.message || '' });
        callback?.(granted);
      });
    } catch (error) {
      window.__permLog.push({ threw: String(error?.message || error) });
      throw error;
    }
  };
  button.scrollIntoView({ block: 'center' });
  const rect = button.getBoundingClientRect();
  const x = rect.x + rect.width / 2;
  const y = rect.y + rect.height / 2;
  const hit = document.elementFromPoint(x, y);
  return {
    x, y,
    rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
    hitIsButton: hit === button,
    hitTag: hit ? (hit.className || hit.tagName) : 'none',
  };
})()`);
console.log('grant button:', grantRect);
if (grantRect && process.env.SMOKE_VISIBLE === '1') {
  try {
    await send('Browser.setWindowBounds', {
      windowId: (await send('Browser.getWindowForTarget')).windowId,
      bounds: { left: 80, top: 80, width: 1280, height: 900, windowState: 'normal' },
    });
    await send('Page.bringToFront');
    await sleep(700);
    Object.assign(grantRect, await evaluate(`(() => {
      const button = document.querySelector('.plugin-manager-item[data-plugin-id="com.tabvale.bookmarks"] .plugin-manager-grant');
      if (!button) return {};
      button.scrollIntoView({ block: 'center' });
      const rect = button.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    })()`));
    console.log('grant button after move:', grantRect);
  } catch (error) {
    console.log('visible window failed:', error.message);
  }
}
if (grantRect) {
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: grantRect.x, y: grantRect.y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: grantRect.x, y: grantRect.y, button: 'left', clickCount: 1 });
  await sleep(2000);
}
const grantResult = await evaluate(`(async () => {
  const button = document.querySelector('.plugin-manager-item[data-plugin-id="com.tabvale.bookmarks"] .plugin-manager-grant');
  if (!button) return { found: false };
  const contains = await new Promise((resolve) => chrome.permissions.contains({ permissions: ['bookmarks'] }, resolve));
  return {
    found: true,
    label: button.textContent,
    disabled: button.disabled,
    contains,
    alerts: window.__alerts,
    events: window.__grantEvents,
    permLog: window.__permLog,
  };
})()`);
console.log('grant result:', grantResult);
// Кнопка доступа должна реально вызвать chrome.permissions.request —
// это единственное, что можно проверить без ответа человека в диалоге.
const grantRequested = Array.isArray(grantResult.permLog)
  && grantResult.permLog.some((entry) => entry.called?.permissions?.includes('bookmarks'))
  && (grantResult.events || []).includes('click');
console.log('grant requested:', grantRequested);
console.log('browser ui after grant:', (await targets())
  .filter((item) => item.type === 'browser_ui')
  .map((item) => item.url));

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

// Оффлайн: после перезагрузки без сети иконки должны остаться из кэша.
await send('Network.enable');
await send('Network.emulateNetworkConditions', {
  offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0,
});
await send('Page.reload');
await sleep(2500);
const offlineIcons = await evaluate(`(() => {
  const tiles = [...document.querySelectorAll('.bookmark img')];
  return {
    tiles: tiles.length,
    dataTiles: tiles.filter((img) => String(img.getAttribute('src') || '').startsWith('data:')).length,
  };
})()`);
console.log('offline bookmark icons:', offlineIcons);
await send('Network.emulateNetworkConditions', {
  offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1,
});

console.log('logs:', logs.slice(-8));
console.log('exceptions:', errors.slice(0, 5));
ws.close();
child.kill();

const timePattern = /^\d{1,2}:\d{2}/;
const passed = dock.count > 0
    && strip.count > 0
    && panel?.open === true && panel.headingIcon === true
    && layoutModes
    && icons.dock > 0 && icons.dock === icons.dockWithImage
    && icons.rows > 0 && icons.rows === icons.rowsWithImage
    && floatingStart?.headerIcon === true
    && bookmarkIcons.tiles > 0 && bookmarkIcons.dataTiles === bookmarkIcons.tiles
    && bookmarkIcons.cached >= bookmarkIcons.tiles
    && offlineIcons.tiles === bookmarkIcons.tiles && offlineIcons.dataTiles === offlineIcons.tiles
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
    && tvpInstalled.dock === baselineDock + 1 && tvpInstalled.rows === baselineRows + 1
    && String(tvpIcon).startsWith('data:image/svg+xml;base64,')
    && /Zipped plugin/.test(tvpFrameText || '')
    && tvpCleaned.dock === baselineDock
    && off.dock === baselineDock && off.strip === baselineStrip - 1
    && panelOnly.dock === baselineDock + 1 && panelOnly.strip === baselineStrip - 1
    && darkSandboxBg === 'rgb(36, 48, 60)'
    && lightSandboxBg === 'rgb(242, 245, 248)'
    && localizedManagerName === 'Часы'
    && pomodoroFits
    && appLauncherFits
    && tileWorks
    && floatingWorks
    && panelToManager.clicked && panelToManager.open && panelToManager.pane && panelToManager.highlighted
    && grantRequested
    && errors.length === 0;
console.log(passed ? 'SMOKE PASS' : 'SMOKE FAIL');
process.exit(passed ? 0 : 1);
