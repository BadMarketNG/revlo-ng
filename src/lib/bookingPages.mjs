// Small branded pages and emails for booking links (2026-10-02).
import { SAFETY_LINES, lagosLabel } from './bookings.mjs';

export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function page(title, inner) {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)} — Revlo.ng</title>
<style>body{font-family:system-ui,-apple-system,sans-serif;background:#f7f5ee;color:#1a1a1a;margin:0;padding:40px 16px}main{max-width:520px;margin:0 auto;background:#fff;border:1px solid #e6e2d6;border-radius:18px;padding:24px}h1{font:900 24px/1.2 Georgia,serif;color:#1b5e20;margin:0 0 10px}p{line-height:1.55}.btns{display:flex;gap:10px;flex-wrap:wrap;margin:18px 0 6px}button,.btn{border:0;border-radius:12px;padding:12px 16px;font:800 15px system-ui;cursor:pointer;text-decoration:none;display:inline-block}.ok{background:#1b5e20;color:#fff}.no{background:#fff;color:#b42318;border:1.5px solid #b42318}.safe{margin-top:18px;padding:12px 14px;border-radius:12px;background:#fff7e6;border:1px solid #f3dfb0;font-size:14px}.safe ul{margin:6px 0 0;padding-left:18px}a{color:#1b5e20;font-weight:700}</style></head><body><main>${inner}<p style="margin-top:20px"><a href="https://revlo.ng/app.html">Back to Revlo.ng</a></p></main></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
}

export const safetyHtml = () => `<div class="safe" style="margin-top:18px;padding:12px 14px;border-radius:12px;background:#fff7e6;border:1px solid #f3dfb0;font-size:14px"><strong>Stay safe</strong><ul style="margin:6px 0 0;padding-left:18px">${SAFETY_LINES.map(l => `<li>${esc(l)}</li>`).join('')}</ul></div>`;

export const what = booking => (booking.mode === 'call' ? 'call' : 'viewing');
export const when = booking => lagosLabel(booking.slot_start);
