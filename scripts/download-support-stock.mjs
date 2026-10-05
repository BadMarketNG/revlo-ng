import { access, mkdir, writeFile } from 'node:fs/promises';
import { STOCK_PHOTOS, stockPath } from '../src/lib/supportStock.mjs';

const photos = Object.values(STOCK_PHOTOS).flat().filter(item => item.id);
await mkdir('public/samples/headers', { recursive: true });
for (let index = 0; index < photos.length; index += 5) {
  await Promise.all(photos.slice(index, index + 5).map(async item => {
    try { await access(`public${stockPath(item)}`); return; } catch { /* download missing photo */ }
    const url = `https://images.pexels.com/photos/${item.id}/pexels-photo-${item.id}.jpeg?auto=compress&cs=tinysrgb&w=1200`;
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`${item.name}: HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 10000 || bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error(`${item.name}: invalid JPEG`);
    await writeFile(`public${stockPath(item)}`, bytes);
  }));
  console.log(`Downloaded ${Math.min(index + 5, photos.length)}/${photos.length} real stock photos`);
}
