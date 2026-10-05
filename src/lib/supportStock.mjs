// Real, licensed stock photos for support-published posts. The numeric entries are
// Pexels photo IDs; the named entries are the existing Unsplash files in the manifest.
// Keep each live support post on a distinct stock header. Photos remain illustrative.
export const STOCK_PHOTOS = {
  jobs: [
    ...Array.from({ length: 14 }, (_, index) => ({ name: `jobs-${index + 1}`, topic: index === 3 ? 'medical' : index >= 5 && index <= 11 ? 'warehouse' : 'office' })),
    ...[12902862,12902876,12903153,12903349,12911261,13450788,19895883,5324920,6592397,6803551,6930581,7438090,7580707,7964513,7988117,7993573,8691820,8837374].map(id => ({ name: `jobs-p${id}`, id, topic: 'office', alt: 'Professional at work' })),
    ...[5430213,5722166,6097749,6098051,6303643].map(id => ({ name: `jobs-p${id}`, id, topic: 'medical', alt: 'Healthcare professional at work' })),
    ...[17018103,17842832,33694019,34054464,9679179].map(id => ({ name: `jobs-p${id}`, id, topic: 'electrical', alt: 'Electrical technician at work' })),
    ...[31112238,31199532,31199539,4487365,4483938,4483861].map(id => ({ name: `jobs-p${id}`, id, topic: 'warehouse', alt: 'Warehouse worker at work' })),
    ...[11358072,18703556,4199488,6925800,8422732].map(id => ({ name: `jobs-p${id}`, id, topic: 'retail', alt: 'Retail worker at work' })),
    ...[9462742,6466493].map(id => ({ name: `jobs-p${id}`, id, topic: 'cleaning', alt: 'Housekeeping staff at work' })),
    ...[14959638,163945].map(id => ({ name: `jobs-p${id}`, id, topic: 'driving', alt: 'Person driving a car' })),
  ],
  rentals: [
    ...Array.from({ length: 8 }, (_, index) => ({ name: `rentals-${index + 1}`, topic: 'property' })),
    ...[15251055,7534563,10117724].map(id => ({ name: `rentals-p${id}`, id, topic: 'property', alt: 'Apartment interior, illustrative stock photo' })),
  ],
  for_sale: [
    ...Array.from({ length: 5 }, (_, index) => ({ name: `for_sale-${index + 1}`, topic: index === 0 || index === 4 ? 'vehicle' : index === 2 ? 'electronics' : index === 3 ? 'furniture' : 'property' })),
    ...Array.from({ length: 3 }, (_, index) => ({ name: `vehicles-${index + 1}`, topic: 'vehicle' })),
    ...[11296222,6186821,6764827,7173672].map(id => ({ name: `for_sale-p${id}`, id, topic: 'property', alt: 'Property interior, illustrative stock photo' })),
    { name: 'for_sale-p11120520', id: 11120520, topic: 'electronics', alt: 'Smartphone, illustrative stock photo' },
    { name: 'for_sale-p16274689', id: 16274689, topic: 'furniture', alt: 'Sofa, illustrative stock photo' },
    ...Array.from({ length: 8 }, (_, index) => ({ name: `rentals-${index + 1}`, topic: 'property' })),
    ...[15251055,7534563,10117724].map(id => ({ name: `rentals-p${id}`, id, topic: 'property', alt: 'Apartment interior, illustrative stock photo' })),
  ],
  general: Array.from({ length: 5 }, (_, index) => ({ name: `general-${index + 1}`, topic: 'property' })),
  promotions: Array.from({ length: 5 }, (_, index) => ({ name: `promotions-${index + 1}`, topic: 'property' })),
};

const hash = text => [...String(text)].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 7);
export const stockPath = item => `/samples/headers/${item.name}.jpg`;
const pathOf = value => {
  try { return new URL(value, 'https://revlo.ng').pathname; } catch { return value; }
};
const topicFor = (category, title) => {
  // Imported job titles append the employer after " · ". Match the role only:
  // a Legal Officer at a health charity should not receive a nurse photo.
  const text = (category === 'jobs' ? String(title).split(' · ')[0] : String(title)).toLowerCase();
  if (category === 'jobs') {
    if (/cleaner|housekeep|housekeeper|cleaning/.test(text)) return 'cleaning';
    if (/driver|chauffeur/.test(text)) return 'driving';
    if (/nurs|doctor|medical|radiograph|pharmac|hospital|health|midwi/.test(text)) return 'medical';
    if (/electric|technician|mechanic|maintenance|engineering/.test(text)) return 'electrical';
    if (/warehouse|logistic|vessel|supply|operator|factory|forklift/.test(text)) return 'warehouse';
    if (/cashier|retail|shop|sales|market|front desk|customer service/.test(text)) return 'retail';
    return 'office';
  }
  if (category === 'rentals') return 'property';
  if (/bedroom|house|bungalow|estate|guest house|hotel|duplex|terrace|\bland\b|apartment|pent.?home|\bflat\b|\bplot\b/.test(text)) return 'property';
  if (/car|vehicle|toyota|lexus|benz|bmw|honda/.test(text)) return 'vehicle';
  if (/phone|laptop|tablet|computer|electronics/.test(text)) return 'electronics';
  if (/sofa|chair|table|furniture/.test(text)) return 'furniture';
  return 'property';
};

/** Return a relevant unused image, or null so an importer can wait for capacity. */
export function pickSupportStock(category, title, used = new Set(), origin = 'https://revlo.ng') {
  const pool = STOCK_PHOTOS[category] || (/^(vehicles|electronics|gadgets|wears)$/.test(category) ? STOCK_PHOTOS.for_sale : []);
  const occupied = new Set([...used].map(pathOf));
  const topic = topicFor(category, title);
  const offset = hash(title) % Math.max(pool.length, 1);
  const ordered = [...pool.slice(offset), ...pool.slice(0, offset)].filter(item => !occupied.has(stockPath(item)));
  const selected = ordered.find(item => item.topic === topic);
  return selected ? `${origin}${stockPath(selected)}` : null;
}
