#!/usr/bin/env node
// legba-proxy.mjs — Legba exits: a datacenter or residential HTTP proxy, held for as long as you need it.
import { execFileSync } from 'node:child_process';
import { resolveKey } from './apikey.mjs';
const API = process.env.LEGBA_BASE || process.env.LEGBA_API_BASE || 'https://skill.legba.xyz';
const H = {};
async function api(path, method='GET') {
  const r = await fetch(API+path, { method, headers: H });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; }
  return { status: r.status, body: j };
}
const sh = v => `'${String(v).replace(/'/g, "'\\''")}'`;
const proxyUrl = j => { const sp=j.rules.singleProxy, a=j.auth; const p=sp.port||(sp.scheme==='https'?443:80); return `${sp.scheme}://${a.username}:${a.password}@${sp.host}:${p}`; };
const arg = (n,d) => { const i=process.argv.indexOf('--'+n); return i>-1?(process.argv[i+1]&&!process.argv[i+1].startsWith('--')?process.argv[i+1]:true):d; };
const has = n => process.argv.includes('--'+n);
const [cmd,a1] = process.argv.slice(2).filter(x=>!x.startsWith('--'));
const country=arg('country','US'), mode=arg('mode','proxy'), clientId=arg('client-id','default');
async function provision(){ let q=`/proxy?country=${country}&mode=${mode}&client_id=${encodeURIComponent(clientId)}`; if(has('sticky'))q+='&sticky=true'; if(arg('ttl-days'))q+=`&ttl_days=${arg('ttl-days')}`; const {status,body}=await api(q); if(status!==200)throw new Error(`provision ${status}: ${JSON.stringify(body)}`); return body; }
(async()=>{try{
 if(cmd) H['X-API-Key'] = await resolveKey();
 if(cmd==='get'){ const j=await provision(); console.log('PROXY_ID='+sh(j.proxy_id)); console.log('PROXY_URL='+sh(proxyUrl(j))); console.error(`# mode=${mode} exit ${j.exit_ip} (${j.exit_city}, ${j.ip_type}) — release when done: node legba-proxy.mjs release ${j.proxy_id}  (or: cleanup)`); }
 else if(cmd==='fetch'){ const url=a1; if(!url)throw new Error('usage: fetch <url>'); const j=await provision(); const pu=proxyUrl(j); try{ process.stdout.write(execFileSync('curl',['-s','-m','60','-x',pu,url],{encoding:'utf8',maxBuffer:1<<26})); } finally { await api(`/proxy/${j.proxy_id}/release`,'POST'); process.stderr.write(`\n# released ${j.proxy_id} (mode=${mode}, exit ${j.exit_ip})\n`); } }
 else if(cmd==='cleanup'){ const {body}=await api(`/proxy/mine?client_id=${encodeURIComponent(clientId)}`); if(body&&body.proxy_id){ const r=await api(`/proxy/${body.proxy_id}/release`,'POST'); console.log(`released ${body.proxy_id} (${r.status})`); } else console.log(`no active proxy for client_id=${clientId}`); }
 else if(cmd==='health'){ const {status,body}=await api(`/proxy/${a1}/health`); console.log(status,JSON.stringify(body)); }
 else if(['release','rotate','refresh'].includes(cmd)){ if(!a1)throw new Error(`usage: ${cmd} <proxy_id>`); const {status,body}=await api(`/proxy/${a1}/${cmd}`,'POST'); console.log(status,JSON.stringify(body)); }
 else if(cmd==='mine'){ const {status,body}=await api(`/proxy/mine?client_id=${encodeURIComponent(a1||clientId)}`); console.log(status,JSON.stringify(body)); }
 else if(cmd==='locations'){ const {body}=await api('/locations'); console.log(JSON.stringify(body)); }
 else console.log('commands: get | fetch <url> | cleanup | health <id> | rotate <id> | refresh <id> | release <id> | mine [client_id] | locations\nflags: --country US --mode proxy|wireguard --client-id <label> --sticky --ttl-days N');
}catch(e){console.error('ERROR:',e.message);process.exit(1);}})();
