#!/usr/bin/env node
// legba-session.mjs — Legba session client: a residential connection, or a browser a person can take over.
import fs from 'node:fs';
import { resolveKey } from './apikey.mjs';

const API = (process.env.LEGBA_BASE || process.env.LEGBA_SESSION_BASE || 'https://skill.legba.xyz').replace(/\/$/, '');
const H = { 'Content-Type': 'application/json' };
// A plan limit is not a transport error: it needs a person, not a retry, so it
// leaves by its own exit code and antibot.py's rung-3 fallback points at it.
const UPGRADE_NEEDED_EXIT = 4;

async function api(path, method = 'GET', body) {
  const r = await fetch(API + '/api/v1' + path, {
    method, headers: H, body: body === undefined ? undefined : JSON.stringify(body),
  });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; }
  const msg = j && j.detail ? j.detail : JSON.stringify(j);
  if (r.status === 402) {
    console.error(`UPGRADE NEEDED: ${msg}`);
    console.error('Free gets the residential exit (rungs 1 and 2), one session at a time; the hosted');
    console.error('browser is a paid feature. Tell the user the line above, with the link, and stop.');
    console.error('Do not retry, and do not try to install a browser on this machine instead.');
    process.exit(UPGRADE_NEEDED_EXIT);
  }
  if (r.status >= 400) throw new Error(`${r.status}: ${msg}`);
  return j;
}

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > -1 ? (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true) : d; };
const has = n => process.argv.includes('--' + n);
const [cmd, a1] = process.argv.slice(2).filter(x => !x.startsWith('--'));
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function currentSession() {
  const { session } = await api('/sessions/current');
  return session;
}

async function liveBrowser() {
  const s = await currentSession();
  if (!s) throw new Error('no session is running — start one: legba-session.mjs start --kind browser');
  if (s.kind !== 'browser') throw new Error(`the running session is a ${s.kind} session, not a browser`);
  return s;
}

async function drive(action, payload, { waitForBrowser = false } = {}) {
  const s = await liveBrowser();
  const deadline = Date.now() + (waitForBrowser ? 150000 : 0);
  for (;;) {
    try {
      return await api(`/sessions/${s.id}/browser/${action}`, 'POST', payload || {});
    } catch (e) {
      const transient = /still starting|bridge_unreachable|not answering|^50[234]: /.test(e.message);
      if (!transient || Date.now() > deadline) throw e;
      process.stderr.write('# waiting for the browser…\n');
      await sleep(5000);
    }
  }
}

(async () => {
  try {
    if (cmd) H.Authorization = 'Bearer ' + await resolveKey();

    if (cmd === 'start') {
      const kind = arg('kind', 'browser'), country = arg('country', 'US');
      const browser = String(arg('browser', 'agent'));
      const s = await api('/sessions', 'POST', { kind, country, browser });
      console.log('SESSION_ID=' + s.id);
      if (s.proxy_url) console.log('PROXY_URL=' + s.proxy_url);
      if (s.view_url) console.log('VIEW_URL=' + s.view_url);
      process.stderr.write(`# ${s.browser || s.kind} session ${s.id} (${s.state}) — end it when you are done: legba-session.mjs end\n`);
      if (s.kind === 'browser' && (s.browser || 'agent') === 'agent') {
        process.stderr.write('# the browser takes about a minute to be drivable\n');
      } else if (s.kind === 'browser') {
        process.stderr.write('# give VIEW_URL to the person — this browser is theirs to use, not yours to drive\n');
      }
    } else if (cmd === 'current') {
      console.log(JSON.stringify(await currentSession(), null, 2));
    } else if (cmd === 'end') {
      const id = a1 || (await currentSession() || {}).id;
      if (!id) { console.log('nothing is running'); return; }
      console.log(JSON.stringify(await api(`/sessions/${id}`, 'DELETE')));
    } else if (cmd === 'go' || cmd === 'navigate') {
      if (!a1) throw new Error('usage: go <url>');
      console.log(JSON.stringify(await drive('navigate', { url: a1 }, { waitForBrowser: true })));
    } else if (cmd === 'read') {
      const r = await drive('read', {}, { waitForBrowser: true });
      const out = arg('out');
      if (typeof out === 'string') { fs.writeFileSync(out, r.text || ''); process.stderr.write(`# wrote ${out}\n`); }
      else console.log(r.text || '');
      process.stderr.write(`# ${r.url} — ${r.title}\n`);
    } else if (cmd === 'click') {
      console.log(JSON.stringify(await drive('click', { selector: arg('selector', ''), text: arg('text', '') })));
    } else if (cmd === 'type') {
      console.log(JSON.stringify(await drive('type', { selector: arg('selector'), text: arg('text', ''), enter: has('enter') })));
    } else if (cmd === 'shot') {
      const r = await drive('screenshot', { full_page: has('full') }, { waitForBrowser: true });
      const out = typeof arg('out') === 'string' ? arg('out') : 'shot.png';
      fs.writeFileSync(out, Buffer.from(r.png_base64, 'base64'));
      console.log('SCREENSHOT=' + out);
    } else if (cmd === 'wait') {
      console.log(JSON.stringify(await drive('wait', { ms: Number(arg('ms', 1000)) })));
    } else if (cmd === 'handoff') {
      const s = await liveBrowser();
      const r = await api(`/sessions/${s.id}/handoff`, 'POST', { reason: String(arg('reason', '')) });
      console.log('VIEW_URL=' + r.view_url);
      process.stderr.write(`# give that link to the person (${r.reason}). They finish the step in the same browser;\n# then: legba-session.mjs resume\n`);
    } else if (cmd === 'wait-for-human') {
      const until = Date.now() + Number(arg('timeout', 300)) * 1000;
      for (;;) {
        const s = await currentSession();
        if (!s) { console.log(JSON.stringify({ state: 'ended' })); return; }
        if (s.state !== 'needs_human') { console.log(JSON.stringify({ state: s.state, timed_out: false })); return; }
        if (Date.now() > until) { console.log(JSON.stringify({ state: s.state, timed_out: true })); return; }
        await sleep(5000);
      }
    } else if (cmd === 'resume') {
      const s = await liveBrowser();
      console.log(JSON.stringify(await api(`/sessions/${s.id}/resume`, 'POST')));
    } else {
      console.log(`commands:
  start [--kind browser|proxy] [--country US] [--browser agent|chrome|brave|firefox|tor]
                                                open your one session
  current                                       what is running
  end [<id>]                                    close it and free the capacity
  go <url> | read [--out f] | shot [--out f] [--full] | wait [--ms N]
  click --selector <css> | --text <visible text>
  type --selector <css> --text <text> [--enter]
  handoff [--reason "..."]                      hand the browser to a person
  wait-for-human [--timeout 300]                wait for them to hand it back
  resume                                        take it back`);
    }
  } catch (e) { console.error('ERROR:', e.message); process.exit(1); }
})();
