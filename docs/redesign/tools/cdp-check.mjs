// Headless browser check used for the redesign review gates (R1–R3, T16). No dependencies: Node 22+ (global
// WebSocket and fetch) plus Playwright's cached chrome-headless-shell, driven over the Chrome DevTools Protocol.
//
// 1. Start the app or prototype server, and the browser, as background tasks (not with `&` inside one command):
//      npm run build && npm start                     # real app on http://localhost:3000
//      ~/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell \
//        --headless --remote-debugging-port=9333 --no-sandbox --disable-gpu about:blank
// 2. Run:
//      node docs/redesign/tools/cdp-check.mjs <url> <width>x<height> <reduce|full> <outDir> [stop ...]
//    A stop is a pixel offset (1200), a percent of the page height (50%) or a CSS selector (#work).
//    Example: node docs/redesign/tools/cdp-check.mjs http://localhost:3000/ 1280x600 full /tmp/shots 0 #work #night
// 3. It prints the viewport mode and overflow, then for each stop: the scroll position, the root --home-bg, whether
//    Lenis is active, and a JPEG path. At the end it prints any page exceptions and console errors.
// 4. Stop the background tasks afterwards (TaskStop in Claude Code).
import { writeFileSync, mkdirSync } from 'node:fs';

const [url, size, motion, outDir, ...stops] = process.argv.slice(2);
if (!url || !size || !motion || !outDir) {
  console.error('usage: node cdp-check.mjs <url> <W>x<H> <reduce|full> <outDir> [stop ...]');
  process.exit(2);
}
const [W, H] = size.split('x').map(Number);
mkdirSync(outDir, { recursive: true });

const targets = await (await fetch('http://127.0.0.1:9333/json/list')).json();
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const problems = [];
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); return; }
  if (d.method === 'Runtime.exceptionThrown') problems.push('exception: ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text));
  if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') problems.push('console.error: ' + d.params.args.map((a) => a.value ?? a.description).join(' '));
  if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') problems.push('log: ' + d.params.entry.text);
};
await new Promise((r) => (ws.onopen = r));
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true })).result?.result?.value;

await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: W < 760 });
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: motion === 'reduce' ? 'reduce' : 'no-preference' }] });
await send('Page.navigate', { url });
await sleep(3000);

console.log(`${W}x${H} ${motion}`, 'html attrs:', await ev('JSON.stringify(Object.assign({}, document.documentElement.dataset, { class: document.documentElement.className }))'),
  '| horizontal overflow:', await ev('document.documentElement.scrollWidth > innerWidth'));

for (const stop of stops.length ? stops : ['0']) {
  const y = stop.startsWith('#') || stop.startsWith('.') || stop.startsWith('[')
    ? `(document.querySelector(${JSON.stringify(stop)})?.getBoundingClientRect().top ?? 0) + scrollY`
    : stop.endsWith('%') ? `document.documentElement.scrollHeight * ${parseFloat(stop) / 100}` : String(Number(stop));
  await ev(`window.scrollTo(0, ${y})`);
  await sleep(1700);
  const info = await ev(`(() => { const r = document.querySelector('[data-motion]') || document.documentElement;
    return 'scrollY=' + Math.round(scrollY) + ' --home-bg=' + getComputedStyle(r).getPropertyValue('--home-bg').trim() +
      ' lenis=' + document.documentElement.classList.contains('lenis'); })()`);
  const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 60 });
  const file = `${outDir}/${W}x${H}_${motion}_${stop.replace(/[^a-z0-9]+/gi, '') || 'top'}.jpg`;
  writeFileSync(file, Buffer.from(shot.result.data, 'base64'));
  console.log(' ', stop, info, '->', file);
}
console.log('problems:', problems.length ? '\n  ' + problems.join('\n  ') : 'none');
process.exit(0);
