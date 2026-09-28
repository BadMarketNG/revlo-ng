import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const SOURCE = 'https://raw.githubusercontent.com/mehrtat/disposable-email-domain/main/domains.txt';
const META_SOURCE = 'https://raw.githubusercontent.com/mehrtat/disposable-email-domain/main/metadata.json';
const output = resolve('src/data/disposable-email-domains.txt');
const metadataOutput = resolve('src/data/disposable-email-domains.metadata.json');

const [listResponse, metadataResponse] = await Promise.all([fetch(SOURCE), fetch(META_SOURCE)]);
if (!listResponse.ok || !metadataResponse.ok) throw new Error('Could not download the domain block-list sources');
const domains = (await listResponse.text()).split(/\r?\n/).map((value) => value.trim().toLowerCase()).filter(Boolean);
const metadata = await metadataResponse.json();
if (domains.length < 100_000) throw new Error(`Refusing unexpectedly small block list (${domains.length})`);
if (new Set(domains).size !== domains.length) throw new Error('Refusing block list containing duplicate domains');
if (domains.some((domain) => !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63}$/.test(domain))) {
  throw new Error('Refusing block list containing invalid domain syntax');
}

await mkdir(dirname(output), { recursive: true });
const listTemp = `${output}.${process.pid}.tmp`;
const metadataTemp = `${metadataOutput}.${process.pid}.tmp`;
await writeFile(listTemp, `${domains.join('\n')}\n`, { mode: 0o644 });
await writeFile(metadataTemp, `${JSON.stringify({
  retrieved_at: new Date().toISOString(),
  canonical_url: SOURCE,
  license: 'See the aggregation repository and each upstream source for applicable terms',
  ...metadata,
  count: domains.length,
}, null, 2)}\n`, { mode: 0o644 });
await rename(listTemp, output);
await rename(metadataTemp, metadataOutput);
console.log(`Updated ${domains.length.toLocaleString()} disposable email domains.`);
