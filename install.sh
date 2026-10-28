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

install_to() {
    target="$1"
    if [ -d "$target/.git" ]; then
        say "updating $target"
        git -C "$target" pull --quiet --ff-only || die "could not update $target"
    elif [ -e "$target" ]; then
        die "$target already exists and is not a git clone — move it aside first"
    else
        say "installing to $target"
        mkdir -p "$(dirname "$target")"
        git clone --quiet --depth 1 "$REPO" "$target" || die "could not clone into $target"
    fi
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
