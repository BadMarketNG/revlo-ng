// Keeps private job sources out of anything sent to applicants (2026-10-03).

export function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; }
}

// Job sources that must never reach an applicant (they would reveal where the jobs come from).
const PRIVATE_SOURCE_HOSTS = ['jooble.org', 'jooble.com', 'careerjet.com', 'careerjet.com.ng'];

/** True if a link sent to an applicant would point at a private job source. */
export function revealsSource(text, extraHosts = []) {
  const hosts = [...PRIVATE_SOURCE_HOSTS, ...extraHosts.filter(Boolean)];
  const urls = String(text || '').match(/https?:\/\/[^\s<>"']+/gi) || [];
  if (urls.some(u => { const h = hostOf(u); return hosts.some(s => h === s || h.endsWith(`.${s}`)); })) return true;
  return /\b(jooble|careerjet)\b/i.test(String(text || ''));
}
