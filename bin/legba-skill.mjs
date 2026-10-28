#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PAYLOAD = ['SKILL.md', 'scripts'];
const AGENTS = [
  { name: 'Claude Code / Desktop', base: '.claude' },
  { name: 'OpenClaw', base: '.openclaw' },
  { name: 'Hermes', base: '.hermes' },
  { name: 'Meta Muse', base: '.muse' },
];

function copyInto(target) {
  fs.mkdirSync(target, { recursive: true });
  for (const item of PAYLOAD) {
    fs.cpSync(path.join(HERE, item), path.join(target, item), { recursive: true });
  }
}

const explicit = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const targets = explicit.length
  ? explicit.map((p) => p.replace(/^~(?=$|\/)/, os.homedir()))
  : AGENTS
      .filter((a) => fs.existsSync(path.join(os.homedir(), a.base)))
      .map((a) => path.join(os.homedir(), a.base, 'skills', 'legba'));

if (!targets.length) {
  console.error(`legba: no agent directory found (looked for ${AGENTS.map((a) => '~/' + a.base).join(', ')}).
Pass one explicitly:  npx legba-skill ~/.claude/skills/legba`);
  process.exit(1);
}

for (const target of targets) {
  copyInto(target);
  console.log(`installed to ${target}`);
}

console.log(`
Installed. One thing left: the key.
  sign up (Free, no card): https://app.legba.xyz/signup
  copy your key:           https://app.legba.xyz/api-key

  mkdir -p ~/.config/legba && printf '%s\\n' 'lk_YOUR_KEY' > ~/.config/legba/api-key && chmod 600 ~/.config/legba/api-key`);
