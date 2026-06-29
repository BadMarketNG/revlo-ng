import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const BUCKET = process.env.STORAGE_BUCKET || 'media';
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'];

// POST /api/upload  (multipart form-data, field "file")
// Returns { url } -- a public URL to the stored object.
export async function POST(request) {
  let form;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'expected multipart form-data' }, { status: 400 });
  }
  const file = form.get('file');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'file field required' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'file too large (max 25MB)' }, { status: 413 });
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: 'unsupported file type' }, { status: 415 });
  }

  const ext = (file.name?.split('.').pop() || 'bin').toLowerCase().slice(0, 5);
  const key = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(key, bytes, { contentType: file.type, upsert: false });

  if (error) {
    console.error('[upload]', error);
    return NextResponse.json({ error: 'upload failed' }, { status: 500 });
  }

  const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(key);
  return NextResponse.json({ url: data.publicUrl, key });
}
