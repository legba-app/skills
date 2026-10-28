# Legba

Your agent gets onto the sites that block it. When it hits a captcha or a 2FA prompt, you finish that one step in the same browser and hand it back.

Legba is the web access layer for AI agents. It gives your agent a residential exit, local browsers for harder sites, and a hosted browser when a step needs a person. The agent starts with the lightest method and escalates only when the site forces it.

Use it two ways: as an agent skill (Claude Code, OpenClaw, Hermes, Meta Muse, and other skill-compatible agents) or over MCP for the hosted browser tools.

---

## Quick start

### 1. Get a key

Sign up at [app.legba.xyz](https://app.legba.xyz) and copy your key. The Free plan covers rungs 1 to 3.

export LEGBA_API_KEY='lk_...'
Using only the skill? You can skip this. The first time a script runs without a key, it asks once and saves it to ~/.config/legba-proxy/api-key (permissions 600). Using MCP? Export the key first, because the MCP setup command reads it.

### 2. Install the skill

npx skills add legba-app/skills -g
Pick your agent when prompted, or name it: -a claude-code, -a openclaw, -a hermes-agent. Requires Node.js 22.20 or later.

Manual install (Claude Code)

git clone https://github.com/legba-app/skills ~/.claude/skills/legba
For any other agent, clone the repo into that agent's skills directory. SKILL.md sits at the root, so the folder works as-is.

### 3. Try it

Ask your agent:

> Use Legba to fetch https://example.com and tell me the page title.

That confirms the setup. To see what Legba is for, point it at a page your agent normally can't reach.

---

## How it works

Four rungs, lightest first. The agent climbs only as far as the site requires.

| Rung | Where it runs | Use it when |
|---|---|---|
| 1. Residential exit | curl through a residential IP | The site rejects cloud or datacenter traffic |
| 2. Headless Chromium | Your machine, through the residential exit | The page needs JavaScript |
| 3. Hardened Firefox (Camoufox) | Your machine, through the residential exit | The site runs a stronger browser check |
| 4. Hosted browser | Legba's infrastructure, behind a residential exit | Rungs 1 to 3 fail, your machine can't run a browser, or a person needs to step in |

### Human handoff, same session

When automation reaches a step that needs you, like a captcha, a login, or a one-time code, Legba hands you a link to the same hosted browser. You finish the step and hand control back. The page, cookies, and session all stay intact, and the agent picks up where you left off.

The agent never types your credentials. Anything that authenticates a person goes to the person.

### A browser for you

On Pro, the same key opens a clean browser for you to use directly: Chrome, Brave, Firefox, or Tor. Your agent can't drive it. Note that it exits through a Legba address, not a residential one.

---

## Connect over MCP

MCP provides the hosted browser and handoff tools (rung 4), which require Pro. The Free plan does not include hosted sessions.

URL:     https://skill.legba.xyz/mcp
Header:  Authorization: Bearer <LEGBA_API_KEY>
Claude Code (with LEGBA_API_KEY exported; the key is saved to your local Claude config):

claude mcp add --scope user --transport http legba https://skill.legba.xyz/mcp \
  --header "Authorization: Bearer $LEGBA_API_KEY"
Tools: start_session, current_session, end_session, navigate, read_page, click, type, screenshot, wait, request_human, wait_for_human, resume.

Skill vs. MCP. MCP gives you the hosted browser and human handoff (rung 4). The local rungs (Chromium and Camoufox) come with the skill and need an agent that can run local commands. For the full ladder, install the skill.

---

## Plans

| | Free | Pro |
|---|---|---|
| Residential exit (rung 1) | Included | Included |
| Headless Chromium (rung 2) | Included, local setup | Included |
| Hardened Firefox (rung 3) | Included, local setup | Included |
| Hosted browser and human handoff (rung 4) | Not included | Included |
| Price | $0 | $500/month flat, no bandwidth meter |

If a task needs rung 4 on Free, the agent tells you and links the upgrade instead of retrying.

Running parallel sessions, production volume, or a dedicated deployment? Email [phillip@legba.app](mailto:phillip@legba.app).

---

## Local setup (rungs 2 and 3)

Rung 1 needs only Node.js and curl. Rung 4 runs on Legba's side and installs nothing locally. Rungs 2 and 3 need a one-time setup:

SKILL=~/.claude/skills/legba   # or wherever your agent installed it

# Rung 2: Playwright and Chromium
cd "$SKILL/scripts" && npm i playwright && npx playwright install chromium

# Rung 3: Camoufox (about 2.5 GB the first time)
python3 -m pip install --user 'camoufox[geoip]'
python3 -m camoufox fetch
If your machine can't run a local browser, skip both and use rung 4.

---

## Good habits

- End the session when done. Ask your agent to end the active Legba session, or run node /path/to/legba/scripts/legba-session.mjs end from a terminal. Each account runs one live session at a time.
- Reuse one exit across related requests instead of opening one per URL.
- Check the content, not the status code. A challenge page can come back as a 200. Confirm the agent got the page it asked for.
- Ask for a human only when a human is actually needed.

## Troubleshooting

- No key found: set LEGBA_API_KEY or check ~/.config/legba-proxy/api-key. MCP clients need the key in their own header config.
- Upgrade needed (402): the step needs rung 4, which isn't on Free. Upgrade or stop there.
- Rung 2 or 3 won't start: first check that you completed the local setup above. If your environment cannot install or launch the browser, use rung 4 (Pro) instead of repeating an installation that cannot succeed.

## Security and responsible use

For authorized use on public sites and accounts you control. You are responsible for following applicable law and the terms of the sites you access.

Keep your key out of repos, logs, and support tickets, and rotate it from the dashboard if it leaks. A hosted session's view link carries its own access token. Share it only with the person taking over, and end the session when the work is done.

---

[legba.app](https://legba.app) · [Dashboard](https://app.legba.xyz) · [phillip@legba.app](mailto:phillip@legba.app)
