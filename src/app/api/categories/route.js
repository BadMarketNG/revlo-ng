import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { MAX_PINNED_CATEGORIES, categorySlug, getCategories, validCategoryLabel } from '@/lib/revloCategories';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ categories: await getCategories() });
}

export async function POST(request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const label = String(body.label || '').trim();
  const slug = categorySlug(body.slug || label);
  if (slug === 'dating' || slug === 'vehicles') return NextResponse.json({ error: 'This category is unavailable.' }, { status: 400 });
  if (!validCategoryLabel(label) || slug.length < 2) {
    return NextResponse.json({ error: 'Use a category name between 2 and 32 characters.' }, { status: 400 });
  }
  const rows = await getCategories();
  if (rows.some((row) => row.slug === slug)) return NextResponse.json({ error: 'That category already exists.' }, { status: 409 });
  const position = Math.max(0, ...rows.map((row) => Number(row.position) || 0)) + 10;
  if (!await logCategoryAction(admin, 'category_create', { slug, label, position })) {
    return NextResponse.json({ error: 'Could not create category.' }, { status: 500 });
  }
  return NextResponse.json({ category: { slug, label, position, protected: false } }, { status: 201 });
}

export async function PATCH(request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  // NOTE (2026-10-03): { pinned: [slugs] } sets the categories always shown in the bar (up to 5).
  if (Array.isArray(body.pinned)) {
    const known = new Set((await getCategories()).map((row) => row.slug));
    const pinned = [...new Set(body.pinned.map(String))];
    if (pinned.length > MAX_PINNED_CATEGORIES) return NextResponse.json({ error: `Choose up to ${MAX_PINNED_CATEGORIES} categories to always show.` }, { status: 400 });
    if (pinned.some((slug) => !known.has(slug))) return NextResponse.json({ error: 'Unknown category.' }, { status: 400 });
    if (!await logCategoryAction(admin, 'category_pin', { pinned })) return NextResponse.json({ error: 'Could not save.' }, { status: 500 });
    return NextResponse.json({ categories: await getCategories() });
  }
  if (Array.isArray(body.order)) {
    const rows = await getCategories();
    const known = new Set(rows.map((row) => row.slug));
    const order = body.order.map(String);
    if (order.length !== known.size || new Set(order).size !== order.length || order.some((slug) => !known.has(slug))) {
      return NextResponse.json({ error: 'The category order is incomplete.' }, { status: 400 });
    }
    if (!await logCategoryAction(admin, 'category_reorder', { order })) {
      return NextResponse.json({ error: 'Could not reorder categories.' }, { status: 500 });
    }
    return NextResponse.json({ categories: await getCategories() });
  }

  const slug = String(body.slug || '');
  const label = String(body.label || '').trim();
  if (!validCategoryLabel(label)) return NextResponse.json({ error: 'Use a category name between 2 and 32 characters.' }, { status: 400 });
  const category = (await getCategories()).find((row) => row.slug === slug);
  if (!category) return NextResponse.json({ error: 'Category not found.' }, { status: 404 });
  if (!await logCategoryAction(admin, 'category_rename', { slug, label })) {
    return NextResponse.json({ error: 'Could not rename category.' }, { status: 500 });
  }
  return NextResponse.json({ category: { ...category, label } });
}

export async function DELETE(request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const slug = String(body.slug || '');
  const category = (await getCategories()).find((row) => row.slug === slug);
  if (!category) return NextResponse.json({ error: 'Category not found.' }, { status: 404 });
  if (category.protected || category.slug === 'general') {
    return NextResponse.json({ error: 'General is the required fallback category and cannot be deleted.' }, { status: 409 });
  }
  const { error: postError } = await supabaseAdmin.from('posts').update({ category: 'general' }).eq('category', slug);
  if (postError) return NextResponse.json({ error: 'Could not safely move existing posts.' }, { status: 500 });
  const { error: promoError } = await supabaseAdmin.from('revlo_promotions').update({ category: null }).eq('category', slug);
  if (promoError) return NextResponse.json({ error: 'Could not safely update promotions.' }, { status: 500 });
  if (!await logCategoryAction(admin, 'category_delete', { slug, label: category.label, reassigned_to: 'general' })) {
    return NextResponse.json({ error: 'Could not delete category.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, categories: await getCategories() });
}

async function logCategoryAction(admin, action, detail) {
  const { error } = await supabaseAdmin.from('admin_log').insert({
    action,
    target_uid: `category:${detail.slug || 'order'}`,
    detail: { ...detail, administrator_id: admin.sub, administrator_email: admin.email },
  });
  if (error) console.error('[categories:audit]', error);
  return !error;
}
