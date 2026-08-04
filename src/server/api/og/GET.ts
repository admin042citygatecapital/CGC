// v2 — pure JS PNG, no native deps
import type { Request, Response } from 'express';
import { deflateSync } from 'zlib';

/**
 * GET /api/og
 * Generates a branded Open Graph image as a real PNG (1200×630).
 * Pure Node.js — no native addons, no external packages.
 * Works on Alpine/musl production containers.
 *
 * Query params:
 *   title       — page title (max 80 chars)
 *   description — page description (max 120 chars)
 */

// ─── Minimal PNG encoder ────────────────────────────────────────────────────

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBytes = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBytes, data]);
  const crcVal = Buffer.alloc(4);
  crcVal.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([len, typeBytes, data, crcVal]);
}

function encodePng(width: number, height: number, rgb: Uint8Array): Buffer {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // colour type: RGB
  // bytes 10-12 = 0 (compression, filter, interlace)

  const rowBytes = width * 3;
  const raw = Buffer.alloc(height * (1 + rowBytes));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + rowBytes)] = 0; // filter None
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 3;
      const dst = y * (1 + rowBytes) + 1 + x * 3;
      raw[dst]     = rgb[src];
      raw[dst + 1] = rgb[src + 1];
      raw[dst + 2] = rgb[src + 2];
    }
  }

  const compressed = deflateSync(raw, { level: 6 });

  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ─── Pixel canvas ────────────────────────────────────────────────────────────

const W = 1200;
const H = 630;

type RGB = [number, number, number];

class Canvas {
  private buf: Uint8Array;

  constructor() {
    this.buf = new Uint8Array(W * H * 3);
  }

  setPixel(x: number, y: number, r: number, g: number, b: number, alpha = 1) {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const i = (y * W + x) * 3;
    if (alpha >= 1) {
      this.buf[i]     = r;
      this.buf[i + 1] = g;
      this.buf[i + 2] = b;
    } else {
      this.buf[i]     = Math.round(this.buf[i]     * (1 - alpha) + r * alpha);
      this.buf[i + 1] = Math.round(this.buf[i + 1] * (1 - alpha) + g * alpha);
      this.buf[i + 2] = Math.round(this.buf[i + 2] * (1 - alpha) + b * alpha);
    }
  }

  fillRect(x: number, y: number, w: number, h: number, rgb: RGB, alpha = 1) {
    for (let py = y; py < y + h; py++) {
      for (let px = x; px < x + w; px++) {
        this.setPixel(px, py, rgb[0], rgb[1], rgb[2], alpha);
      }
    }
  }

  // Horizontal line
  hLine(x: number, y: number, len: number, rgb: RGB, alpha = 1) {
    for (let i = 0; i < len; i++) this.setPixel(x + i, y, rgb[0], rgb[1], rgb[2], alpha);
  }

  // Vertical line
  vLine(x: number, y: number, len: number, rgb: RGB, alpha = 1) {
    for (let i = 0; i < len; i++) this.setPixel(x, y + i, rgb[0], rgb[1], rgb[2], alpha);
  }

  // Rounded rect outline
  roundRect(x: number, y: number, w: number, h: number, r: number, rgb: RGB, alpha = 1) {
    // Straight edges
    this.hLine(x + r, y,         w - 2 * r, rgb, alpha);
    this.hLine(x + r, y + h - 1, w - 2 * r, rgb, alpha);
    this.vLine(x,         y + r, h - 2 * r, rgb, alpha);
    this.vLine(x + w - 1, y + r, h - 2 * r, rgb, alpha);
    // Corners (quarter-circle approximation)
    for (let a = 0; a <= 90; a += 2) {
      const rad = (a * Math.PI) / 180;
      const cx = Math.round(Math.cos(rad) * r);
      const cy = Math.round(Math.sin(rad) * r);
      this.setPixel(x + r - cx, y + r - cy, rgb[0], rgb[1], rgb[2], alpha);
      this.setPixel(x + w - 1 - r + cx, y + r - cy, rgb[0], rgb[1], rgb[2], alpha);
      this.setPixel(x + r - cx, y + h - 1 - r + cy, rgb[0], rgb[1], rgb[2], alpha);
      this.setPixel(x + w - 1 - r + cx, y + h - 1 - r + cy, rgb[0], rgb[1], rgb[2], alpha);
    }
  }

