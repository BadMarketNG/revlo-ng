import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';
import { pickSupportStock, STOCK_PHOTOS, stockPath } from '../src/lib/supportStock.mjs';

test('support importer chooses distinct, relevant real stock headers', () => {
  const used = new Set();
  const jobs = [
    ...Array.from({ length: 20 }, (_, index) => `Office manager ${index}`),
    'Nurse / Midwife', 'Electrician', 'Warehouse Officer', 'Cashier',
  ];
  for (const title of jobs) {
    const image = pickSupportStock('jobs', title, used);
    assert.ok(image, title);
    assert.equal(used.has(image), false);
    used.add(image);
  }
  const medical = pickSupportStock('jobs', 'Radiographer', new Set());
  const medicalPaths = STOCK_PHOTOS.jobs.filter(photo => photo.topic === 'medical').map(photo => stockPath(photo));
  assert.ok(medicalPaths.some(path => medical.endsWith(path)));
  for (const photo of Object.values(STOCK_PHOTOS).flat()) {
    assert.ok(existsSync(new URL(`../public${stockPath(photo)}`, import.meta.url)), stockPath(photo));
  }
  const propertyPhotos = STOCK_PHOTOS.for_sale.filter(photo => photo.topic === 'property');
  const propertyUsed = new Set(propertyPhotos.map(photo => `https://revlo.ng${stockPath(photo)}`));
  assert.equal(pickSupportStock('for_sale', '4-bedroom duplex for sale', propertyUsed), null);
  assert.equal(pickSupportStock('rentals', 'Flat', new Set(STOCK_PHOTOS.rentals.map(photo => `https://revlo.ng${stockPath(photo)}`))), null);
});
