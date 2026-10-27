#!/usr/bin/env python3
# antibot.py — anti-detect browser node (Camoufox) through a Legba residential proxy.
# Auth for auto-proxy: set LEGBA_API_KEY in the environment before use (see SKILL.md)
# Usage:
#   python3 antibot.py <url> --mode wireguard --country US            # auto residential, fresh session
#   python3 antibot.py <url> --mode wireguard --profile acme          # WARM persistent profile (keeps cf_clearance)
#   python3 antibot.py <url> --proxy http://u:p@host:port             # reuse a proxy you hold
#   [--wait 35000] [--out page.html] [--screenshot shot.png]
import sys, os, json, time, argparse, urllib.request, glob
from urllib.parse import urlparse

def _cf_libpath():
    parts = []
    cands = glob.glob(os.path.expanduser("~/.cache/camoufox/browsers/*/*/libxul.so"))
    if cands:
        parts.append(os.path.dirname(sorted(cands)[-1]))
    deps = os.path.expanduser("~/.local/camoufox-deps/usr/lib/x86_64-linux-gnu")
    if os.path.isdir(deps):
        parts.append(deps)
    return ":".join(parts)
_lp = _cf_libpath()
if _lp:
    os.environ["LD_LIBRARY_PATH"] = _lp + (":" + os.environ["LD_LIBRARY_PATH"] if os.environ.get("LD_LIBRARY_PATH") else "")

NO_LOCAL_BROWSER_EXIT = 3


def no_local_browser(reason):
    """Rung 3 cannot run here. Say what to do instead, and stop.

    This is the common case on a locked-down box: no compiler, no sudo, a
    read-only home, or simply not enough disk for Camoufox's 2.5 GB of Firefox.
    Retrying the install burns minutes and ends in the same place, so the script
    names rung 4 -- which installs nothing because the browser is ours, not this
    machine's -- and what to tell the user if their plan does not include it."""
    here = os.path.dirname(os.path.abspath(__file__))
    sys.stderr.write(f"""# rung 3 unavailable: {reason}
#
# Camoufox cannot run on this machine. Do not retry the install; it will fail the
# same way. Go to rung 4 instead -- Legba's own browser, nothing to install:
#
#   eval "$(node {here}/legba-session.mjs start --kind browser --country US)"
#   node {here}/legba-session.mjs go <url>
#   node {here}/legba-session.mjs read --out page.html
#
# If that answers 402, the key is on the Free plan: Free gets the residential
# proxy (rungs 1 and 2, one session at a time) but not the hosted browser. Give
# the user the 402's own message -- it names the limit and the upgrade link --
# and stop. Do not keep trying rungs 1 to 3 on a page that defeated them.
""")
    sys.exit(NO_LOCAL_BROWSER_EXIT)


try:
    from camoufox.sync_api import Camoufox
except Exception as e:  # noqa: BLE001 — a broken install raises more than ImportError
    no_local_browser(f"camoufox is not importable here ({type(e).__name__}: {e})")

ROTATE_ATTEMPTS = int(os.environ.get("LEGBA_ANTIBOT_ROTATE_ATTEMPTS", "2"))
GOTO_ATTEMPTS = 4
CHALLENGE_MARKERS = ("just a moment", "attention required", "checking your browser",
                     "challenge-platform", "cf-chl", "_cf_chl")
API = os.environ.get("LEGBA_BASE") or os.environ.get("LEGBA_API_BASE") or "https://skill.legba.xyz"

KEY_FILE = os.environ.get("LEGBA_API_KEY_FILE") or os.environ.get("LEGBA_API_KEY_FILE") or os.path.expanduser("~/.config/legba-proxy/api-key")
API_KEY = None

def resolve_key():
    k = os.environ.get("LEGBA_API_KEY", os.environ.get("LEGBA_PROXY_API_KEY", "")).strip()
    if not k:
        try:
            with open(KEY_FILE) as f:
                k = f.read().strip()
        except OSError:
            k = ""
    if not k and sys.stdin.isatty():
        import getpass
        k = getpass.getpass("Enter Legba API key: ").strip()
        if k:
            os.makedirs(os.path.dirname(KEY_FILE), exist_ok=True)
            with open(KEY_FILE, "w") as f:
                f.write(k + "\n")
            try: os.chmod(KEY_FILE, 0o600)
            except OSError: pass
            sys.stderr.write(f"# saved key to {KEY_FILE}\n")
    if not k:
        sys.exit(f"No Legba API key found. Set LEGBA_API_KEY, write it to {KEY_FILE} (chmod 600), "
                 "or run this in a terminal to be prompted once (it gets saved).")
    return k

def api(path, method="GET"):
    req = urllib.request.Request(API + path, method=method, headers={"X-API-Key": API_KEY})
    with urllib.request.urlopen(req, timeout=90) as r:
        return r.status, json.loads(r.read().decode() or "{}")