  // Gradient fill (left-to-right, two colours)
  gradientH(x: number, y: number, w: number, h: number, c1: RGB, c2: RGB, alpha = 1) {
    for (let px = x; px < x + w; px++) {
      const t = (px - x) / (w - 1);
      const r = Math.round(c1[0] + (c2[0] - c1[0]) * t);
      const g = Math.round(c1[1] + (c2[1] - c1[1]) * t);
      const b = Math.round(c1[2] + (c2[2] - c1[2]) * t);
      for (let py = y; py < y + h; py++) this.setPixel(px, py, r, g, b, alpha);
    }
  }

  // Radial glow centred at (cx, cy)
  radialGlow(cx: number, cy: number, rx: number, ry: number, rgb: RGB, maxAlpha: number) {
    const x0 = Math.max(0, cx - rx);
    const x1 = Math.min(W, cx + rx);
    const y0 = Math.max(0, cy - ry);
    const y1 = Math.min(H, cy + ry);
    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        const dx = (px - cx) / rx;
        const dy = (py - cy) / ry;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d >= 1) continue;
        const a = maxAlpha * (1 - d);
        this.setPixel(px, py, rgb[0], rgb[1], rgb[2], a);
      }
    }
  }

  // Draw a single glyph from a 5×7 bitmap font
  drawGlyph(glyph: number[], gx: number, gy: number, scale: number, rgb: RGB, alpha = 1) {
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (glyph[row] & (1 << (4 - col))) {
          this.fillRect(
            gx + col * scale,
            gy + row * scale,
            scale, scale,
            rgb, alpha,
          );
        }
      }
    }
  }

  // Draw text using the 5×7 bitmap font
  drawText(text: string, x: number, y: number, scale: number, rgb: RGB, alpha = 1): number {
    let cx = x;
    for (const ch of text) {
      const glyph = FONT[ch] ?? FONT['?'] ?? FONT[' '];
      if (glyph) this.drawGlyph(glyph, cx, y, scale, rgb, alpha);
      cx += (5 + 1) * scale;
    }
    return cx;
  }

  toPng(): Buffer {
    return encodePng(W, H, this.buf);
  }
}

// ─── 5×7 Bitmap font (ASCII 32–126) ─────────────────────────────────────────
// Each glyph is 7 rows × 5 bits (MSB = leftmost pixel)

