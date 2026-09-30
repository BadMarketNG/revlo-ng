// Inbox identity (2026-09-30). Different spellings of one address reach the
// same inbox: Gmail ignores dots and anything after "+", and most providers
// deliver "name+anything@" to "name@". canonicalInbox() maps every spelling to
// one value so a single person cannot follow a poster many times, or follow
// themselves, with address variations.
const GMAIL_DOMAINS = new Set(['gmail.com', 'googlemail.com']);

export function canonicalInbox(email) {
  const clean = String(email || '').trim().toLowerCase();
  const at = clean.lastIndexOf('@');
  if (at < 1) return clean;
  let local = clean.slice(0, at);
  let domain = clean.slice(at + 1);
  const plus = local.indexOf('+');
  if (plus > 0) local = local.slice(0, plus);
  if (GMAIL_DOMAINS.has(domain)) {
    local = local.replace(/\./g, '');
    domain = 'gmail.com';
  }
  return `${local}@${domain}`;
}

export const sameInbox = (a, b) => canonicalInbox(a) === canonicalInbox(b);
