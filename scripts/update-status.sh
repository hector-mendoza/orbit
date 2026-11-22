#!/usr/bin/env bash
# Orbit status writer — called from Claude Code or Cursor hooks.
#
#   bash ~/.claude-orb/update-status.sh <state> [source]
#
# Hook payloads arrive on STDIN as JSON. Source defaults to claude-code; use "cursor"
# for Cursor agent hooks. Writes ~/.claude-orb/sources/<source>.json and updates the
# legacy status.json for older builds.
#
# This must never fail a hook: every path exits 0.

set -uo pipefail

STATE="${1:-done}"
SOURCE="${2:-claude-code}"
ORB_DIR="${HOME}/.claude-orb"
WRITER="${ORB_DIR}/orbit_status_writer.py"

mkdir -p "$ORB_DIR" 2>/dev/null || exit 0

# Consume stdin whether or not there's anything there.
PAYLOAD="$(cat 2>/dev/null || true)"

if command -v python3 >/dev/null 2>&1 && [ -f "$WRITER" ]; then
  printf '%s' "$PAYLOAD" | python3 "$WRITER" "$STATE" "$SOURCE" --orb-dir "$ORB_DIR" \
    2>/dev/null || true
  exit 0
fi

# --- Fallback with no python3 or writer: shell-only, no token accounting. ---
OUT="$ORB_DIR/status.json"
SESSION_ID="$(printf '%s' "$PAYLOAD" | sed -n 's/.*"session_id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)"
CONV_ID="$(printf '%s' "$PAYLOAD" | sed -n 's/.*"conversation_id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)"
CWD="$(printf '%s' "$PAYLOAD" | sed -n 's/.*"cwd"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)"
[ -z "$SESSION_ID" ] && SESSION_ID="${CONV_ID:-${CLAUDE_SESSION_ID:-unknown}}"
[ -z "$CWD" ] && CWD="${CLAUDE_PROJECT_DIR:-$PWD}"
PROJECT="$(basename "$CWD")"
TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

TMP="$ORB_DIR/.status-$$.json"
printf '{"state":"%s","source":"%s","project":"%s","cwd":"%s","timestamp":"%s","session_id":"%s"}\n' \
  "$STATE" "$SOURCE" "$PROJECT" "$CWD" "$TS" "$SESSION_ID" >"$TMP" 2>/dev/null &&
  mv -f "$TMP" "$OUT" 2>/dev/null
mkdir -p "$ORB_DIR/sources" 2>/dev/null &&
  cp -f "$OUT" "$ORB_DIR/sources/${SOURCE}.json" 2>/dev/null || true

exit 0