const FONT: Record<string, number[]> = {
  ' ': [0x00,0x00,0x00,0x00,0x00,0x00,0x00],
  '!': [0x04,0x04,0x04,0x04,0x00,0x04,0x00],
  '"': [0x0A,0x0A,0x00,0x00,0x00,0x00,0x00],
  '#': [0x0A,0x1F,0x0A,0x0A,0x1F,0x0A,0x00],
  '$': [0x04,0x0F,0x14,0x0E,0x05,0x1E,0x04],
  '%': [0x18,0x19,0x02,0x04,0x08,0x13,0x03],
  '&': [0x0C,0x12,0x14,0x08,0x15,0x12,0x0D],
  "'": [0x04,0x04,0x00,0x00,0x00,0x00,0x00],
  '(': [0x02,0x04,0x08,0x08,0x08,0x04,0x02],
  ')': [0x08,0x04,0x02,0x02,0x02,0x04,0x08],
  '*': [0x00,0x04,0x15,0x0E,0x15,0x04,0x00],
  '+': [0x00,0x04,0x04,0x1F,0x04,0x04,0x00],
  ',': [0x00,0x00,0x00,0x00,0x06,0x04,0x08],
  '-': [0x00,0x00,0x00,0x1F,0x00,0x00,0x00],
  '.': [0x00,0x00,0x00,0x00,0x00,0x06,0x00],
  '/': [0x01,0x02,0x02,0x04,0x08,0x08,0x10],
  '0': [0x0E,0x11,0x13,0x15,0x19,0x11,0x0E],
  '1': [0x04,0x0C,0x04,0x04,0x04,0x04,0x0E],
  '2': [0x0E,0x11,0x01,0x06,0x08,0x10,0x1F],
  '3': [0x1F,0x02,0x04,0x02,0x01,0x11,0x0E],
  '4': [0x02,0x06,0x0A,0x12,0x1F,0x02,0x02],
  '5': [0x1F,0x10,0x1E,0x01,0x01,0x11,0x0E],
  '6': [0x06,0x08,0x10,0x1E,0x11,0x11,0x0E],
  '7': [0x1F,0x01,0x02,0x04,0x08,0x08,0x08],
  '8': [0x0E,0x11,0x11,0x0E,0x11,0x11,0x0E],
  '9': [0x0E,0x11,0x11,0x0F,0x01,0x02,0x0C],
  ':': [0x00,0x06,0x00,0x00,0x06,0x00,0x00],
  ';': [0x00,0x06,0x00,0x00,0x06,0x04,0x08],
  '<': [0x02,0x04,0x08,0x10,0x08,0x04,0x02],
  '=': [0x00,0x00,0x1F,0x00,0x1F,0x00,0x00],
  '>': [0x08,0x04,0x02,0x01,0x02,0x04,0x08],
  '?': [0x0E,0x11,0x01,0x06,0x04,0x00,0x04],
  '@': [0x0E,0x11,0x01,0x0D,0x15,0x15,0x0E],
  'A': [0x0E,0x11,0x11,0x1F,0x11,0x11,0x11],
  'B': [0x1E,0x11,0x11,0x1E,0x11,0x11,0x1E],
  'C': [0x0E,0x11,0x10,0x10,0x10,0x11,0x0E],
  'D': [0x1C,0x12,0x11,0x11,0x11,0x12,0x1C],
  'E': [0x1F,0x10,0x10,0x1E,0x10,0x10,0x1F],
  'F': [0x1F,0x10,0x10,0x1E,0x10,0x10,0x10],
  'G': [0x0E,0x11,0x10,0x17,0x11,0x11,0x0F],
  'H': [0x11,0x11,0x11,0x1F,0x11,0x11,0x11],
  'I': [0x0E,0x04,0x04,0x04,0x04,0x04,0x0E],
  'J': [0x07,0x02,0x02,0x02,0x02,0x12,0x0C],
  'K': [0x11,0x12,0x14,0x18,0x14,0x12,0x11],
  'L': [0x10,0x10,0x10,0x10,0x10,0x10,0x1F],
  'M': [0x11,0x1B,0x15,0x15,0x11,0x11,0x11],
  'N': [0x11,0x19,0x15,0x13,0x11,0x11,0x11],
  'O': [0x0E,0x11,0x11,0x11,0x11,0x11,0x0E],
  'P': [0x1E,0x11,0x11,0x1E,0x10,0x10,0x10],
  'Q': [0x0E,0x11,0x11,0x11,0x15,0x12,0x0D],
  'R': [0x1E,0x11,0x11,0x1E,0x14,0x12,0x11],
  'S': [0x0F,0x10,0x10,0x0E,0x01,0x01,0x1E],
  'T': [0x1F,0x04,0x04,0x04,0x04,0x04,0x04],
  'U': [0x11,0x11,0x11,0x11,0x11,0x11,0x0E],
  'V': [0x11,0x11,0x11,0x11,0x11,0x0A,0x04],
  'W': [0x11,0x11,0x11,0x15,0x15,0x1B,0x11],
  'X': [0x11,0x11,0x0A,0x04,0x0A,0x11,0x11],
  'Y': [0x11,0x11,0x0A,0x04,0x04,0x04,0x04],
  'Z': [0x1F,0x01,0x02,0x04,0x08,0x10,0x1F],
  '[': [0x0E,0x08,0x08,0x08,0x08,0x08,0x0E],
  '\\': [0x10,0x08,0x08,0x04,0x02,0x02,0x01],
  ']': [0x0E,0x02,0x02,0x02,0x02,0x02,0x0E],
  '^': [0x04,0x0A,0x11,0x00,0x00,0x00,0x00],
  '_': [0x00,0x00,0x00,0x00,0x00,0x00,0x1F],
  '`': [0x08,0x04,0x00,0x00,0x00,0x00,0x00],
  'a': [0x00,0x00,0x0E,0x01,0x0F,0x11,0x0F],
  'b': [0x10,0x10,0x1E,0x11,0x11,0x11,0x1E],
  'c': [0x00,0x00,0x0E,0x10,0x10,0x11,0x0E],
  'd': [0x01,0x01,0x0F,0x11,0x11,0x11,0x0F],
  'e': [0x00,0x00,0x0E,0x11,0x1F,0x10,0x0E],
  'f': [0x06,0x09,0x08,0x1C,0x08,0x08,0x08],
  'g': [0x00,0x0F,0x11,0x11,0x0F,0x01,0x0E],
  'h': [0x10,0x10,0x1E,0x11,0x11,0x11,0x11],
  'i': [0x04,0x00,0x0C,0x04,0x04,0x04,0x0E],
  'j': [0x02,0x00,0x06,0x02,0x02,0x12,0x0C],
  'k': [0x10,0x10,0x12,0x14,0x18,0x14,0x12],
  'l': [0x0C,0x04,0x04,0x04,0x04,0x04,0x0E],
  'm': [0x00,0x00,0x1A,0x15,0x15,0x11,0x11],
  'n': [0x00,0x00,0x1E,0x11,0x11,0x11,0x11],
  'o': [0x00,0x00,0x0E,0x11,0x11,0x11,0x0E],
  'p': [0x00,0x1E,0x11,0x11,0x1E,0x10,0x10],
  'q': [0x00,0x0F,0x11,0x11,0x0F,0x01,0x01],
  'r': [0x00,0x00,0x16,0x19,0x10,0x10,0x10],
  's': [0x00,0x00,0x0E,0x10,0x0E,0x01,0x1E],
  't': [0x08,0x08,0x1C,0x08,0x08,0x09,0x06],
  'u': [0x00,0x00,0x11,0x11,0x11,0x13,0x0D],
  'v': [0x00,0x00,0x11,0x11,0x11,0x0A,0x04],
  'w': [0x00,0x00,0x11,0x11,0x15,0x15,0x0A],
  'x': [0x00,0x00,0x11,0x0A,0x04,0x0A,0x11],
  'y': [0x00,0x11,0x11,0x0F,0x01,0x11,0x0E],
  'z': [0x00,0x00,0x1F,0x02,0x04,0x08,0x1F],
  '{': [0x06,0x08,0x08,0x10,0x08,0x08,0x06],
  '|': [0x04,0x04,0x04,0x04,0x04,0x04,0x04],
  '}': [0x0C,0x02,0x02,0x01,0x02,0x02,0x0C],
  '~': [0x00,0x08,0x15,0x02,0x00,0x00,0x00],
};

