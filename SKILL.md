---
name: legba
description: Trigger on the keyword "legba" — e.g. "use legba to access/fetch this", "legba this URL", "route this through legba". Also use when a public target blocks datacenter IPs, is geo-restricted, sits behind a Cloudflare/anti-bot JS challenge, or needs a captcha, login code or 2FA that only a person can do — provisions a residential exit, or a browser on Legba's own infrastructure that the user can take over mid-task and hand back. Keywords - legba, residential proxy, datacenter block, geo-restricted, Cloudflare, Turnstile, DataDome, PerimeterX, captcha, 2FA, exit IP, recon, OSINT, hosted browser, human in the loop.
---

# Legba

Get onto the open web from an address and a browser that are not obviously a robot's.

**This needs a key before it can do anything.** The exits and the hosted browser are a service Legba
runs; these scripts are a client for it. Every one of them fails with the same message if no key is
stored, and that message tells you what to do.

If there is no key, ask the user for theirs **once**. If they have no account, give them both links:
sign up at **https://app.legba.xyz/signup** (Free, no card) and copy the key from
**https://app.legba.xyz/api-key**. If they would rather not have an account, say that this skill
cannot help and stop — do not go looking for another way onto the site, and do not keep retrying.

Nothing here ever spends their money on its own: when a plan does not cover what you asked for, the
answer is a `402` naming the limit and the upgrade link, and you stop and show it to them.

Four rungs, lightest first. Climb only as far as the target forces you:

| | Rung | What it is | When |
|-|------|------------|------|
| 1 | plain fetch | `curl` through a residential exit | the default |
| 2 | `render.mjs` | headless Chromium through that exit | the page needs JavaScript |
| 3 | `antibot.py` | Camoufox (fingerprint-patched Firefox) **on this machine** | hard anti-bot: Cloudflare interstitial, DataDome, PerimeterX |
| 4 | **hosted browser** | a stealth browser on Legba's infrastructure, behind a residential exit, **that the user can take over** | rung 3 fails, this machine cannot run a browser, or the step needs a human: captcha, login code, 2FA |

The same key also opens a plain Shield browser (Chrome, Brave, Firefox, Tor) for the user to drive
themselves — see the end of rung 4.

**What the key's plan allows.** Rungs 1 and 2 work on every plan, including Free: one residential exit
at a time. Rung 3 runs on this machine and costs the plan nothing. Rung 4 is a browser on Legba's
infrastructure and is **not part of Free** — a Free key is refused with `402` and the two scripts exit
with a code you can branch on:

| exit | from | means |
|-|-|-|
| `3` | `render.mjs`, `antibot.py` | this machine cannot run that rung's browser — climb |
| `4` | `legba-session.mjs` | the plan does not include the hosted browser — the user must upgrade |
| `5` | `antibot.py` | the anti-bot challenge never cleared — what came back is the interstitial, not the page. Climb to rung 4; do not parse it, and do not just raise `--wait` |

Those two meet in the common case: a locked-down box where Camoufox will not install **and** a Free
key. Then the honest answer is not another attempt, it is one sentence to the user — the page needs a
real browser, their plan does not include one, here is the link — and stop.

Rung 4 is the one nothing else does: when you are stuck, you hand the **same** browser — same page,
same cookies — to the person, they finish the step, and they hand it back to you.

## Install

The skill is this repository: a `SKILL.md` and a `scripts/` directory. Put it where your agent looks
for skills, then set `SKILL` to that path — every command below is written against it.

| Agent | Where it goes |
|-|-|
| **Claude Code / Claude Desktop** | `~/.claude/skills/legba` |
| **OpenClaw** | `~/.openclaw/skills/legba` |
| **Hermes** | `~/.hermes/skills/legba` |
| **Meta Muse** | `~/.muse/skills/legba` |
| **Anything else** | wherever it reads skills from, or clone it and point `SKILL` at the clone |

```
git clone https://github.com/legba-app/skills.git ~/.claude/skills/legba
SKILL=~/.claude/skills/legba
```

Nothing here is specific to one agent: the scripts are plain Node and Python and can be run by hand,
from a shell, or from any tool that can call a command.

## Setup on this machine (one-time)

- **Node** and **curl** are already present. Rungs 1 and 4 need nothing else.
- **Playwright** (rung 2 only): `cd "$SKILL/scripts" && npm i playwright && npx playwright install chromium`
  (or point `LEGBA_PLAYWRIGHT_BASE` at an existing install).
