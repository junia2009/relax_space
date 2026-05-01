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
// Dark background + soft centered glow + thin outer ring
function drawIcon(size) {
  const buf = Buffer.alloc(size * size * 4);
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;
  const R  = size / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dx  = (x - cx) / R;
      const dy  = (y - cy) / R;
      const d   = Math.sqrt(dx * dx + dy * dy); // 0 = center, 1 = edge

      // Base: very dark deep-sea blue — fills the full square (maskable-safe)
      let r = 0, g = 8, b = 20, a = 255;

      // Central glow (radial, soft)
      const glowT = Math.max(0, 1 - d / 0.55);
      const glow2 = glowT * glowT;
      r = Math.min(255, r + Math.round(44  * glow2));
      g = Math.min(255, g + Math.round(162 * glow2));
      b = Math.min(255, b + Math.round(235 * glow2));

      // Thin ring at ~70% radius
      const ringDist = Math.abs(d - 0.70);
      const ringT    = Math.max(0, 1 - ringDist / 0.025);
      r = Math.min(255, r + Math.round(20  * ringT * 0.6));
      g = Math.min(255, g + Math.round(110 * ringT * 0.6));
      b = Math.min(255, b + Math.round(200 * ringT * 0.6));

      // Circular clipping for the "any" variant: fade corners to transparent
      // (keep a=255 inside circle, fade outside — the 512 will be maskable too)
      if (d > 1) a = 0;

      buf[idx]     = r;
      buf[idx + 1] = g;
      buf[idx + 2] = b;
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
