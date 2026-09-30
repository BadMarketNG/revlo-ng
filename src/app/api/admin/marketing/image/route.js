import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { detectUploadType } from '@/lib/security';

export const dynamic = 'force-dynamic';

const BUCKET = process.env.STORAGE_BUCKET || 'media';
const MAX_BYTES = 5 * 1024 * 1024;

// POST /api/admin/marketing/image (multipart "file") -> { url }
// Images for marketing emails, stored in Revlo's public storage.
export async function POST(request) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!file || typeof file === 'string') return NextResponse.json({ error: 'Choose an image.' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Images can be up to 5MB.' }, { status: 413 });
  const bytes = Buffer.from(await file.arrayBuffer());
  const detected = detectUploadType(bytes);
  if (!detected?.mime?.startsWith('image/')) return NextResponse.json({ error: 'Use a JPEG, PNG, GIF or WebP image.' }, { status: 415 });
  const key = `marketing/${Date.now()}-${crypto.randomUUID()}.${detected.extension}`;
  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(key, bytes, { contentType: detected.mime, upsert: false });
  if (error) return NextResponse.json({ error: 'Upload failed.' }, { status: 500 });
  const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(key);
  return NextResponse.json({ url: data.publicUrl });
}
