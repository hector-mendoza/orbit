<!--
Thanks for contributing to Orbit. Fill in what's relevant and delete what isn't — a
one-line PR doesn't need every heading.
-->

## What this changes

<!-- One or two sentences. What's different after this PR? -->

## Why

<!-- The problem or motivation. Link an issue with "Closes #123" if there is one. -->

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] New skin
- [ ] Refactor / cleanup
- [ ] Docs
- [ ] Build / CI

## How it was verified

<!--
Orbit is a visual, always-on-top widget — "it compiles" isn't enough. Say what you
actually ran and saw. Screenshots or a short screen recording are the best evidence for
anything visual.
-->

- [ ] `npm run dev` — the change works in the real window
- [ ] `npm run preview` — checked in the browser (states / skins / growth)
- [ ] `cargo clippy` and `cargo fmt --check` pass
- [ ] Checked all four states: `working`, `waiting`, `done`, `idle`

<!-- Screenshots / recording: -->

## Notes for the reviewer

<!--
Anything that would be hard to work out from the diff: a tradeoff you made, something you
tried that didn't work, a follow-up you deliberately left out.
-->

---

<details>
<summary>Checklist for changes touching specific areas</summary>

**If you added or changed a skin**
- [ ] Renders correctly at the smallest and largest growth scale (`?tokens=0` and
      `?tokens=100000000`) — small sizes usually need reduced detail, not just scaling
- [ ] Registered in `src/index.html`, `SKIN_ORDER` in `src/orb.js`, and the `SKINS` array
      in `src-tauri/src/lib.rs`
- [ ] Has one moving feature that signals state without relying on colour

**If you changed the hook script**
- [ ] Still exits `0` on every path, including malformed/empty stdin
- [ ] Still writes atomically (temp file + rename)
- [ ] Tested with a real hook payload piped on stdin

**If you changed the window or input handling**
- [ ] Click and drag still behave separately
- [ ] Still has no Dock icon and stays above other windows

</details>