- **Camoufox** (rung 3 only): `pip install --user --break-system-packages "camoufox[geoip]"`.
  It brings its own Firefox and NSS; `antibot.py` sets `LD_LIBRARY_PATH` for the userspace GTK3 libs
  under `~/.local/camoufox-deps` itself. Expect a few minutes the first time.

## Auth — one key

The scripts resolve it in this order: **`LEGBA_API_KEY` env → saved key file → interactive prompt**.
Nothing is hardcoded. The file is `~/.config/legba/api-key` (mode 600; override with
`LEGBA_API_KEY_FILE`).

**If no key is stored yet, ask the user for theirs** and save it once:

```
mkdir -p ~/.config/legba && printf '%s\n' 'PASTE_KEY_HERE' > ~/.config/legba/api-key && chmod 600 ~/.config/legba/api-key
# …or for this shell only:
export LEGBA_API_KEY='PASTE_KEY_HERE'
```

Keys come from the Legba dashboard: **https://app.legba.xyz/api-key** — sign up first at
**https://app.legba.xyz/signup** if you have no account. The Free plan needs no card and is enough for
rungs 1 and 2: one residential exit at a time.

One key, every rung. A Legba key starts `lk_` and the plan behind it decides what it may do: how many
exits at once, and whether the hosted browser is included.

## One address

Everything this skill calls lives on **https://skill.legba.xyz** — sessions, the exits, the browser and
the MCP server. Override it with `LEGBA_BASE` if you are pointing at another environment; there is
nothing else to configure.

The one exception is a browser session's `VIEW_URL`: that is a per-session address on the node that
streams it, which is why it looks different. It is the link you hand to a person.

## One session at a time

Legba gives you **one live session per account**, whatever opened it — this skill, the dashboard, or the
browser extension. On Free that one session is a proxy exit; the hosted browser needs a paid plan. Starting a second is refused with a message naming what is already running. So:
**end your session when the task is done.** It costs capacity while it is open, and it is the user's only
slot.

```
node "$SKILL/scripts/legba-session.mjs" current     # what is running
node "$SKILL/scripts/legba-session.mjs" end         # free it
```

## Rung 1 — a residential exit

```
eval "$(node "$SKILL/scripts/legba-session.mjs" start --kind proxy --country US)"   # sets PROXY_URL
curl -s -x "$PROXY_URL" https://target/path                                        # many fetches, one exit
node "$SKILL/scripts/legba-session.mjs" end
```

Provisioning a residential exit takes a few seconds — allow a **60–90 s** timeout. Reuse the one exit
across requests; do not provision per URL.

The same client does more than hand you one exit — several at once up to your plan's limit, a cheap
datacenter exit with `--mode proxy`, and `locations`, `rotate`, `sticky`:

```
node "$SKILL/scripts/legba-proxy.mjs" get --country US --mode wireguard --client-id myclient
node "$SKILL/scripts/legba-proxy.mjs" cleanup --client-id myclient
```

## Rung 2 — JavaScript (`render.mjs`)

Chromium, through the exit, with the usual headless tells patched out. Handles ordinary JS-rendered
pages. Measured 2026-10-07: it does **not** clear Cloudflare's interstitial — for those go to rung 3.

```
node "$SKILL/scripts/render.mjs" https://target/path --proxy "$PROXY_URL" --out page.html
# or let it provision its own exit: --mode wireguard --country US
# options: --wait 9000 · --screenshot shot.png · --profile <name> (warm profile, keeps cf_clearance)
```

## Rung 3 — hard anti-bot, locally (`antibot.py`)

Camoufox: a real Firefox with a patched fingerprint, geoip-aligned to the exit.

```
python3 "$SKILL/scripts/antibot.py" https://target/path --proxy "$PROXY_URL" --out page.html
# or: --mode wireguard --country US   · --profile <name> keeps the warm session
# --wait is a ceiling (default 35 s), not a sleep: it stops as soon as the challenge clears
```

Verified against a live Cloudflare challenge and bot.sannysoft.com: `navigator.webdriver` absent, real
Firefox fingerprint, residential exit.

**If Camoufox will not install or will not start here**, `antibot.py` says so and exits `3` instead of
leaving you a traceback. Do not retry the install — no compiler, no sudo, a read-only home or too
little disk for its 2.5 GB of Firefox all fail the same way every time. Go to rung 4: the browser is
ours, so there is nothing to install on this machine.

