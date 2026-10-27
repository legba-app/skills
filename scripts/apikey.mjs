// apikey.mjs — shared Legba API key resolver for the node helpers.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';

export const KEY_FILE = process.env.LEGBA_API_KEY_FILE || process.env.LEGBA_PROXY_API_KEY_FILE
  || path.join(os.homedir(), '.config', 'legba-proxy', 'api-key');

function fromFile() {
  try { return fs.readFileSync(KEY_FILE, 'utf8').trim() || null; } catch { return null; }
}

export function saveKey(k) {
  fs.mkdirSync(path.dirname(KEY_FILE), { recursive: true });
  fs.writeFileSync(KEY_FILE, k.trim() + '\n', { mode: 0o600 });
  try { fs.chmodSync(KEY_FILE, 0o600); } catch {}
}

function prompt(q) {
  return new Promise((res) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
    rl.question(q, (a) => { rl.close(); res(a); });
  });
}

export async function resolveKey() {
  let k = process.env.LEGBA_API_KEY || process.env.LEGBA_PROXY_API_KEY || fromFile();
  if (!k && process.stdin.isTTY) {
    k = (await prompt('Enter Legba API key: ')).trim();
    if (k) { saveKey(k); process.stderr.write(`# saved key to ${KEY_FILE}\n`); }
  }
  if (!k) {
    console.error(`No Legba API key found. Provide it one of these ways:
  • export LEGBA_API_KEY='...'
  • write it to ${KEY_FILE}  (chmod 600)
  • run this command in a terminal and you'll be prompted once (it gets saved).`);
    process.exit(1);
  }
  return k;
}
