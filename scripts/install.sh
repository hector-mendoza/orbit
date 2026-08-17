#!/usr/bin/env bash
# Installs the Orbit status writer into ~/.claude-orb and registers the Claude Code
# hooks in ~/.claude/settings.json.
#
# Safe to re-run: existing Orbit hook entries are replaced, not duplicated, and any
# hooks you already have from other tools are left untouched. Backs up settings.json
# before writing.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ORB_DIR="$HOME/.claude-orb"
SETTINGS="$HOME/.claude/settings.json"

mkdir -p "$ORB_DIR" "$HOME/.claude"
install -m 0755 "$HERE/update-status.sh" "$ORB_DIR/update-status.sh"
echo "installed $ORB_DIR/update-status.sh"

# Seed a status file so the orb has something to read on first launch.
if [ ! -f "$ORB_DIR/status.json" ]; then
  printf '{"state":"idle","project":"","timestamp":"1970-01-01T00:00:00Z","session_id":"bootstrap"}\n' \
    >"$ORB_DIR/status.json"
  echo "seeded $ORB_DIR/status.json"
fi

if [ -f "$SETTINGS" ]; then
  BACKUP="$SETTINGS.orbit-backup.$(date +%Y%m%d%H%M%S)"
  cp "$SETTINGS" "$BACKUP"
  echo "backed up settings to $BACKUP"
fi

SETTINGS="$SETTINGS" python3 - <<'PY'
import json, os

path = os.environ["SETTINGS"]
MARKER = "# orbit-hook"

try:
    with open(path) as fh:
        settings = json.load(fh)
    if not isinstance(settings, dict):
        raise ValueError("settings.json is not an object")
except FileNotFoundError:
    settings = {}

hooks = settings.setdefault("hooks", {})

# state per Claude Code hook event
EVENTS = {
    "UserPromptSubmit": "working",
    "Notification": "waiting",
    "Stop": "done",
}

for event, state in EVENTS.items():
    entries = hooks.setdefault(event, [])
    if not isinstance(entries, list):
        print(f"  ! {event} is not a list, skipping")
        continue

    # Drop any previous Orbit entries so re-running doesn't stack duplicates.
    def is_orbit(entry):
        if not isinstance(entry, dict):
            return False
        return any(
            MARKER in str(h.get("command", ""))
            for h in entry.get("hooks", [])
            if isinstance(h, dict)
        )

    entries[:] = [e for e in entries if not is_orbit(e)]
    entries.append(
        {
            "matcher": "",
            "hooks": [
                {
                    "type": "command",
                    "command": f"bash ~/.claude-orb/update-status.sh {state} {MARKER}",
                    "timeout": 5,
                }
            ],
        }
    )
    print(f"  registered {event} -> {state}")

with open(path, "w") as fh:
    json.dump(settings, fh, indent=2)
    fh.write("\n")

print(f"updated {path}")
PY

echo
echo "Done. Restart any running Claude Code sessions so they pick up the new hooks."