## Rung 4 — Legba's own browser, with a human on call

A stealth browser on Legba's infrastructure, streamed, behind a residential exit. You drive it over the
API; the user can open the same session in their own browser and take over.

```
eval "$(node "$SKILL/scripts/legba-session.mjs" start --kind browser --country US)"  # sets VIEW_URL
node "$SKILL/scripts/legba-session.mjs" go https://target/path       # waits out the browser's start
node "$SKILL/scripts/legba-session.mjs" read --out page.html         # the page as text
node "$SKILL/scripts/legba-session.mjs" click --text "Sign in"
node "$SKILL/scripts/legba-session.mjs" type --selector "#email" --text "someone@example.com" --enter
node "$SKILL/scripts/legba-session.mjs" shot --out shot.png
node "$SKILL/scripts/legba-session.mjs" end
```

Starting the browser takes **about a minute**; `go`, `read` and `shot` wait that out for you. Other
commands return "the browser is not ready yet" — wait a few seconds and repeat.

**`UPGRADE NEEDED` and exit `4`** means the key is on Free, which gets the exit but not this browser.
Give the user that line — it carries the upgrade link — and stop there. Do not fall back down the
ladder onto a page that already defeated rung 3, and do not try to install a browser locally instead:
if rung 3 were available you would not be here.

### When you need the person

A captcha, a one-time code, a 2FA prompt, a login you must not perform yourself:

```
node "$SKILL/scripts/legba-session.mjs" handoff --reason "a captcha is blocking the search page"
```

Then **give the user the `VIEW_URL` it prints** and tell them what to do, in your own words — for example:
"Open this link, solve the captcha, then tell me you're done." While they hold it, your writes are
refused (reads still work, so you can watch the page). When they are finished:

```
node "$SKILL/scripts/legba-session.mjs" wait-for-human --timeout 300   # returns when control is back
node "$SKILL/scripts/legba-session.mjs" resume
```

Then carry on from the page they left you on. Nothing is transferred and nothing is lost: it is one
browser the whole time.

### A browser for the person, not for you

Sometimes what they want is a browser of their own — a clean, fingerprint-patched one behind a
residential exit, with nothing of yours in it. Same key, same one-session rule:

```
eval "$(node "$SKILL/scripts"/legba-session.mjs start --kind browser --browser chrome --country US)"
```

`--browser chrome|brave|firefox|tor` opens a Shield browser and returns its `VIEW_URL` for them to
open. You **cannot** drive that one: `go`, `read`, `click` and the handoff all answer that it is
theirs to use. Starting a session with `--browser agent` (the default) is the one you drive.

A Shield browser leaves through Legba's own address, not a residential exit — the exit is for
the proxy session and for the agent's browser. Say so if the user's reason for wanting it is the IP.

### MCP instead of the CLI

The same tools are a hosted MCP server, if the user's client speaks MCP:

```
https://skill.legba.xyz/mcp      header:  Authorization: Bearer <LEGBA_API_KEY>
```

Tools: `start_session`, `current_session`, `end_session`, `navigate`, `read_page`, `click`, `type`,
`screenshot`, `wait`, `request_human`, `wait_for_human`, `resume`. No key, no MCP — the server answers
nothing without one.

## Rules (do not skip)

- **End the session** at the end of the task. It is the user's only slot.
- **Climb the ladder, don't jump it.** Each rung costs more: rung 1 is instant, rung 4 takes a minute
  and a browser.
- **Reuse** one exit across requests.
- Ask for the human only when a human is genuinely required, and say plainly why.
- An exit's `health` answers in status codes: `200` healthy, `410` expired, `502` dead, `404`
  unknown. On a `410` or a `502`, provision a fresh exit rather than retrying that one.

## Scope

Authorized use on public surfaces: reconnaissance, reading, and the user's own accounts. **You** read
and navigate. Anything that authenticates a person — a password, a one-time code, a 2FA prompt — is
handed to the user with `handoff`; you never type a credential on their behalf, and you never use this
for traffic they have not asked for.

## Security

HTTPS throughout. The key sits at `~/.config/legba/api-key` (mode 600) — keep it out of git and
shared logs, and rotate it from the dashboard if it leaks. A session's `VIEW_URL` carries its own token:
it is the user's way in, so give it to them and nobody else. It dies with the session.
