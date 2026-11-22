#!/usr/bin/env python3
"""Write Orbit per-source status files from hook stdin payloads (Claude Code, Cursor, …)."""

from __future__ import annotations

import argparse
import datetime
import json
import os
import sys
import tempfile
import time
from pathlib import Path
from typing import Any

MAX_SESSIONS = 300
VALID_STATES = frozenset({"working", "waiting", "done", "idle"})


def load_json(path: Path, default: dict) -> dict:
    try:
        with path.open() as fh:
            value = json.load(fh)
        return value if isinstance(value, dict) else default
    except (OSError, ValueError, TypeError):
        return default


def write_atomic(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(
        dir=path.parent, prefix=".tmp-", suffix=".json"
    )
    try:
        with os.fdopen(fd, "w") as fh:
            json.dump(data, fh)
            fh.write("\n")
        os.replace(tmp_name, path)
    except OSError:
        try:
            os.unlink(tmp_name)
        except OSError:
            pass


def parse_payload(raw: str) -> dict:
    try:
        payload = json.loads(raw) if raw.strip() else {}
        return payload if isinstance(payload, dict) else {}
    except (ValueError, TypeError):
        return {}


def resolve_session_id(source: str, payload: dict) -> str:
    if source == "cursor":
        for key in ("conversation_id", "session_id", "generation_id"):
            val = payload.get(key)
            if val:
                return str(val)
    for key in ("session_id", "conversation_id"):
        val = payload.get(key)
        if val:
            return str(val)
    return (
        os.environ.get("CLAUDE_SESSION_ID")
        or os.environ.get("CURSOR_CONVERSATION_ID")
        or "unknown"
    )


def resolve_cwd(payload: dict) -> str:
    cwd = payload.get("cwd")
    if cwd:
        return str(cwd)
    roots = payload.get("workspace_roots")
    if isinstance(roots, list) and roots:
        return str(roots[0])
    return os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()


def accumulate_tokens(
    usage_path: Path, session_id: str, transcript: str | None
) -> tuple[int, int]:
    usage = load_json(usage_path, {})
    sessions = usage.get("sessions")
    if not isinstance(sessions, dict):
        sessions = {}

    entry = sessions.get(session_id)
    if not isinstance(entry, dict):
        entry = {}
    offset = int(entry.get("offset") or 0)
    tokens = int(entry.get("tokens") or 0)

    if transcript and os.path.isfile(transcript):
        try:
            size = os.path.getsize(transcript)
            if size < offset:
                offset, tokens = 0, 0

            with open(transcript, "rb") as fh:
                fh.seek(offset)
                chunk = fh.read()

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
                    tokens += (
                        int(u.get("input_tokens") or 0)
                        + int(u.get("output_tokens") or 0)
                        + int(u.get("cache_creation_input_tokens") or 0)
                    )
                offset += cut + 1
        except OSError:
            pass

    sessions[session_id] = {"offset": offset, "tokens": tokens, "last": int(time.time())}

    if len(sessions) > MAX_SESSIONS:
        ordered = sorted(
            sessions.items(), key=lambda kv: kv[1].get("last", 0), reverse=True
        )
        sessions = dict(ordered[:MAX_SESSIONS])

    total = sum(int(v.get("tokens") or 0) for v in sessions.values())
    write_atomic(usage_path, {"sessions": sessions, "total": total})
    return tokens, total


def build_record(
    state: str, source: str, payload: dict, orb_dir: Path
) -> dict[str, Any]:
    if state not in VALID_STATES:
        state = "working"

    session_id = resolve_session_id(source, payload)
    cwd = resolve_cwd(payload)
    project = os.path.basename(str(cwd).rstrip("/")) or str(cwd)

    usage_path = orb_dir / "usage.json"
    transcript = payload.get("transcript_path")
    if isinstance(transcript, str) and transcript:
        tokens, total = accumulate_tokens(usage_path, session_id, transcript)
    else:
        usage = load_json(usage_path, {})
        sessions = usage.get("sessions") if isinstance(usage.get("sessions"), dict) else {}
        entry = sessions.get(session_id, {}) if isinstance(sessions, dict) else {}
        tokens = int(entry.get("tokens") or 0) if isinstance(entry, dict) else 0
        total = int(usage.get("total") or tokens)

    return {
        "state": state,
        "source": source,
        "project": project,
        "cwd": str(cwd),
        "timestamp": datetime.datetime.now(datetime.timezone.utc).strftime(
            "%Y-%m-%dT%H:%M:%SZ"
        ),
        "session_id": session_id,
        "tokens": tokens,
        "tokens_total": total,
    }


def write_status(state: str, source: str, payload_raw: str, orb_dir: Path) -> None:
    payload = parse_payload(payload_raw)
    record = build_record(state, source, payload, orb_dir)
    source_path = orb_dir / "sources" / f"{source}.json"
    write_atomic(source_path, record)
    # Legacy path — still updated so older Orbit builds keep working.
    write_atomic(orb_dir / "status.json", record)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("state", help="working | waiting | done | idle")
    parser.add_argument(
        "source",
        nargs="?",
        default="claude-code",
        help="status source id (default: claude-code)",
    )
    parser.add_argument(
        "--orb-dir",
        default=os.environ.get("ORB_DIR", ""),
        help="override ~/.claude-orb",
    )
    args = parser.parse_args(argv)

    orb_dir = Path(
        args.orb_dir or os.path.join(os.path.expanduser("~"), ".claude-orb")
    )
    payload_raw = sys.stdin.read()
    try:
        write_status(args.state, args.source, payload_raw, orb_dir)
    except OSError:
        pass
    return 0


if __name__ == "__main__":
    raise SystemExit(main())