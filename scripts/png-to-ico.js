/* Converte lol-overlay-icon.png -> assets/icon.ico (multi-tamanho 256/48/32/16,
   BGRA 32-bit) sem dependências externas. Decodifica PNG 8-bit truecolor
   (colorType 2/6, não-entrelaçado) e faz downscale por média de caixa.
   Rode: node scripts/png-to-ico.js */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const SRC = path.join(__dirname, "..", "lol-overlay-icon.png");
const OUT = path.join(__dirname, "..", "assets", "icon.ico");
const SIZES = [256, 48, 32, 16];

// ---------- decodifica PNG (truecolor 8-bit, sem entrelace) ----------
function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("não é PNG");
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const bitDepth = buf[24];
  const colorType = buf[25];
  const interlace = buf[28];
  if (bitDepth !== 8 || interlace !== 0 || (colorType !== 2 && colorType !== 6))
    throw new Error(`PNG não suportado (depth=${bitDepth} color=${colorType} il=${interlace})`);
  const channels = colorType === 6 ? 4 : 3;

  // junta os chunks IDAT
  const idat = [];
  let p = 8;
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString("ascii", p + 4, p + 8);
    if (type === "IDAT") idat.push(buf.slice(p + 8, p + 8 + len));
    if (type === "IEND") break;
    p += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));

  // remove os filtros por scanline
  const bpp = channels;
  const stride = width * bpp;
  const out = Buffer.alloc(height * stride);
  let ri = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[ri++];
    const row = out.subarray(y * stride, y * stride + stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, (y - 1) * stride + stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? row[x - bpp] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= bpp ? prev[x - bpp] : 0;
      let v = raw[ri++];
      switch (filter) {
        case 1: v = (v + a) & 255; break;
        case 2: v = (v + b) & 255; break;
        case 3: v = (v + ((a + b) >> 1)) & 255; break;
        case 4: {
          const pp = a + b - c;
          const pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
          v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
          break;
        }
      }
      row[x] = v;
    }
  }
  return { width, height, channels, data: out };
}

// ---------- downscale por média de caixa -> BGRA ----------
function resizeBGRA(img, T) {
  const { width: W, height: H, channels: ch, data } = img;
  const out = Buffer.alloc(T * T * 4);
  for (let dy = 0; dy < T; dy++) {
    const y0 = Math.floor((dy * H) / T);
    const y1 = Math.max(y0 + 1, Math.floor(((dy + 1) * H) / T));
    for (let dx = 0; dx < T; dx++) {
      const x0 = Math.floor((dx * W) / T);
      const x1 = Math.max(x0 + 1, Math.floor(((dx + 1) * W) / T));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const o = (y * W + x) * ch;
          r += data[o];
          g += data[o + 1];
          b += data[o + 2];
          a += ch === 4 ? data[o + 3] : 255;
          n++;
        }
      }
      const o = (dy * T + dx) * 4;
      out[o] = Math.round(b / n); // B
      out[o + 1] = Math.round(g / n); // G
      out[o + 2] = Math.round(r / n); // R
      out[o + 3] = Math.round(a / n); // A
    }
  }
  return out;
}

// ---------- monta uma entrada DIB (BMP dentro do ICO) ----------
function dibEntry(bgraTopDown, T) {
  const dib = Buffer.alloc(40);
  dib.writeUInt32LE(40, 0);
  dib.writeInt32LE(T, 4);
  dib.writeInt32LE(T * 2, 8); // XOR + AND
  dib.writeUInt16LE(1, 12);
  dib.writeUInt16LE(32, 14);
  // XOR: bottom-up
  const xor = Buffer.alloc(T * T * 4);
  for (let y = 0; y < T; y++) {
    const src = (T - 1 - y) * T * 4;
    bgraTopDown.copy(xor, y * T * 4, src, src + T * 4);
  }
  const andRow = ((T + 31) >> 5) * 4; // linhas de 1bpp alinhadas a 32 bits
  const and = Buffer.alloc(andRow * T, 0);
  return Buffer.concat([dib, xor, and]);
}

// ---------- gera o ICO ----------
const img = decodePng(fs.readFileSync(SRC));
const images = SIZES.map((T) => dibEntry(resizeBGRA(img, T), T));

const dir = Buffer.alloc(6);
dir.writeUInt16LE(1, 2); // type icon
dir.writeUInt16LE(SIZES.length, 4);

let offset = 6 + 16 * SIZES.length;
const entries = SIZES.map((T, i) => {
  const e = Buffer.alloc(16);
  e[0] = T >= 256 ? 0 : T;
  e[1] = T >= 256 ? 0 : T;
  e.writeUInt16LE(1, 4);
  e.writeUInt16LE(32, 6);
  e.writeUInt32LE(images[i].length, 8);
  e.writeUInt32LE(offset, 12);
  offset += images[i].length;
  return e;
});

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, Buffer.concat([dir, ...entries, ...images]));
console.log("wrote", OUT, "com tamanhos", SIZES.join(", "));