ap = argparse.ArgumentParser()
ap.add_argument("url")
ap.add_argument("--proxy"); ap.add_argument("--mode"); ap.add_argument("--country", default="US")
ap.add_argument("--client-id", default="default"); ap.add_argument("--profile")
ap.add_argument("--wait", type=int, default=35000)
ap.add_argument("--out"); ap.add_argument("--screenshot")
a = ap.parse_args()

proxy = None; provisioned = None
try:
    if a.proxy:
        u = urlparse(a.proxy)
        proxy = {"server": f"{u.scheme}://{u.hostname}:{u.port}", "username": u.username, "password": u.password}
    elif a.mode:
        API_KEY = resolve_key()
        st, body = api(f"/proxy?country={a.country}&mode={a.mode}&client_id={a.client_id}")
        if st != 200: sys.exit(f"provision {st}: {body}")
        provisioned = body; sp = body["rules"]["singleProxy"]; auth = body["auth"]
        port = sp.get("port") or (443 if sp["scheme"] == "https" else 80)
        proxy = {"server": f'{sp["scheme"]}://{sp["host"]}:{port}', "username": auth["username"], "password": auth["password"]}
        sys.stderr.write(f'# proxy {a.mode} exit {body.get("exit_ip")} ({body.get("exit_city")}, {body.get("ip_type")})\n')

    def make(geoip):
        opts = dict(headless=True, humanize=True, proxy=proxy, geoip=geoip)
        if a.profile:
            udd = os.path.expanduser(f"~/.cache/camoufox-profiles/{a.profile}"); os.makedirs(udd, exist_ok=True)
            return Camoufox(persistent_context=True, user_data_dir=udd, **opts)
        return Camoufox(**opts)

    try:
        cf = make(bool(proxy))
        ctx = cf.__enter__()
    except Exception:
        # Second try without geoip: that alignment is the part most likely to
        # fail on its own. If the browser itself will not come up, the machine
        # cannot host rung 3 at all, whatever the reason.
        try:
            cf = make(False); ctx = cf.__enter__()
        except Exception as e:  # noqa: BLE001
            no_local_browser(f"the browser would not start ({type(e).__name__}: "
                             f"{str(e).splitlines()[0][:120]})")
    try:
        page = ctx.new_page()

        def load_and_wait():
            """Load the page and wait for any anti-bot interstitial to clear.

            Waits on the markup, not the title: the title briefly reads
            "Loading <url>" and then the real one while the body is still the
            challenge. Returns True once the real page is there."""
            for try_n in range(GOTO_ATTEMPTS):
                try:
                    page.goto(a.url, wait_until="domcontentloaded", timeout=60000)
                    break
                except Exception as e:
                    if try_n == GOTO_ATTEMPTS - 1:
                        raise
                    sys.stderr.write(f"# navigation failed ({str(e).splitlines()[0][:60]}), retrying\n")
                    page.wait_for_timeout(2500)
            deadline = time.time() + a.wait / 1000
            while time.time() < deadline:
                page.wait_for_timeout(1000)
                body = (page.content() or "").lower()
                if body and not any(m in body for m in CHALLENGE_MARKERS):
                    try:
                        page.wait_for_load_state("networkidle", timeout=15000)
                    except Exception:
                        pass
                    last = -1
                    for _ in range(8):
                        size = len(page.content() or "")
                        if size == last:
                            break
                        last = size
                        page.wait_for_timeout(750)
                    return True
            return False

        for attempt in range(ROTATE_ATTEMPTS + 1 if provisioned else 1):
            if attempt:
                try:
                    api(f'/proxy/{provisioned["proxy_id"]}/rotate', "POST")
                    sys.stderr.write(f"# challenge persisted — rotated exit, retry {attempt}\n")
                except Exception as e:
                    sys.stderr.write(f"# rotate failed: {e}\n"); break
            if load_and_wait():
                break
        title = page.title() or ""
        html = page.content()
        if a.screenshot: page.screenshot(path=a.screenshot)
        sys.stderr.write(f"# title: {title[:80]} | {len(html)} bytes\n")
        if a.out:
            with open(a.out, "w") as f:
                f.write(html)
            sys.stderr.write(f"# wrote {a.out}\n")
        else: sys.stdout.write(html)
    finally:
        try: page.close()
        except Exception: pass
        try: cf.__exit__(None, None, None)
        except Exception: pass
finally:
    if provisioned:
        try: api(f'/proxy/{provisioned["proxy_id"]}/release', "POST"); sys.stderr.write(f'# released {provisioned["proxy_id"]}\n')
        except Exception as e: sys.stderr.write(f"# release failed: {e}\n")

sys.stdout.flush()
sys.stderr.flush()
os._exit(0)
