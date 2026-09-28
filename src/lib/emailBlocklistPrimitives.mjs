import { domainToASCII } from 'node:url';

const DOMAIN_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function normaliseDomain(value) {
  if (typeof value !== 'string') return '';
  const stripped = value.trim().toLowerCase().replace(/^\*@/, '').replace(/^@/, '').replace(/\.$/, '');
  const ascii = domainToASCII(stripped);
  return ascii && DOMAIN_PATTERN.test(ascii) ? ascii : '';
}

export function emailDomain(value) {
  if (typeof value !== 'string') return '';
  const at = value.lastIndexOf('@');
  if (at <= 0 || at === value.length - 1) return '';
  return normaliseDomain(value.slice(at + 1));
}

export function normaliseEmailRule(value, normaliseEmail) {
  if (typeof value !== 'string') return '';
  const candidate = value.trim().toLowerCase();
  if (candidate.startsWith('*@') || candidate.startsWith('@')) {
    const domain = normaliseDomain(candidate);
    return domain ? `*@${domain}` : '';
  }
  return normaliseEmail(candidate);
}

export function wildcardCandidates(value) {
  const domain = emailDomain(value);
  if (!domain) return [];
  const labels = domain.split('.');
  const candidates = [];
  // Do not create a wildcard for a bare public suffix/TLD. The full domain and
  // its progressively broader parents are sufficient for administrator rules.
  for (let index = 0; index < labels.length - 1; index += 1) {
    candidates.push(`*@${labels.slice(index).join('.')}`);
  }
  return candidates;
}

export function domainIsListed(value, domains) {
  const domain = emailDomain(value);
  if (!domain) return false;
  if (domains.has(domain)) return true;
  const labels = domain.split('.');
  for (let index = 1; index < labels.length - 1; index += 1) {
    if (domains.has(labels.slice(index).join('.'))) return true;
  }
  return false;
}
