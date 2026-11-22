#!/usr/bin/env python3
"""Tests for orbit_status_writer — run with: python3 scripts/test_orbit_status_writer.py"""

import json
import os
import tempfile
import unittest
from pathlib import Path

# Allow importing from scripts/
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))

import orbit_status_writer as osw  # noqa: E402


class OrbitStatusWriterTests(unittest.TestCase):
    def test_claude_payload(self) -> None:
        payload = {
            "session_id": "abc",
            "cwd": "/home/dev/myapp",
            "transcript_path": None,
        }
        with tempfile.TemporaryDirectory() as tmp:
            orb = Path(tmp)
            rec = osw.build_record("working", "claude-code", payload, orb)
            self.assertEqual(rec["state"], "working")
            self.assertEqual(rec["source"], "claude-code")
            self.assertEqual(rec["session_id"], "abc")
            self.assertEqual(rec["project"], "myapp")
            self.assertEqual(rec["cwd"], "/home/dev/myapp")

    def test_cursor_payload(self) -> None:
        payload = {
            "conversation_id": "conv-1",
            "workspace_roots": ["/workspace/orbit"],
            "hook_event_name": "beforeSubmitPrompt",
            "transcript_path": None,
        }
        with tempfile.TemporaryDirectory() as tmp:
            orb = Path(tmp)
            rec = osw.build_record("working", "cursor", payload, orb)
            self.assertEqual(rec["source"], "cursor")
            self.assertEqual(rec["session_id"], "conv-1")
            self.assertEqual(rec["project"], "orbit")

    def test_writes_per_source_file(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            orb = Path(tmp)
            osw.write_status("done", "cursor", "{}", orb)
            src = orb / "sources" / "cursor.json"
            legacy = orb / "status.json"
            self.assertTrue(src.is_file())
            self.assertTrue(legacy.is_file())
            data = json.loads(src.read_text())
            self.assertEqual(data["state"], "done")

    def test_token_tail_from_transcript(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            orb = Path(tmp)
            transcript = orb / "t.jsonl"
            line = json.dumps(
                {
                    "message": {
                        "usage": {
                            "input_tokens": 10,
                            "output_tokens": 5,
                        }
                    }
                }
            )
            transcript.write_text(line + "\n")
            payload = {
                "session_id": "s1",
                "cwd": tmp,
                "transcript_path": str(transcript),
            }
            rec = osw.build_record("working", "claude-code", payload, orb)
            self.assertEqual(rec["tokens"], 15)
            self.assertEqual(rec["tokens_total"], 15)


if __name__ == "__main__":
    unittest.main()