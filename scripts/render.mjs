#!/usr/bin/env node
// render.mjs — headless Chromium through a Legba residential proxy.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import { resolveKey } from './apikey.mjs';
const require = createRequire(process.env.LEGBA_PLAYWRIGHT_BASE || import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch {
  console.error('render.mjs: Playwright not found. From the scripts dir run: npm i playwright && npx playwright install chromium  (or set LEGBA_PLAYWRIGHT_BASE to an existing install).');
  console.error('If it cannot be installed here -- no network, no disk, a read-only home -- do not');
  console.error('retry it: climb instead. Rung 3 (antibot.py) if Camoufox runs here, otherwise rung 4');
  console.error('(legba-session.mjs start --kind browser), which installs nothing because the browser is ours.');
  process.exit(3);
}

const API = process.env.LEGBA_BASE || process.env.LEGBA_API_BASE || 'https://skill.legba.xyz';
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i > -1 ? (argv[i+1] && !argv[i+1].startsWith('--') ? argv[i+1] : true) : d; };
const url = argv.filter(x => !x.startsWith('--'))[0];
if (!url) { console.error('usage: render <url> [--mode wireguard --country US | --proxy URL] [--profile name] [--wait 9000] [--out f] [--screenshot f]'); process.exit(1); }
const wait = parseInt(arg('wait', '9000'), 10);
const profile = arg('profile');

let KEY;
async function api(path, method = 'GET') { const r = await fetch(API + path, { method, headers: { 'X-API-Key': KEY } }); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { status: r.status, body: j }; }

const STEALTH = `
Object.defineProperty(navigator,'webdriver',{get:()=>undefined});
window.chrome={runtime:{}};
Object.defineProperty(navigator,'languages',{get:()=>['en-US','en']});
Object.defineProperty(navigator,'plugins',{get:()=>[1,2,3,4,5]});
const _q=window.navigator.permissions&&window.navigator.permissions.query;
if(_q)window.navigator.permissions.query=(p)=>p&&p.name==='notifications'?Promise.resolve({state:Notification.permission}):_q(p);
try{const gp=WebGLRenderingContext.prototype.getParameter;WebGLRenderingContext.prototype.getParameter=function(p){if(p===37445)return'Google Inc. (Intel)';if(p===37446)return'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)';return gp.call(this,p);};}catch(e){}
`;

let proxyStr = arg('proxy'), provisioned = null;
try {
  if (!proxyStr && arg('mode')) {
    KEY = await resolveKey();
    const country = arg('country', 'US'), mode = arg('mode', 'wireguard'), cid = arg('client-id', 'default');
    const { status, body } = await api(`/proxy?country=${country}&mode=${mode}&client_id=${encodeURIComponent(cid)}`);
    if (status !== 200) throw new Error('provision ' + status + ': ' + JSON.stringify(body));
    provisioned = body; const sp = body.rules.singleProxy, a = body.auth, p = sp.port || (sp.scheme === 'https' ? 443 : 80);
    proxyStr = `${sp.scheme}://${a.username}:${a.password}@${sp.host}:${p}`;
    console.error(`# proxy ${mode} exit ${body.exit_ip} (${body.exit_city}, ${body.ip_type})`);
  }
  const proxy = proxyStr ? (() => { const u = new URL(proxyStr); return { server: `${u.protocol}//${u.host}`, username: decodeURIComponent(u.username), password: decodeURIComponent(u.password) }; })() : undefined;
  const uaFor = (v) => `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${String(v).split('.')[0]}.0.0.0 Safari/537.36`;
  const args = ['--no-sandbox', '--disable-blink-features=AutomationControlled'];
  const ctxOpts = { viewport: { width: 1366, height: 768 }, locale: 'en-US', proxy };

  let browser = null, ctx;
  if (profile) {
    const udd = `${os.homedir()}/.cache/chromium-profiles/${profile}`; fs.mkdirSync(udd, { recursive: true });
    const probe = await chromium.launch({ headless: true, args });
    const ua = uaFor(probe.version());
    await probe.close();
    ctx = await chromium.launchPersistentContext(udd, { headless: true, args, ...ctxOpts, userAgent: ua });
    console.error(`# warm profile: ${udd}`);
  } else {
    browser = await chromium.launch({ headless: true, args });
    ctx = await browser.newContext({ ...ctxOpts, userAgent: uaFor(browser.version()) });
  }
  await ctx.addInitScript(STEALTH);
  try {
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(wait);
    const title = await page.title().catch(() => '');
    const html = await page.content();
    const ss = arg('screenshot'); if (ss) await page.screenshot({ path: ss });
    console.error(`# title: ${String(title).slice(0, 80)} | ${html.length} bytes`);
    const out = arg('out'); if (out) { fs.writeFileSync(out, html); console.error('# wrote ' + out); } else process.stdout.write(html);
  } finally { await ctx.close(); if (browser) await browser.close(); }
} finally {
  if (provisioned) { await api(`/proxy/${provisioned.proxy_id}/release`, 'POST'); console.error('# released ' + provisioned.proxy_id); }
}
