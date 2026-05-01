/**
 * Pure Node.js PNG icon generator (no external deps).
 * Generates 192×192 and 512×512 icons for the PWA manifest.
 */
import { deflateSync } from 'zlib';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '../public/icons');
mkdirSync(OUT, { recursive: true });

// ── CRC32 ──────────────────────────────────────────────────────────────────
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ CRC_TABLE[(c ^ buf[i]) & 0xff];
  return (c ^ 0xffffffff) >>> 0;
}

// ── PNG encoder ────────────────────────────────────────────────────────────
function pngChunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4); lenBuf.writeUInt32BE(data.length);
  const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([lenBuf, t, data, crcBuf]);
}

function encodePNG(rgba, w, h) {
  // Raw rows with filter byte 0 (None) prepended
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const idat = deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Icon design ────────────────────────────────────────────────────────────
// Moon + deep sea: dark navy bg, stars, glowing orb, water waves, reflection
function drawIcon(size) {
  const buf = Buffer.alloc(size * size * 4);
  const s   = size;

  // Design params (normalised 0-1)
  const ORB_X = 0.50, ORB_Y = 0.42, ORB_R = 0.18;
  const GLOW_R = 0.33;
  const STARS  = [
    [0.20, 0.19, 1.0], [0.76, 0.13, 0.8], [0.86, 0.33, 0.9],
    [0.13, 0.51, 0.7], [0.83, 0.56, 0.8], [0.63, 0.10, 0.7],
    [0.32, 0.60, 0.5], [0.90, 0.21, 0.6],
  ];

  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const idx = (y * s + x) * 4;
      const nx  = (x + 0.5) / s;
      const ny  = (y + 0.5) / s;

      // Circular distance (for clipping)
      const circD = Math.sqrt((nx - 0.5) ** 2 + (ny - 0.5) ** 2) * 2;

      // Orb distance
      const odx = nx - ORB_X, ody = ny - ORB_Y;
      const orbD = Math.sqrt(odx * odx + ody * ody);

      // ── Background: very dark navy ────────────────────────────────────
      let r = 0, g = 5, b = Math.round(14 - ny * 4), a = 255;

      // ── Stars ─────────────────────────────────────────────────────────
      for (const [sx, sy, br] of STARS) {
        if (sy > 0.61) continue;
        const sd = Math.sqrt((nx - sx) ** 2 + (ny - sy) ** 2) * s;
        if (sd < 1.4) {
          const sf = (1 - sd / 1.4) ** 2 * br;
          r = Math.min(255, r + Math.round(240 * sf));
          g = Math.min(255, g + Math.round(240 * sf));
          b = Math.min(255, b + Math.round(255 * sf));
        }
      }

      // ── Glow halo ─────────────────────────────────────────────────────
      if (orbD < GLOW_R) {
        const gt = (1 - orbD / GLOW_R) ** 2;
        r = Math.min(255, r + Math.round(20  * gt));
        g = Math.min(255, g + Math.round(90  * gt));
        b = Math.min(255, b + Math.round(180 * gt));
      }

      // ── Orb ring ───────────────────────────────────────────────────────
      const ringDist = Math.abs(orbD - ORB_R);
      if (ringDist < 0.012) {
        const rt = 1 - ringDist / 0.012;
        r = Math.min(255, r + Math.round(30  * rt));
        g = Math.min(255, g + Math.round(120 * rt));
        b = Math.min(255, b + Math.round(220 * rt));
      }

      // ── Orb body ───────────────────────────────────────────────────────
      if (orbD < ORB_R) {
        const t  = orbD / ORB_R;
        // Highlight (upper-left quadrant)
        const hlDx = nx - (ORB_X - ORB_R * 0.28);
        const hlDy = ny - (ORB_Y - ORB_R * 0.32);
        const hl   = Math.max(0, 1 - Math.sqrt(hlDx ** 2 + hlDy ** 2) / (ORB_R * 0.45)) ** 2;
        // Core orb colour (teal→blue, brighter at centre)
        const or = Math.round(15  + 35  * (1 - t));
        const og = Math.round(130 + 70  * (1 - t));
        const ob = Math.round(210 + 45  * (1 - t));
        const mix = 1 - t * t * 0.15;
        r = Math.min(255, Math.round(r * (1 - mix) + (or + 200 * hl) * mix));
        g = Math.min(255, Math.round(g * (1 - mix) + (og + 80  * hl) * mix));
        b = Math.min(255, Math.round(b * (1 - mix) + (ob + 45  * hl) * mix));
      }

      // ── Water & reflection ────────────────────────────────────────────
      if (ny > 0.63) {
        // Soft orb reflection
        const reflT = Math.max(0, 1 - Math.sqrt((nx - 0.5) ** 2 + (ny - 0.68) ** 2) / 0.12) ** 2;
        r = Math.min(255, r + Math.round(15  * reflT));
        g = Math.min(255, g + Math.round(70  * reflT));
        b = Math.min(255, b + Math.round(140 * reflT));

        // Wave 1
        const w1y = 0.68 + Math.sin((nx - 0.5) * Math.PI * 4) * 0.016;
        const w1d = Math.abs(ny - w1y) * s;
        if (w1d < 1.2) {
          const wt = (1 - w1d / 1.2) * Math.max(0, 0.85 - Math.abs(nx - 0.5) * 1.5);
          r = Math.min(255, r + Math.round(25  * wt));
          g = Math.min(255, g + Math.round(100 * wt));
          b = Math.min(255, b + Math.round(190 * wt));
        }

        // Wave 2
        const w2y = 0.77 + Math.sin((nx - 0.3) * Math.PI * 3) * 0.012;
        const w2d = Math.abs(ny - w2y) * s;
        if (w2d < 1.0) {
          const wt = (1 - w2d / 1.0) * Math.max(0, 0.70 - Math.abs(nx - 0.5) * 1.5);
          r = Math.min(255, r + Math.round(15 * wt));
          g = Math.min(255, g + Math.round(60 * wt));
          b = Math.min(255, b + Math.round(120 * wt));
        }
      }

      // ── Circular clip with soft AA edge ───────────────────────────────
      if (circD > 1) {
        a = 0;
      } else if (circD > 0.96) {
        a = Math.round(255 * (1 - (circD - 0.96) / 0.04));
      }

      buf[idx]     = Math.min(255, Math.max(0, r));
      buf[idx + 1] = Math.min(255, Math.max(0, g));
      buf[idx + 2] = Math.min(255, Math.max(0, b));
      buf[idx + 3] = a;
    }
  }
  return buf;
}

// ── Generate both sizes ────────────────────────────────────────────────────
for (const size of [192, 512]) {
  const pixels = drawIcon(size);
  const png    = encodePNG(pixels, size, size);
  const out    = join(OUT, `icon-${size}.png`);
  writeFileSync(out, png);
  console.log(`✓ ${out}  (${png.length} bytes)`);
}
