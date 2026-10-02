// Telegram Bot API helpers (2026-10-02). TELEGRAM_BOT_TOKEN is set in Vercel; it never reaches the page.
import crypto from 'crypto';

const api = (method) => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`;

export async function telegram(method, params) {
  const response = await fetch(api(method), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params || {}), signal: AbortSignal.timeout(10000) });
  const body = await response.json().catch(() => ({}));
  if (!body.ok) throw new Error(`telegram ${method}: ${body.description || response.status}`);
  return body.result;
}

/** Downloads the largest photo (up to 1.5 MB) and stores it in Revlo's media bucket; returns its public URL. */
export async function copyPhoto(db, photos) {
  const best = [...(photos || [])].filter(p => !p.file_size || p.file_size <= 1.5 * 1024 * 1024).sort((a, b) => (b.width * b.height) - (a.width * a.height))[0];
  if (!best) return null;
  const file = await telegram('getFile', { file_id: best.file_id });
  const response = await fetch(`https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) return null;
  const bytes = Buffer.from(await response.arrayBuffer());
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
  const png = bytes[0] === 0x89 && bytes[1] === 0x50;
  if (!jpeg && !png) return null;
  const bucket = process.env.STORAGE_BUCKET || 'media';
  const key = `telegram-${Date.now()}-${crypto.randomUUID()}.${png ? 'png' : 'jpg'}`;
  const { error } = await db.storage.from(bucket).upload(key, bytes, { contentType: png ? 'image/png' : 'image/jpeg', upsert: false });
  if (error) return null;
  return db.storage.from(bucket).getPublicUrl(key).data.publicUrl;
}

export const secretMatches = (header) => {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET || '';
  const given = String(header || '');
  return expected.length >= 16 && given.length === expected.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
};
