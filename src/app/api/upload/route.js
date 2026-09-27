import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { blockedResponse, findActiveBlock, requestIp } from '@/lib/revloBlocklist';
import { detectUploadType, requireRateLimit } from '@/lib/security';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const BUCKET = process.env.STORAGE_BUCKET || 'media';
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

// POST /api/upload  (multipart form-data, field "file")
// Returns { url } -- a public URL to the stored object.
export async function POST(request) {
  const sourceIp = requestIp(request);
  if (await findActiveBlock({ ip: sourceIp })) return blockedResponse();
  const limited = await requireRateLimit({ action: 'upload:15m', key: sourceIp, limit: 5, windowSeconds: 900 });
  if (limited) return limited;
  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > MAX_BYTES + 1024 * 1024) {
    return NextResponse.json({ error: 'file too large (max 25MB)' }, { status: 413 });
  }
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
  const bytes = Buffer.from(await file.arrayBuffer());
  const detected = detectUploadType(bytes);
  if (!detected) {
    return NextResponse.json({ error: 'unsupported or invalid file content' }, { status: 415 });
  }
  const key = `${Date.now()}-${crypto.randomUUID()}.${detected.extension}`;

  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(key, bytes, { contentType: detected.mime, upsert: false });

  if (error) {
    console.error('[upload]', error);
    return NextResponse.json({ error: 'upload failed' }, { status: 500 });
  }

  const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(key);
  return NextResponse.json({ url: data.publicUrl, key });
}