// ─── Text helpers ─────────────────────────────────────────────────────────────

function textWidth(text: string, scale: number): number {
  return text.length * (5 + 1) * scale - scale;
}

function wrapText(text: string, maxWidth: number, scale: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (textWidth(candidate, scale) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// ─── Colour constants ─────────────────────────────────────────────────────────

const BG:     RGB = [0x0A, 0x0A, 0x0A];
const GOLD:   RGB = [0xC9, 0xA8, 0x4C];
const GOLD2:  RGB = [0xF0, 0xD0, 0x80];
const WHITE:  RGB = [0xFF, 0xFF, 0xFF];
const GREY:   RGB = [0x80, 0x80, 0x80];

// ─── Handler ─────────────────────────────────────────────────────────────────

export default function handler(req: Request, res: Response) {
  const title       = String(req.query.title       ?? 'City Gate Capital').slice(0, 80).toUpperCase();
  const description = String(req.query.description ?? 'Secure Digital Banking for the Modern World').slice(0, 120);

  const canvas = new Canvas();

  // Background
  canvas.fillRect(0, 0, W, H, BG);

  // Ambient radial glow (gold, centre)
  canvas.radialGlow(600, 315, 500, 300, GOLD, 0.06);

  // Border frame (1px gold, 25% opacity)
  canvas.roundRect(24, 24, W - 48, H - 48, 16, GOLD, 0.25);

  // Corner accent marks (2px, 60% opacity)
  const ca = 0.6;
  const cl = 56;
  // top-left
  canvas.vLine(24, 24, cl, GOLD, ca); canvas.hLine(24, 24, cl, GOLD, ca);
  // top-right
  canvas.vLine(W - 25, 24, cl, GOLD, ca); canvas.hLine(W - 24 - cl, 24, cl, GOLD, ca);
  // bottom-left
  canvas.vLine(24, H - 24 - cl, cl, GOLD, ca); canvas.hLine(24, H - 25, cl, GOLD, ca);
  // bottom-right
  canvas.vLine(W - 25, H - 24 - cl, cl, GOLD, ca); canvas.hLine(W - 24 - cl, H - 25, cl, GOLD, ca);

  // Logo mark box (72, 64, 52×52)
  canvas.fillRect(72, 64, 52, 52, GOLD, 0.15);
  canvas.roundRect(72, 64, 52, 52, 12, GOLD, 0.4);
  // "CGC" text in logo box (scale 2)
  const cgcW = textWidth('CGC', 2);
  canvas.drawText('CGC', 72 + (52 - cgcW) / 2, 64 + (52 - 14) / 2, 2, GOLD);

  // Brand name
  canvas.drawText('CITY GATE', 140, 68, 2, WHITE, 0.9);
  canvas.drawText('CAPITAL', 140, 90, 1, GOLD);

  // Gold divider line (gradient)
  canvas.gradientH(72, 160, 408, 2, GOLD, GOLD2, 0.5);

  // Title (scale 5 = ~35px tall glyphs)
  const titleScale = 5;
  const titleLines = wrapText(title, W - 144, titleScale);
  const titleLineH = 7 * titleScale + 12;
  let ty = 200;
  for (const line of titleLines.slice(0, 3)) {
    canvas.drawText(line, 72, ty, titleScale, WHITE);
    ty += titleLineH;
  }

  // Description (scale 2 = ~14px)
  const descScale = 2;
  const descLines = wrapText(description, W - 144, descScale);
  const descLineH = 7 * descScale + 6;
  let dy = ty + 20;
  for (const line of descLines.slice(0, 3)) {
    canvas.drawText(line, 72, dy, descScale, GREY);
    dy += descLineH;
  }

  // Bottom badge
  canvas.fillRect(72, 560, 220, 36, GOLD, 0.12);
  canvas.roundRect(72, 560, 220, 36, 18, GOLD, 0.3);
  const badgeText = 'CITYGATE.CAPITAL';
  const bw = textWidth(badgeText, 2);
  canvas.drawText(badgeText, 72 + (220 - bw) / 2, 560 + (36 - 14) / 2, 2, GOLD);

  // Decorative dot grid (top-right)
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 8; col++) {
      const a = 0.06 + (row + col) * 0.01;
      const cx = 1100 - col * 22;
      const cy = 80 + row * 22;
      canvas.fillRect(cx - 1, cy - 1, 3, 3, GOLD, a);
    }
  }

  const png = canvas.toPng();

  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
  res.setHeader('Content-Length', png.length);
  res.end(png);
}
