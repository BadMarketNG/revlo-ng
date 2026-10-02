// IndexNow (2026-10-02): tells Bing, Yandex, Seznam, Naver and other participating search engines
// about new post pages the moment they are published (Revlo posts can live for only 24 hours).
// The key is public by design: search engines check it at https://revlo.ng/<key>.txt.
// Google does not take part; it uses the sitemap and the post pages' markup.

export const INDEXNOW_KEY = '70e07e3a8824a04d0a4c05d10a403547';
const HOST = 'revlo.ng';

/** Notifies IndexNow about up to 10,000 URLs on revlo.ng. Production only; never throws. */
export async function notifyIndexNow(urls) {
  const list = [...new Set([].concat(urls))].filter(u => typeof u === 'string' && u.startsWith(`https://${HOST}/`)).slice(0, 10000);
  if (!list.length || process.env.VERCEL_ENV !== 'production') return { skipped: true };
  try {
    const response = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host: HOST, key: INDEXNOW_KEY, keyLocation: `https://${HOST}/${INDEXNOW_KEY}.txt`, urlList: list }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok && response.status !== 202) console.error('[indexnow]', response.status);
    return { ok: response.ok, status: response.status };
  } catch (error) {
    console.error('[indexnow]', error?.name || 'failed');
    return { ok: false };
  }
}
