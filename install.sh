#!/bin/sh
# Install the Legba skill for whichever agent is on this machine.
#
#   curl -fsSL https://raw.githubusercontent.com/legba-app/skills/main/install.sh | sh
#
# Installs to every agent directory it finds, or to the one named in $1:
#   curl -fsSL .../install.sh | sh -s -- ~/.claude/skills/legba
set -eu

REPO="https://github.com/legba-app/skills.git"
NAME="legba"

say() { printf '%s\n' "$*"; }
die() { printf 'legba: %s\n' "$*" >&2; exit 1; }

command -v git >/dev/null 2>&1 || die "git is required"

# The repository is a plugin: the skill itself lives at skills/legba, and that
# is what an agent's skills directory wants -- not the whole repo, which would
# bury SKILL.md two folders deep where nothing looks for it.
WORK=""
fetch_once() {
    [ -n "$WORK" ] && return 0
    WORK="$(mktemp -d)" || die "could not create a temporary directory"
    trap 'rm -rf "$WORK"' EXIT INT TERM
    git clone --quiet --depth 1 "$REPO" "$WORK/repo" || die "could not download the skill"
    [ -f "$WORK/repo/skills/$NAME/SKILL.md" ] || die "downloaded copy has no skills/$NAME/SKILL.md"
}

install_to() {
    target="$1"
    fetch_once
    say "installing to $target"
    mkdir -p "$target"
    rm -rf "$target/scripts" "$target/SKILL.md"
    cp -R "$WORK/repo/skills/$NAME/." "$target/" || die "could not write to $target"
}

if [ "$#" -gt 0 ]; then
    install_to "$1"
    found=1
else
    found=0
    # One per agent, only where that agent already keeps its skills: creating
    # ~/.hermes on a machine with no Hermes would be litter, not an install.
    for base in "$HOME/.claude" "$HOME/.openclaw" "$HOME/.hermes" "$HOME/.muse"; do
        [ -d "$base" ] || continue
        install_to "$base/skills/$NAME"
        found=1
    done
fi

if [ "$found" -eq 0 ]; then
    die "no agent directory found (looked for ~/.claude, ~/.openclaw, ~/.hermes, ~/.muse).
Pass one explicitly:  curl -fsSL .../install.sh | sh -s -- ~/.claude/skills/legba"
fi

say ""
say "Installed. One thing left: the key."
say "  sign up (Free, no card): https://app.legba.xyz/signup"
say "  copy your key:           https://app.legba.xyz/api-key"
say ""
say "  mkdir -p ~/.config/legba && printf '%s\\n' 'lk_YOUR_KEY' > ~/.config/legba/api-key && chmod 600 ~/.config/legba/api-key"
