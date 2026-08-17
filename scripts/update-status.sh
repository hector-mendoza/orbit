#!/usr/bin/env bash
# Orbit status writer — called from Claude Code hooks.
#
#   bash ~/.claude-orb/update-status.sh <state>
#
# Claude Code passes the hook payload (session_id, cwd, transcript_path, ...) on STDIN
# as JSON — not via environment variables — so we read stdin and pull the real session
# id, project path and transcript out of it.
#
# Token accounting: the hook payload has no token counts, but `transcript_path` points
# at a JSONL file whose assistant messages carry a `usage` block. We tail that file
# incrementally (remembering a byte offset per session) and accumulate the totals, so
# cost stays cheap no matter how long the session runs.
#
# Writes ~/.claude-orb/status.json and ~/.claude-orb/usage.json atomically (temp file +
# rename) so the orb never reads a half-written file while polling.
#
# This must never fail a hook: every path exits 0.

set -uo pipefail

STATE="${1:-done}"
ORB_DIR="$HOME/.claude-orb"
OUT="$ORB_DIR/status.json"

mkdir -p "$ORB_DIR" 2>/dev/null || exit 0

# Consume stdin whether or not there's anything there.
PAYLOAD="$(cat 2>/dev/null || true)"

if command -v python3 >/dev/null 2>&1; then
  ORB_STATE="$STATE" ORB_PAYLOAD="$PAYLOAD" ORB_OUT="$OUT" ORB_DIR="$ORB_DIR" \
    python3 - <<'PY' 2>/dev/null || exit 0
import datetime, json, os, tempfile, time

state = os.environ.get("ORB_STATE", "done")
out = os.environ["ORB_OUT"]
orb_dir = os.environ["ORB_DIR"]
usage_path = os.path.join(orb_dir, "usage.json")

# Keep at most this many sessions in usage.json so it can't grow without bound.
MAX_SESSIONS = 300


def load_json(path, default):
    try:
        with open(path) as fh:
            value = json.load(fh)
        return value if isinstance(value, dict) else default
    except (OSError, ValueError):
        return default


def write_atomic(path, data):
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), prefix=".tmp-", suffix=".json")
    try:
        with os.fdopen(fd, "w") as fh:
            json.dump(data, fh)
            fh.write("\n")
        os.replace(tmp, path)
    except Exception:
        try:
            os.unlink(tmp)
        except OSError:
            pass


raw = os.environ.get("ORB_PAYLOAD", "")
try:
    payload = json.loads(raw) if raw.strip() else {}
    if not isinstance(payload, dict):
        payload = {}
except (ValueError, TypeError):
    payload = {}

session_id = str(payload.get("session_id") or os.environ.get("CLAUDE_SESSION_ID") or "unknown")
cwd = payload.get("cwd") or os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
project = os.path.basename(str(cwd).rstrip("/")) or str(cwd)

# ---------------------------------------------------------------- token totals

usage = load_json(usage_path, {})
sessions = usage.get("sessions")
if not isinstance(sessions, dict):
    sessions = {}

entry = sessions.get(session_id)
if not isinstance(entry, dict):
    entry = {}
offset = int(entry.get("offset") or 0)
tokens = int(entry.get("tokens") or 0)

transcript = payload.get("transcript_path")
if transcript and os.path.isfile(transcript):
    try:
        size = os.path.getsize(transcript)
        # A compacted or rotated transcript is shorter than where we left off; start over.
        if size < offset:
            offset, tokens = 0, 0

        with open(transcript, "rb") as fh:
            fh.seek(offset)
            chunk = fh.read()

        # Only consume whole lines — a hook can fire while a line is still being written.
        cut = chunk.rfind(b"\n")
        if cut >= 0:
            for line in chunk[: cut + 1].splitlines():
                if not line.strip():
                    continue
                try:
                    rec = json.loads(line)
                except ValueError:
                    continue
                if not isinstance(rec, dict):
                    continue
                u = rec.get("message", {})
                u = u.get("usage") if isinstance(u, dict) else None
                if not isinstance(u, dict):
                    u = rec.get("usage")
                if not isinstance(u, dict):
                    continue
                # Cache *reads* are deliberately excluded: they dominate the raw counts
                # and cost a fraction of the rest, so including them would make the orb
                # balloon on long sessions regardless of real work done.
                tokens += (
                    int(u.get("input_tokens") or 0)
                    + int(u.get("output_tokens") or 0)
                    + int(u.get("cache_creation_input_tokens") or 0)
                )
            offset += cut + 1
    except OSError:
        pass

sessions[session_id] = {"offset": offset, "tokens": tokens, "last": int(time.time())}

# Prune the oldest sessions if we're over the cap.
if len(sessions) > MAX_SESSIONS:
    ordered = sorted(sessions.items(), key=lambda kv: kv[1].get("last", 0), reverse=True)
    sessions = dict(ordered[:MAX_SESSIONS])

total = sum(int(v.get("tokens") or 0) for v in sessions.values())
write_atomic(usage_path, {"sessions": sessions, "total": total})

# -------------------------------------------------------------- status record

write_atomic(
    out,
    {
        "state": state,
        "project": project,
        # Full path, not just the basename: the window uses this to open the project.
        "cwd": str(cwd),
        "timestamp": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "session_id": session_id,
        "tokens": tokens,
        "tokens_total": total,
    },
)
PY
  exit 0
fi

# --- Fallback with no python3: shell-only, no token accounting. ---
SESSION_ID="$(printf '%s' "$PAYLOAD" | sed -n 's/.*"session_id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)"
CWD="$(printf '%s' "$PAYLOAD" | sed -n 's/.*"cwd"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)"
[ -z "$SESSION_ID" ] && SESSION_ID="${CLAUDE_SESSION_ID:-unknown}"
[ -z "$CWD" ] && CWD="${CLAUDE_PROJECT_DIR:-$PWD}"
PROJECT="$(basename "$CWD")"
TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

TMP="$ORB_DIR/.status-$$.json"
printf '{"state":"%s","project":"%s","cwd":"%s","timestamp":"%s","session_id":"%s"}\n' \
  "$STATE" "$PROJECT" "$CWD" "$TS" "$SESSION_ID" >"$TMP" 2>/dev/null &&
  mv -f "$TMP" "$OUT" 2>/dev/null

exit 0
