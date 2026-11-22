#!/usr/bin/env bash
# Installs the Orbit status writer into ~/.claude-orb and registers the Claude Code
# hooks in ~/.claude/settings.json.
#
# Safe to re-run: existing Orbit hook entries are replaced, not duplicated, and any
# hooks you already have from other tools are left untouched. Backs up settings.json
# before writing.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || pwd)"
ORB_DIR="$HOME/.claude-orb"
SETTINGS="$HOME/.claude/settings.json"
RAW_BASE="https://raw.githubusercontent.com/hector-mendoza/orbit/main"

mkdir -p "$ORB_DIR" "$HOME/.claude"

# Normally the writer script sits next to this one. But people who installed the prebuilt
# app have no clone, so this has to work when piped straight from curl too — in that case
# fetch the writer from the repo instead of failing.
SRC="$HERE/update-status.sh"
if [ ! -f "$SRC" ]; then
  echo "update-status.sh not found locally; downloading it"
  SRC="$(mktemp)"
  if ! curl -fsSL "$RAW_BASE/scripts/update-status.sh" -o "$SRC"; then
    echo "error: could not download update-status.sh from $RAW_BASE" >&2
    exit 1
  fi
fi

install -m 0755 "$SRC" "$ORB_DIR/update-status.sh"
echo "installed $ORB_DIR/update-status.sh"

PY_SRC="$HERE/orbit_status_writer.py"
if [ ! -f "$PY_SRC" ]; then
  PY_DL="$(mktemp)"
  if curl -fsSL "$RAW_BASE/scripts/orbit_status_writer.py" -o "$PY_DL"; then
    PY_SRC="$PY_DL"
  else
  PY_SRC=""
  fi
fi
if [ -n "$PY_SRC" ] && [ -f "$PY_SRC" ]; then
  install -m 0644 "$PY_SRC" "$ORB_DIR/orbit_status_writer.py"
  echo "installed $ORB_DIR/orbit_status_writer.py"
fi

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
                    "command": f"bash ~/.claude-orb/update-status.sh {state} claude-code {MARKER}",
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

CURSOR_INSTALL="$HERE/install-cursor-hooks.py"
if [ ! -f "$CURSOR_INSTALL" ]; then
  CURSOR_DL="$(mktemp)"
  if curl -fsSL "$RAW_BASE/scripts/install-cursor-hooks.py" -o "$CURSOR_DL"; then
    CURSOR_INSTALL="$CURSOR_DL"
  else
    CURSOR_INSTALL=""
  fi
fi
if [ -n "$CURSOR_INSTALL" ] && [ -f "$CURSOR_INSTALL" ] && command -v python3 >/dev/null 2>&1; then
  echo
  echo "Registering Cursor agent hooks in ~/.cursor/hooks.json"
  python3 "$CURSOR_INSTALL" || echo "  (cursor hooks skipped — run python3 scripts/install-cursor-hooks.py later)"
fi

echo
echo "Done. Restart any running Claude Code sessions so they pick up the new hooks."
echo "Restart Cursor (or reload the window) so Cursor hooks take effect."
