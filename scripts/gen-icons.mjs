// Generates the Orbit app icons as real PNGs — no external image deps.
//
// The app icon is the bloub skin's eyes: two pale capsules on a dark navy plate.
// Shapes are defined analytically and supersampled 4x4 per pixel, so edges come out
// antialiased at every size rather than pixel-stepped like the old creature sprite.
//
// Two distinct outputs, because they have different jobs:
//   - icon.png / .icns / .ico  — the app icon: filled navy plate, rounded like a macOS app
//   - tray.png                 — the menu bar: eyes only on transparency, so macOS
//                                template mode can recolour it for light/dark menu bars.
//                                A filled plate here would render as a solid black blob.
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "src-tauri", "icons");
mkdirSync(OUT, { recursive: true });

// ---- tiny PNG encoder (RGBA, non-interlaced) ----
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0; // filter: none
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- palette ----
const NAVY_TOP = [22, 30, 54]; // #161e36
const NAVY_BOTTOM = [8, 11, 22]; // #080b16
const EYE = [249, 249, 249]; // matches the skin's #f9f9f9

// ---- geometry, all in fractions of the icon's edge ----
const PLATE_INSET = 0.045; // small transparent margin so it isn't edge-to-edge
const PLATE_RADIUS = 0.225; // close to the macOS squircle
// Eyes are proportionally bolder than in the skin: an icon has to read at 16px.
const EYE_H = 0.4;
const EYE_W = 0.17;
const EYE_GAP = 0.15; // centre offset from the middle, each side

/** Signed-distance test for a rounded rectangle. */
function insideRoundRect(x, y, x0, y0, x1, y1, r) {
  const qx = Math.max(x0 + r - x, 0, x - (x1 - r));
  const qy = Math.max(y0 + r - y, 0, y - (y1 - r));
  return Math.hypot(qx, qy) <= r;
}

/**
 * Renders one icon.
 * `plate` false gives the transparent, eyes-only tray variant.
 */
function render(size, { plate = true, eyeColor = EYE } = {}) {
  const out = Buffer.alloc(size * size * 4);
  const SS = 4; // 4x4 supersamples per pixel
  const inset = plate ? PLATE_INSET * size : 0;
  const p0 = inset;
  const p1 = size - inset;
  const pr = PLATE_RADIUS * size;

  // The tray variant has no plate, so scale the eyes up to fill the space instead.
  const scale = plate ? 1 : 1.5;
  const eh = EYE_H * size * scale;
  const ew = EYE_W * size * scale;
  const gap = EYE_GAP * size * scale;
  const cx = size / 2;
  const cy = size / 2;

  for (let py = 0; py < size; py++) {
    for (let pxi = 0; pxi < size; pxi++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = pxi + (sx + 0.5) / SS;
          const y = py + (sy + 0.5) / SS;

          let sr = 0;
          let sg = 0;
          let sb = 0;
          let sa = 0;

          if (plate && insideRoundRect(x, y, p0, p0, p1, p1, pr)) {
            // Vertical gradient for a little depth.
            const t = (y - p0) / (p1 - p0);
            sr = NAVY_TOP[0] + (NAVY_BOTTOM[0] - NAVY_TOP[0]) * t;
            sg = NAVY_TOP[1] + (NAVY_BOTTOM[1] - NAVY_TOP[1]) * t;
            sb = NAVY_TOP[2] + (NAVY_BOTTOM[2] - NAVY_TOP[2]) * t;
            sa = 255;
          }

          // Capsules: rounded rects whose radius is half their width.
          for (const dir of [-1, 1]) {
            const ex = cx + dir * gap;
            if (
              insideRoundRect(x, y, ex - ew / 2, cy - eh / 2, ex + ew / 2, cy + eh / 2, ew / 2)
            ) {
              sr = eyeColor[0];
              sg = eyeColor[1];
              sb = eyeColor[2];
              sa = 255;
            }
          }

          r += sr * (sa / 255);
          g += sg * (sa / 255);
          b += sb * (sa / 255);
          a += sa;
        }
      }

      const n = SS * SS;
      const alpha = a / n;
      const o = (py * size + pxi) * 4;
      // Un-premultiply so the stored colour is correct on partially covered pixels.
      const cov = alpha > 0 ? a / 255 : 1;
      out[o] = Math.round(r / cov);
      out[o + 1] = Math.round(g / cov);
      out[o + 2] = Math.round(b / cov);
      out[o + 3] = Math.round(alpha);
    }
  }
  return encodePng(size, size, out);
}

// ---- write ----
const appTargets = [
  ["32x32.png", 32],
  ["128x128.png", 128],
  ["128x128@2x.png", 256],
  ["icon.png", 512],
  ["Square30x30Logo.png", 30],
  ["Square44x44Logo.png", 44],
  ["Square71x71Logo.png", 71],
  ["Square89x89Logo.png", 89],
  ["Square107x107Logo.png", 107],
  ["Square142x142Logo.png", 142],
  ["Square150x150Logo.png", 150],
  ["Square284x284Logo.png", 284],
  ["Square310x310Logo.png", 310],
  ["StoreLogo.png", 50],
];
for (const [name, size] of appTargets) writeFileSync(join(OUT, name), render(size));

// Menu bar: eyes only, on transparency, solid black for template mode.
writeFileSync(join(OUT, "tray.png"), render(44, { plate: false, eyeColor: [0, 0, 0] }));
writeFileSync(join(OUT, "tray@2x.png"), render(88, { plate: false, eyeColor: [0, 0, 0] }));

// ---- Windows .ico (a container of PNG-encoded entries) ----
function encodeIco(sizes) {
  const images = sizes.map((size) => ({ size, data: render(size) }));
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  const entries = [];
  let offset = 6 + images.length * 16;
  for (const img of images) {
    const e = Buffer.alloc(16);
    e[0] = img.size >= 256 ? 0 : img.size; // 0 means 256
    e[1] = img.size >= 256 ? 0 : img.size;
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(img.data.length, 8);
    e.writeUInt32LE(offset, 12);
    entries.push(e);
    offset += img.data.length;
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}
writeFileSync(join(OUT, "icon.ico"), encodeIco([16, 32, 48, 64, 128, 256]));

// iconset for `iconutil` (macOS .icns), written even on other platforms — harmless.
const setDir = join(OUT, "orbit.iconset");
mkdirSync(setDir, { recursive: true });
for (const [name, size] of [
  ["icon_16x16.png", 16], ["icon_16x16@2x.png", 32],
  ["icon_32x32.png", 32], ["icon_32x32@2x.png", 64],
  ["icon_128x128.png", 128], ["icon_128x128@2x.png", 256],
  ["icon_256x256.png", 256], ["icon_256x256@2x.png", 512],
  ["icon_512x512.png", 512], ["icon_512x512@2x.png", 1024],
]) writeFileSync(join(setDir, name), render(size));

console.log(`wrote ${appTargets.length} app PNGs + tray + icon.ico + orbit.iconset to ${OUT}`);
