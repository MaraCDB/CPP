import sharp from 'sharp';
import { readFileSync } from 'node:fs';

const svg = readFileSync('public/icon.svg');

const sizes = [
  { out: 'public/icon-192.png', size: 192, pad: 0 },
  { out: 'public/icon-512.png', size: 512, pad: 0 },
  // maskable requires ~20% safe zone padding
  { out: 'public/icon-512-maskable.png', size: 512, pad: 52 },
];

for (const { out, size, pad } of sizes) {
  if (pad > 0) {
    await sharp(svg)
      .resize(size - pad * 2, size - pad * 2)
      .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 232, g: 82, b: 139, alpha: 1 } })
      .png()
      .toFile(out);
  } else {
    await sharp(svg).resize(size, size).png().toFile(out);
  }
  console.log('wrote', out);
}
