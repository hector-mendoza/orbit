#!/usr/bin/env python3
"""Register Orbit hooks in ~/.cursor/hooks.json (Cursor agent lifecycle)."""

from __future__ import annotations

import datetime
import json
from pathlib import Path

MARKER = "# orbit-cursor-hook"
WRITER = "~/.claude-orb/update-status.sh"

# Map Cursor hook events to Orbit states. Permission-style hooks become "waiting"
# so the pet glows amber while you may need to approve a command or tool.
EVENTS = {
    "beforeSubmitPrompt": "working",
    "preToolUse": "working",
    "postToolUse": "working",
    "afterFileEdit": "working",
    "afterAgentResponse": "working",
    "afterAgentThought": "working",
    "afterShellExecution": "working",
    "afterMCPExecution": "working",
    "subagentStart": "working",
    "beforeShellExecution": "waiting",
    "beforeMCPExecution": "waiting",
    "beforeReadFile": "waiting",
    "stop": "done",
    "sessionEnd": "done",
}


def is_orbit_hook(entry: dict) -> bool:
    if not isinstance(entry, dict):
        return False
    cmd = entry.get("command", "")
    return isinstance(cmd, str) and MARKER in cmd


def main() -> None:
    cursor_dir = Path.home() / ".cursor"
    hooks_path = cursor_dir / "hooks.json"
    cursor_dir.mkdir(parents=True, exist_ok=True)

    if hooks_path.is_file():
        with hooks_path.open() as fh:
            try:
                cfg = json.load(fh)
            except (json.JSONDecodeError, OSError):
                cfg = {}
        ts = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
        backup_path = hooks_path.parent / f"{hooks_path.name}.orbit-backup.{ts}"
        backup_path.write_text(json.dumps(cfg, indent=2) + "\n")
        print(f"backed up hooks to {backup_path}")
    else:
        cfg = {"version": 1, "hooks": {}}

    if not isinstance(cfg, dict):
        cfg = {"version": 1, "hooks": {}}
    cfg.setdefault("version", 1)
    hooks = cfg.setdefault("hooks", {})
    if not isinstance(hooks, dict):
        hooks = {}
        cfg["hooks"] = hooks

    for event, state in EVENTS.items():
        entries = hooks.setdefault(event, [])
        if not isinstance(entries, list):
            print(f"  ! {event} is not a list, skipping")
            continue
        entries[:] = [e for e in entries if not is_orbit_hook(e)]
        entries.append(
            {
                "command": f'bash {WRITER} {state} cursor {MARKER}',
            }
        )
        print(f"  registered {event} -> {state}")

    with hooks_path.open("w") as fh:
        json.dump(cfg, fh, indent=2)
        fh.write("\n")
    print(f"updated {hooks_path}")


if __name__ == "__main__":
    main()