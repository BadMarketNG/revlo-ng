import { readFile, writeFile } from 'node:fs/promises';
import { STOCK_PHOTOS, stockPath } from '../src/lib/supportStock.mjs';

const path = 'public/samples/manifest.json';
const manifest = JSON.parse(await readFile(path, 'utf8'));
for (const [category, photos] of Object.entries(STOCK_PHOTOS)) {
  manifest.headers[category] ||= [];
  for (const photo of photos.filter(item => item.id)) {
    const src = stockPath(photo);
    if (manifest.headers[category].some(item => item.src === src)) continue;
    manifest.headers[category].push({
      src, alt: photo.alt,
      source: `https://www.pexels.com/photo/${photo.id}/`,
    });
  }
}
await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`);
