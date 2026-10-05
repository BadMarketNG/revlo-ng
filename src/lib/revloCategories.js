import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const DEFAULT_CATEGORY_ROWS = [
  { slug: 'jobs', label: 'Jobs', position: 10, protected: false },
  { slug: 'rentals', label: 'Rentals', position: 20, protected: false },
  { slug: 'for_sale', label: 'For Sale', position: 30, protected: false },
  { slug: 'promotions', label: 'Promotions', position: 40, protected: false },
  { slug: 'general', label: 'General', position: 50, protected: true },
];

// Categories an administrator chose to always show in the category bar (2026-10-03).
export const MAX_PINNED_CATEGORIES = 5;

export function categorySlug(label) {
  return String(label || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32);
}

export function validCategoryLabel(label) {
  const value = String(label || '').trim();
  return value.length >= 2 && value.length <= 32;
}

export async function getCategories() {
  const { data, error } = await supabaseAdmin.from('admin_log')
    .select('action,detail,created_at')
    // ORIGINAL (2026-10-03): ['category_create', 'category_rename', 'category_reorder', 'category_delete']
    // NOTE: plus 'category_pin' (up to 5 categories always shown in the bar; the latest choice wins).
    .in('action', ['category_create', 'category_rename', 'category_reorder', 'category_delete', 'category_pin'])
    .order('created_at', { ascending: true })
    .limit(5000);
  if (error) {
    console.error('[categories:list]', error);
    return DEFAULT_CATEGORY_ROWS;
  }
  const catalogue = new Map(DEFAULT_CATEGORY_ROWS.map((row) => [row.slug, { ...row }]));
  let pinned = [];
  for (const event of data || []) {
    const detail = event.detail || {};
    if (event.action === 'category_create' && detail.slug && detail.label) {
      catalogue.set(detail.slug, {
        slug: detail.slug,
        label: detail.label,
        position: Number(detail.position) || catalogue.size * 10 + 10,
        protected: false,
      });
    } else if (event.action === 'category_rename' && catalogue.has(detail.slug)) {
      catalogue.get(detail.slug).label = detail.label;
    } else if (event.action === 'category_delete' && detail.slug !== 'general') {
      catalogue.delete(detail.slug);
    } else if (event.action === 'category_pin' && Array.isArray(detail.pinned)) {
      pinned = detail.pinned.map(String).slice(0, MAX_PINNED_CATEGORIES);
    } else if (event.action === 'category_reorder' && Array.isArray(detail.order)) {
      detail.order.forEach((slug, index) => {
        if (catalogue.has(slug)) catalogue.get(slug).position = (index + 1) * 10;
      });
    }
  }
  // ORIGINAL (2026-10-03): returned the rows without a pinned flag.
  return [...catalogue.values()]
    .filter((row) => row.slug !== 'dating' && row.slug !== 'vehicles')
    .map((row) => ({ ...row, pinned: pinned.includes(row.slug) }))
    .sort((left, right) => left.position - right.position || left.label.localeCompare(right.label));
}

export async function isConfiguredCategory(slug) {
  if (typeof slug !== 'string' || !/^[a-z0-9][a-z0-9_]{1,31}$/.test(slug)) return false;
  const categories = await getCategories();
  return categories.some((category) => category.slug === slug);
}
