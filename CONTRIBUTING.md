# Contributing to Orbit

Thanks for taking a look. This is a small project — issues and PRs are welcome, and adding
a new creature is genuinely easy.

## Getting set up

```bash
npm install
npm run install-hooks    # registers the Claude Code hooks (backs up settings.json first)
npm run dev
```

You need Node 18+, a Rust toolchain, and macOS for the full experience. See the
[README](README.md#requirements).

## The fast feedback loop

Rebuilding the Tauri app for a visual tweak is slow. The renderer runs standalone in a
browser, and that's where most work should happen:

```bash
npm run preview     # serves src/ on :4317
```

- `?state=waiting` — pin a state instead of cycling
- `?skin=cat` — pin a skin
- `?tokens=25000000` — pin a token count, to check growth scaling
- `proto-growth.html` — every skin across the whole growth curve at once
- `proto-<name>.html` — one skin, all four states side by side

Only reach for `npm run dev` once it looks right in the browser, to confirm it behaves in
a real transparent always-on-top window.

## Before opening a PR

```bash
npm run lint:rust                     # fmt + clippy, both enforced in CI
for f in src/*.js; do node --check "$f"; done
```

CI runs those plus `shellcheck --severity=error` on the scripts. There is no test suite:
this is a visual widget with no bundler, so **the automated gates only check that code
parses and compiles**. Verifying that it *looks and behaves* right is manual — say what
you checked in the PR, and attach a screenshot or recording for anything visual.

Please check all four states (`working`, `waiting`, `done`, `idle`). It's easy to fix one
state and break another, since they share the same pose and shading code.

## Adding a skin

A skin is one file that registers itself into `SKINS` and exposes two things:

```js
SKINS.myskin = {
  label: "My skin",              // shown in the tray
  burstOrigin: (scale) => [x, y], // where confetti launches from
  draw(ctx, cfg, state, now, dt, pose) { /* ... */ },
};
```

Everything else — the state machine, growth scaling, confetti, the glow, click/drag — you
get for free. `render-core.js` provides pixel primitives, the three-tone shading, faces,
and the shared per-state motion (`basePose`), so skins stay visually consistent.

Register it in three places:
1. a `<script>` tag in `src/index.html`
2. `SKIN_ORDER` in `src/orb.js` (right-click cycle order)
3. the `SKINS` array in `src-tauri/src/lib.rs` (tray menu)

### What makes a good skin

- **One moving feature that signals state without colour.** A moon's orbit speed, a cat's
  ears, a ghost's hem. Colour alone doesn't read from across the room, and it excludes
  colourblind users. This is the single most important constraint.
- **It has to survive being small.** Growth scales the creature down to ~34% of full size.
  Pixel art doesn't scale smoothly — below a certain size a face has to *lose detail*
  rather than shrink. See `drawFaceSized`, and how the planet drops its surface patches.
- **Respect `pose.scale`.** Every dimension should derive from it, or your skin will be the
  wrong size for everyone but you.

### Pixel or smooth?

Skins default to pixel art: they draw into a low-resolution offscreen buffer that gets
nearest-neighbour upscaled. Set `smooth: true` (as `bloub` does) to be drawn directly onto
the visible canvas at device resolution instead, for vector shapes and antialiasing. Don't
mix approaches within one skin — a smooth body with pixel-stepped details looks like a bug.

## Touching the hook script

`scripts/update-status.sh` runs inside every Claude Code session, so two rules are
absolute:

1. **Every path exits `0`.** A non-zero exit surfaces as a hook failure in someone's
   session. Missing files, malformed stdin, no python3 — all must degrade quietly.
2. **Writes are atomic** (temp file + rename). The window polls that file; a partial read
   would show a broken state.

Test it directly rather than through a real session:

```bash
echo '{"session_id":"t1","cwd":"'"$PWD"'","transcript_path":"/path/to/transcript.jsonl"}' \
  | bash scripts/update-status.sh working
cat ~/.claude-orb/status.json
```

Worth testing: empty stdin, malformed JSON, a missing transcript, and a transcript that
gets truncated mid-line.

## Third-party work

If a contribution derives from someone else's artwork or code — a skin traced from an
existing design, a snippet lifted from another project — add it to
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) with the source, the license, and what
exactly was used. Most permissive licenses require their copyright notice to travel with
the work, so this isn't just courtesy. Please also check the license actually permits
reuse before opening the PR.

## Cutting a release

Releases are built by CI, not by hand — push a version tag:

```bash
git tag v0.2.0
git push origin v0.2.0
```

[`.github/workflows/release.yml`](.github/workflows/release.yml) builds a **universal**
macOS binary (Intel + Apple Silicon), creates a **draft** release, and attaches the `.dmg`.
Review the draft, then publish it.

Builds are **unsigned and un-notarized**, so downloaders hit a Gatekeeper warning; the
release notes explain the workaround. To fix that properly, add the Apple secrets
(`APPLE_CERTIFICATE`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`,
`APPLE_TEAM_ID`, …) to the repository and reference them in the workflow's `env` — the
workflow is written so that's the only change needed.

Bump the version in **both** `package.json` and `src-tauri/tauri.conf.json` before tagging;
the tag and the bundle version should agree.

## Style

- Match the surrounding code; there's no linter for the JS beyond a parse check.
- Comment the *why*, especially where a value was calibrated or a naive approach failed.
  Much of this code has non-obvious constraints (confetti arc height is bounded by canvas
  headroom; the moon's orbit must clear the planet's silhouette) and those comments are
  what stop someone "simplifying" them back into bugs.
- Rust is `cargo fmt` default, clippy-clean under `-D warnings`.
