import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { blockedResponse, findActiveBlock, requestIp } from '@/lib/revloBlocklist';
import { detectUploadType, requireRateLimit } from '@/lib/security';
import { verifyToken } from '@/lib/util';
import { getPublisherStatus } from '@/lib/revloFeatures';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const BUCKET = process.env.STORAGE_BUCKET || 'media';
const MAX_IMAGE_BYTES = Math.floor(1.5 * 1024 * 1024);
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;

// POST /api/upload  (multipart form-data, field "file")
// Returns { url } -- a public URL to the stored object.
export async function POST(request) {
  const sourceIp = requestIp(request);
  if (await findActiveBlock({ ip: sourceIp })) return blockedResponse();
  const limited = await requireRateLimit({ action: 'upload:15m', key: sourceIp, limit: 20, windowSeconds: 900 });
  if (limited) return limited;
  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > MAX_VIDEO_BYTES + 1024 * 1024) {
    return NextResponse.json({ error: 'file too large' }, { status: 413 });
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
  const bytes = Buffer.from(await file.arrayBuffer());
  const detected = detectUploadType(bytes);
  const isVideo = Boolean(detected?.mime?.startsWith('video/'));
  const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (!detected || (!detected.mime.startsWith('image/') && !isVideo)) {
    return NextResponse.json({ error: 'unsupported file; use JPEG, PNG, GIF, WebP, MP4, or WebM' }, { status: 415 });
  }
  if (file.size > maxBytes) {
    return NextResponse.json({ error: isVideo ? 'video too large (max 25MB)' : 'image too large (max 1.5MB)' }, { status: 413 });
  }
  if (isVideo) {
    const posterEmail = String(form.get('poster_email') || '').trim().toLowerCase();
    const claim = verifyToken(String(form.get('publish_token') || ''));
    if (!claim || claim.action !== 'publish' || claim.email !== posterEmail) return NextResponse.json({ error: 'Open your publish link to upload video.' }, { status: 401 });
    if (await findActiveBlock({ email: posterEmail, ip: sourceIp })) return blockedResponse();
    const status = await getPublisherStatus(posterEmail);
    if (!status.videoEligible) return NextResponse.json({ error: `Video unlocks with the Silver badge at ${status.settings.silver_posts} posts.` }, { status: 403 });
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
