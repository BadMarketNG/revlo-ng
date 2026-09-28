import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { detectUploadType, requireRateLimit } from '@/lib/security';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const BUCKET = process.env.STORAGE_BUCKET || 'media';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function noStore(response) {
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

function crossSite(request) {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return true;
  const origin = request.headers.get('origin');
  if (!origin) return false;
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const protocol = request.headers.get('x-forwarded-proto') || new URL(request.url).protocol.replace(':', '');
  const proxyOrigin = host ? `${protocol}://${host}` : '';
  return origin !== new URL(request.url).origin && origin !== proxyOrigin;
}

export async function POST(request) {
  if (crossSite(request)) return noStore(NextResponse.json({ error: 'Cross-site request rejected.' }, { status: 403 }));
  const admin = await getAdminSession();
  if (!admin) return noStore(NextResponse.json({ error: 'unauthorized' }, { status: 401 }));

  const limited = await requireRateLimit({
    action: 'admin-promotion-image:15m',
    key: admin.sub,
    limit: 20,
    windowSeconds: 900,
  });
  if (limited) return noStore(limited);

  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > MAX_IMAGE_BYTES + 256 * 1024) {
    return noStore(NextResponse.json({ error: 'Image is too large (maximum 5 MB).' }, { status: 413 }));
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return noStore(NextResponse.json({ error: 'Expected an image upload.' }, { status: 400 }));
  }
  const file = form.get('file');
  if (!file || typeof file === 'string') {
    return noStore(NextResponse.json({ error: 'Choose a header image.' }, { status: 400 }));
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return noStore(NextResponse.json({ error: 'Image is too large (maximum 5 MB).' }, { status: 413 }));
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const detected = detectUploadType(bytes);
  if (!detected?.mime?.startsWith('image/')) {
    return noStore(NextResponse.json({ error: 'Use a JPEG, PNG, GIF, or WebP image.' }, { status: 415 }));
  }

  const key = `admin-promotions/${Date.now()}-${crypto.randomUUID()}.${detected.extension}`;
  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(key, bytes, {
    contentType: detected.mime,
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) {
    console.error('[admin-promotion-image]', error.code || error.message);
    return noStore(NextResponse.json({ error: 'Could not upload the header image.' }, { status: 500 }));
  }

  const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(key);
  return noStore(NextResponse.json({ url: data.publicUrl, key }, { status: 201 }));
}
