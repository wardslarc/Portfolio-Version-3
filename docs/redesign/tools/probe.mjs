// node docs/redesign/tools/probe.mjs <url> <W>x<H> <reduce|full> <evalFile.js> [--dark] [--touch] [--shot=path] [--st]
// Needs headless Chrome on CDP port 9333 (see cdp-check.mjs). --st finds ScrollTrigger's internal trigger array and
// stores it as window.__STL, so eval files can read __STL.length (no app code change needed).
// evalFile is a JS expression (async IIFE allowed) whose value is printed as JSON.
import { readFileSync, writeFileSync } from 'node:fs';
const [url, size, motion, evalFile, ...flags] = process.argv.slice(2);
const [W, H] = size.split('x').map(Number);
const targets = await (await fetch('http://127.0.0.1:9333/json/list')).json();
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
let id = 0; const pending = new Map(); const problems = [];
ws.onmessage = (m) => { const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); return; }
  if (d.method === 'Runtime.exceptionThrown') problems.push('exception: ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text));
  if (d.method === 'Runtime.consoleAPICalled' && (d.params.type === 'error' || d.params.type === 'warning')) problems.push('console.' + d.params.type + ': ' + d.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 300));
  if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') problems.push('log: ' + d.params.entry.text.slice(0, 300));
};
await new Promise((r) => (ws.onopen = r));
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: W < 760 });
await send('Emulation.setEmulatedMedia', { features: [
  { name: 'prefers-reduced-motion', value: motion === 'reduce' ? 'reduce' : 'no-preference' },
  ...(flags.includes('--touch') ? [{ name: 'hover', value: 'none' }, { name: 'pointer', value: 'coarse' }] : []),
] });
const origin = new URL(url).origin;
await send('Page.navigate', { url: origin + '/robots.txt' }); await sleep(500);
await send('Runtime.evaluate', { expression: flags.includes('--dark') ? 'localStorage.setItem("cde-theme","dark")' : 'localStorage.removeItem("cde-theme")' });
await send('Page.navigate', { url }); await sleep(3500);

async function exposeST() {
  await send('Debugger.enable');
  const ls = [];
  for (const ex of ['window', 'document', 'document.documentElement', 'document.body']) {
    const o = (await send('Runtime.evaluate', { expression: ex, objectGroup: 'st' })).result.result.objectId;
    const rr = await send('DOMDebugger.getEventListeners', { objectId: o }); if (process.env.DBG) console.log(ex, JSON.stringify(rr).slice(0, 200)); ls.push(...(rr.result?.listeners || []));
  }
  for (const l of ls) {
    if (!l.handler?.objectId) continue;
    const props = (await send('Runtime.getProperties', { objectId: l.handler.objectId, ownProperties: true })).result;
    const scopes = props.internalProperties?.find((p) => p.name === '[[Scopes]]');

    if (!scopes) continue;
    const list = (await send('Runtime.getProperties', { objectId: scopes.value.objectId, ownProperties: true })).result.result;
    for (const sc of list) {
      if (!sc.value?.objectId) continue;
      const vars = (await send('Runtime.getProperties', { objectId: sc.value.objectId, ownProperties: true })).result.result || [];
      for (const v of vars) {
        if (!v.value?.objectId) continue;
        const ok = (await send('Runtime.callFunctionOn', { objectId: v.value.objectId, functionDeclaration: 'function(){ if (typeof this==="function" && typeof this.getAll==="function" && typeof this.refresh==="function" && typeof this.create==="function") { window.__ST = this; return true } if (Array.isArray(this) && this.length && this[0] && typeof this[0].refresh==="function" && "trigger" in this[0] && typeof this[0].kill==="function" && "progress" in this[0]) { window.__STL = this; return true } return false }', returnByValue: true })).result.result.value;
        if (ok) return true;
      }
    }
  }
  return false;
}
if (flags.includes('--st')) console.log('ST exposed:', await exposeST());
const expr = readFileSync(evalFile, 'utf8');
const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
console.log(JSON.stringify(r.result?.result?.value ?? r.result));
const shotFlag = flags.find((f) => f.startsWith('--shot='));
if (shotFlag) { const s = await send('Page.captureScreenshot', { format: 'jpeg', quality: 60 }); writeFileSync(shotFlag.slice(7), Buffer.from(s.result.data, 'base64')); }
console.log('problems:', problems.length ? '\n  ' + problems.join('\n  ') : 'none');
process.exit(0);
