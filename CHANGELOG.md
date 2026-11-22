# Changelog

All notable changes to Orbit are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.2.0] - 2026-11-22

### Added

- **Cursor agent support** via [Cursor lifecycle hooks](https://cursor.com/docs/hooks). `install.sh` registers user hooks in `~/.cursor/hooks.json` that call the same status writer as Claude Code.
- **Pluggable status sources** — each integration writes `~/.claude-orb/sources/<source>.json`; the app merges by freshest timestamp (Claude Code + Cursor today, more sources later).
- `scripts/orbit_status_writer.py` and unit tests (`scripts/test_orbit_status_writer.py`).
- **GitHub Actions release builds** for Windows (x64) and Linux (AppImage/deb) in addition to the existing macOS universal DMG.

### Changed

- README overhaul: clearer pitch, features, per-OS install, session detection, config, troubleshooting.
- `update-status.sh` accepts an optional `source` argument (`claude-code` default, `cursor` for Cursor hooks).
- Version aligned across `package.json`, `Cargo.toml`, and `tauri.conf.json`.

### Notes

- Cursor hook commands use `bash` (Git Bash or WSL on Windows). Cloud agents on remote VMs update status on that machine, not your desktop — local Cursor IDE sessions are what Orbit reflects on your machine.
- Release artifacts are **unsigned** (same as before on macOS). Draft releases are created when a `v*` tag is pushed; maintainers publish from GitHub after review.

## [0.1.1] - prior

Initial public release with Claude Code hook integration, multiple skins, growth curve, and macOS release workflow.

[Unreleased]: https://github.com/hector-mendoza/orbit/compare/v0.2.0...main
[0.2.0]: https://github.com/hector-mendoza/orbit/compare/v0.1.1...v0.2.0