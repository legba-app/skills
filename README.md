# Legba — the access layer for AI agents on the open web

Your agent hits a site. The site blocks cloud infrastructure, or asks it to prove it is a person.
Legba is one skill that gets it through: a residential exit, then a real browser, then a browser a
**human can take over** when the site asks for something only a person has.

**What this needs to work:** a Legba API key. The exits and the hosted browser are a service we run,
so the scripts here are a client for it and do nothing on their own. The Free plan needs no card and
covers rungs 1 and 2 — one residential exit at a time. If you would rather not have an account, this
skill is not useful to you, and that is a fair place to stop reading.

```
/plugin install legba --marketplace legba-app/skills
```

Not on Claude Code? See [Install](#install) — one line for any agent, or a plain `git clone`.

Then give your agent a key. `SKILL.md` is written for the agent, not for you: it tells it which rung
to start on, when to climb, and what to do if there is no key yet.

## Four rungs, lightest first

| | Rung | What it is |
|-|-|-|
| 1 | **residential exit** | a plain fetch from a residential IP — most "blocked" pages are only blocking the datacenter |
| 2 | **headless browser** | Playwright for pages that need JavaScript |
| 3 | **anti-detect browser** | Camoufox, a real Firefox with a hardened fingerprint, for serious anti-bot |
| 4 | **hosted browser** | a stealth browser on our infrastructure, behind a residential exit, **that your user can take over** |

The agent climbs only as far as the site forces it, and each rung reports a distinct exit code so it
knows whether to climb or stop.

## The human handoff

Most of this is ordinary: proxies and headless browsers are not new. Rung 4 is the part worth reading
about. Every proxy product gives up at the captcha — the agent is stuck, the run dies, and your user
finds out later.

Here the agent hands over **the same browser** — same page, same cookies, same session — to the
person. They solve the captcha, enter the 2FA code, finish the login. Then they hand it back and the
agent carries on from exactly where it stopped. Nothing is transferred, nothing is re-done.

## Install

**Claude Code** — one step:

```
/plugin install legba --marketplace legba-app/skills
```

Or from your shell:

```
claude plugin marketplace add legba-app/skills
claude plugin install legba@legba
```

**Any agent** — the installer finds the ones you have and installs into each:

```
curl -fsSL https://raw.githubusercontent.com/legba-app/skills/main/install.sh | sh
```

```
npx legba-skill
```

Both take an explicit path if you would rather say where:
`... | sh -s -- ~/.claude/skills/legba`, or `npx legba-skill ~/.claude/skills/legba`.

**By hand** — it is a `SKILL.md` and a `scripts/` directory; clone it wherever your agent looks:

| Agent | Path |
|-|-|
| Claude Code / Claude Desktop | `~/.claude/skills/legba` |
| OpenClaw | `~/.openclaw/skills/legba` |
| Hermes | `~/.hermes/skills/legba` |
| Meta Muse | `~/.muse/skills/legba` |

```
git clone https://github.com/legba-app/skills.git ~/.claude/skills/legba
```

Node and curl cover rungs 1 and 4. Rung 2 wants Playwright, rung 3 wants Camoufox — `SKILL.md` has
the one-liners, and each script says so itself and tells the agent to climb rather than fight an
install it cannot win.

## Getting a key

1. Sign up: **https://app.legba.xyz/signup** — the Free plan needs no card.
2. Create & copy your key: **https://app.legba.xyz/api-key**
3. Save it once:

```
mkdir -p ~/.config/legba && printf '%s\n' 'lk_YOUR_KEY' > ~/.config/legba/api-key && chmod 600 ~/.config/legba/api-key
```

One key covers every rung. The plan behind it decides how many exits you may hold at once and whether
the hosted browser is included; Free gets one residential exit at a time, which is rungs 1 and 2 in
full. When the agent asks for something the plan does not cover it gets a `402` saying so, and stops
— it will not spend anything on your behalf.

## Using it without an agent

The scripts are plain Node and Python; nothing stops you running them yourself.

```
node scripts/legba-proxy.mjs fetch https://example.com
python3 scripts/antibot.py https://example.com --mode proxy --country US --out page.html
node scripts/legba-session.mjs start --kind browser
```

## Licence

MIT — see [LICENSE](LICENSE).
