<div align="center">

<img src="docs/icon.png" width="120" height="120" alt="Orbit app icon: two pale capsule eyes on a dark navy rounded square">

# Orbit

**A desktop pet that shows what your Claude Code sessions are doing.**

[![License: MIT](https://img.shields.io/badge/License-MIT-8fb0f9.svg)](LICENSE)
[![Buy me a coffee](https://img.shields.io/badge/Buy%20me%20a%20coffee-%E2%98%95-f0a63c.svg)](https://buymeacoffee.com/hectormendoza)

A small creature floats above your desktop in a transparent, always-on-top window. It
turns amber and fidgets when a session needs you, throws confetti when one finishes, and
dozes off when nothing is happening. It grows as you use it.

</div>

---

## What it does

- **Shows the most recent state across all your sessions** — one pet, not one per session.
- **Four states**: working, waiting on you, done, idle.
- **Grows with tokens spent** — tiny on first run, fully grown after months of use.
- **Click it** to open the current project in your editor.
- **Four looks**, switchable from the tray.
- Lives in the menu bar. No Dock icon, no window chrome, no taskbar entry.

| State     | Trigger                     | Behaviour                                                  |
| --------- | --------------------------- | ---------------------------------------------------------- |
| `working` | `UserPromptSubmit` hook     | Gentle breathing bob, occasional glance to one side        |
| `waiting` | `Notification` hook         | Eyes widen, bursts of shake, amber glow                    |
| `done`    | `Stop` hook                 | Happy hops, a confetti burst, green glow                   |
| `idle`    | No update in the last 5 min | Still, with a slow blink                                   |

## Requirements

- **macOS** (Windows and Linux are wired up but untested — see [Platform support](#platform-support))
- **Node.js** 18+
- **Rust** — Tauri compiles a native shell:
  ```bash
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
  ```
- **Claude Code**, for the hooks to fire

## Install

### Download the app

Grab the `.dmg` from [**Releases**](https://github.com/hector-mendoza/orbit/releases),
open it, and drag Orbit to Applications. Then wire up the hooks:

```bash
curl -fsSL https://raw.githubusercontent.com/hector-mendoza/orbit/main/scripts/install.sh | bash
```

That registers the Claude Code hooks and downloads the status writer into
`~/.claude-orb/`. **Restart any running Claude Code sessions** afterwards.

> [!IMPORTANT]
> **macOS will say the app can't be verified.** Orbit isn't signed with an Apple
> Developer certificate — that needs a paid account — so Gatekeeper blocks it the first
> time with *"Apple could not verify Orbit is free of malware."*
>
> To open it anyway: try to open Orbit once and dismiss the warning, then go to
> **System Settings → Privacy & Security**, scroll to the message about Orbit, and click
> **Open Anyway**. Or from a terminal:
>
> ```bash
> xattr -dr com.apple.quarantine /Applications/Orbit.app
> ```
>
> Once per installed version. If you'd rather not trust a prebuilt binary, building from
> source below avoids the question entirely.

### Or build from source

```bash
git clone https://github.com/hector-mendoza/orbit.git
cd orbit
npm install
npm run install-hooks    # writes ~/.claude-orb/ and registers the Claude Code hooks
npm run dev              # first build takes a few minutes; later runs are fast
```

Either way, `install-hooks` appends to whatever hooks you already have in
`~/.claude/settings.json`, backs the file up first, and is safe to re-run — Orbit's own
entries are replaced rather than duplicated. **Restart any running Claude Code sessions**
so they pick the hooks up.

For a real app you can launch without a terminal:

```bash
npm run build
cp -R src-tauri/target/release/bundle/macos/Orbit.app /Applications/
```

Then launch it from `/Applications` and turn on **Open at Login** from the tray. Enable it
from the installed app rather than `npm run dev` — the login item records the path of
whatever binary is running, and a `target/debug` path breaks on the next `cargo clean`.

## Using it

| Action | Result |
| --- | --- |
| **Click** | Opens the current project in your editor |
| **Drag** | Moves the window |
| **Right-click** | Cycles through the skins |
| **Tray icon** | Skin picker, Open at Login, Hide / Show orb, Buy me a coffee, Quit |

There is no close button. Hide the orb from the tray if you want it gone without
quitting; quit from the tray to stop the process.

Click and drag are told apart by how far the pointer travels while held (4px threshold).
Tauri's `data-tauri-drag-region` can't be used for this: it begins a native drag on
mousedown and swallows the click entirely.

**Editor preference** for click-to-open, in order: an `editor` name in
`~/.claude-orb/config.json`, then Cursor, then VS Code, then whatever the OS does with a
folder. Set it explicitly if you like — config writes merge, so this won't disturb `skin`:

```json
{ "editor": "Visual Studio Code" }
```

## Looks

Switch from the tray under **Look**, or right-click the window to cycle. The choice
persists in `~/.claude-orb/config.json`.

| Skin | What carries the state, beyond colour |
| --- | --- |
| `planet` *(default)* | A moon orbits — fast when working, parked overhead when waiting, crawling when idle |
| `cat` | Ears perk, pin flat, or fold; tail flicks and stands straight up when pleased |
| `ghost` | A rippling hem — calm, agitated, or barely moving; rears up tall when waiting |
| `bloub` | Ink cloud, from a reference SVG. The only **smooth** skin — see [Architecture](#architecture) |

Each skin deliberately has one moving feature that signals state *without* relying on
colour, so it reads at a glance from across the room.

## Growth

The creature starts small and grows with tokens spent.

Hook payloads carry no token counts, but they do carry `transcript_path`, and the
assistant messages in that JSONL have `usage` blocks. `update-status.sh` tails that file
**incrementally** — remembering a byte offset per session in `~/.claude-orb/usage.json`
and reading only what's new — so accounting stays cheap however long a session runs. It
handles a partially written last line (a hook can fire mid-write) and a compacted
transcript (shorter than the stored offset ⇒ start over).

Cache **reads** are excluded from the metric. They dominate the raw numbers and cost a
fraction of the rest, so counting them would balloon the creature on long sessions
regardless of real work done. The metric is `input + output + cache_creation`.

Growth is logarithmic — linear scaling would leave it microscopic for a day, then peg at
maximum forever. Configure in [`src/config.js`](src/config.js):

| `GROWTH_SOURCE` | Counts | Range | Feel |
| --- | --- | --- | --- |
| `total` *(default)* | Lifetime, all sessions | 50k → 100M tokens | A pet that grows as you use it |
| `session` | Current session only | 10k → 2M tokens | Grows as this session gets expensive |

The ranges are calibrated against real transcripts: one long working session runs to well
over a million tokens, so the lifetime scale has to span far more than the session one.
The token count shows in the readout pill, so the size is never a mystery.

## Architecture

```
src/                    the window — plain HTML/CSS/JS, no bundler
  index.html
  config.js             grid, palette, per-state colours, growth curve
  render-core.js        pixel primitives, three-tone shading, faces, confetti, shared motion
  skin-planet.js        \
  skin-cat.js            |  one file per creature; each exposes draw() + burstOrigin()
  skin-ghost.js          |
  skin-bloub.js         /
  orb.js                driver: status polling, state machine, frame loop, input
  proto-*.html          standalone concept prototypes (not shipped in the window)
src-tauri/              Tauri v2 shell
  src/lib.rs            read_status / get_skin / set_skin / open_project / quit, tray menu
  tauri.conf.json       window + bundle config
  Info.plist            LSUIElement — keeps it out of the Dock
scripts/
  update-status.sh      the hook script: writes status.json from the hook's stdin payload
  install.sh            installs it and registers the hooks
  gen-icons.mjs         generates every app/tray icon from scratch (no image deps)
```

**Skins are pluggable.** `SKINS` is a registry; a skin provides `draw()` and
`burstOrigin()` and inherits the state machine, growth scaling, confetti, and glow for
free. Adding one is a new file plus a line in the tray list.

**Two render paths.** Pixel-art skins draw into a low-resolution offscreen buffer that
gets nearest-neighbour upscaled, which is what keeps them crisp. A skin that sets
`smooth: true` (currently just `bloub`) is instead drawn straight onto the visible canvas
at device resolution with a transform, so vector shapes stay antialiased. Routing a vector
skin through the pixel buffer is exactly what would pixelate it.

**Rust owns persisted settings.** Both the tray and the window's right-click go through
`set_skin`, which writes the config, updates the tray checkmarks, and broadcasts a
`skin-changed` event — so the menu and the screen can't drift apart.

## The status file

`~/.claude-orb/status.json`, written atomically (temp file + rename) so the window never
reads a half-written file while polling:

```json
{
  "state": "done",
  "project": "orbit",
  "cwd": "/Users/you/Developer/orbit",
  "timestamp": "2026-08-17T21:15:18Z",
  "session_id": "abc-123",
  "tokens": 128400,
  "tokens_total": 1364395
}
```

Claude Code passes `session_id`, `cwd`, and `transcript_path` on **stdin** as JSON — not
via environment variables — which is why the hook script reads stdin. Every code path in
that script exits `0`, so a hook can never fail your session.

If several sessions write at once, out-of-order writes are ignored: an older timestamp
never replaces a newer one already on screen.

## Developing

The renderer runs standalone in a browser, which is much faster than rebuilding the app:

```bash
npm run preview     # serves src/ on :4317
```

- `http://localhost:4317/` — cycles all four states every 3.5s
- `?state=waiting&skin=cat` — pin a state and skin
- `?tokens=25000000` — pin a token count to test growth scaling
- `proto-growth.html` — every skin across the whole growth curve
- `proto-planet.html`, `proto-cat.html`, `proto-ghost.html`, `proto-bloub.html` — all four
  states side by side. `proto-drone.html` and `proto-dino.html` are concepts that weren't
  taken forward.

Regenerate icons after changing `gen-icons.mjs`:

```bash
npm run icons
```

## Platform support

| | macOS | Windows | Linux |
| --- | --- | --- | --- |
| Window, tray, always-on-top | ✅ | ✅ | ✅ |
| Transparent background | ✅ | ✅ | ⚠️ needs a compositor |
| Open at Login | ✅ | ✅ | ✅ |
| Hidden from Dock/taskbar | ✅ | ✅ | ✅ |
| Click to open project | ✅ | ✅ | ✅ |
| `update-status.sh` | ✅ | ⚠️ needs bash (Git Bash/WSL) | ✅ |

**Only macOS has actually been run.** The Rust resolves the home directory from `HOME` or
`USERPROFILE`, so paths are right on all three, and the editor-opening code has per-OS
branches. The genuinely non-portable piece is the hook script: it's bash + python3, so on
Windows Claude Code needs a shell that has bash, or the script needs a PowerShell twin.

**Open at Login** on macOS writes `~/Library/LaunchAgents/Orbit.plist` (label `Orbit`,
pointing at the executable inside the bundle) — a registry Run key on Windows, a
`.desktop` autostart entry on Linux.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Bug reports and skin contributions welcome — a new
skin is genuinely one small file.

## Credits

The **`bloub`** skin is derived from [**bloub** by Jérémy Perret](https://github.com/jeremy-prt/bloub)
(MIT) — an SVG recreation of the x.ai bot avatar. The cloud silhouette is that project's
own vector path data, used verbatim; the eye proportions, independent drift and vertical
blink are measured from it. Orbit adds the state mapping and a rim light so a near-black
body stays visible on a dark desktop.

Because bloub is itself a recreation of the x.ai bot avatar, that skin's shape ultimately
derives from xAI's mascot design. Orbit is not affiliated with or endorsed by xAI.

Full license texts for bundled third-party work: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Support

Orbit is free and open source under the [MIT license](LICENSE), and will stay that way —
no paid tier, no telemetry, nothing gated.

If it saves you from tabbing to a terminal to check whether Claude is done, you can
[**buy me a coffee**](https://buymeacoffee.com/hectormendoza) from the tray, or from that
link. Entirely optional — the whole thing works the same either way.

Starring the repo or sending a good bug report is just as welcome.

## License

[MIT](LICENSE) © 2026 Hector Mendoza

Bundled third-party work retains its own license — see
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
