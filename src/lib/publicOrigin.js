const PRODUCTION_ORIGIN = 'https://revlo.ng';

export function publicOrigin() {
  const configured = (process.env.APP_URL || '').trim();
  if (process.env.NODE_ENV !== 'production') return configured || 'http://localhost:3000';
  try {
    const url = new URL(configured);
    if (url.protocol === 'https:' && ['revlo.ng', 'www.revlo.ng'].includes(url.hostname)) {
      return url.origin;
    }
  } catch {}
  return PRODUCTION_ORIGIN;
}
