// Google for Jobs (2026-10-02): schema.org JobPosting markup for job posts, so they can appear in
// Google's job search. Google requires the hiring organisation, so posts without one (no employer
// and no publisher alias) get no job markup and keep the page's ordinary markup instead.
// Everything in the markup is also visible on the post page, as Google's guidelines require.

const escapeHtml = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** "Lagos, Lagos State" / "Abuja FCT" / "Port Harcourt, Rivers" -> a schema.org PostalAddress. */
export function nigerianAddress(location) {
  const parts = String(location || '').split(',').map(p => p.trim()).filter(Boolean);
  let locality = parts[0] || 'Nigeria';
  let region = parts[1] || null;
  if (/\bFCT\b/i.test(locality)) { locality = locality.replace(/\s*\bFCT\b/i, '').trim() || 'Abuja'; region = 'Federal Capital Territory'; }
  if (/^nigeria$/i.test(region || '')) region = null;
  return { '@type': 'PostalAddress', addressLocality: locality, ...(region ? { addressRegion: region } : {}), addressCountry: 'NG' };
}

function employmentType(text) {
  const t = String(text).toLowerCase();
  const types = [];
  if (/part[- ]time/.test(t)) types.push('PART_TIME');
  if (/full[- ]time/.test(t)) types.push('FULL_TIME');
  if (/\bcontract\b/.test(t)) types.push('CONTRACTOR');
  if (/\btemporary\b|\btemp\b/.test(t)) types.push('TEMPORARY');
  if (/\bintern(ship)?\b/.test(t)) types.push('INTERN');
  if (/\bvolunteer/.test(t)) types.push('VOLUNTEER');
  return types.length ? types : undefined;
}

// Placeholder employers ("a Reputable Company", "Confidential", "Our client") are not real
// hiring organisations; Google treats such listings as low quality, so they get no job markup.
export function isPlaceholderEmployer(name) {
  return !name || /\b(reputable|confidential|undisclosed|anonymous|our client|a client|leading|reliable|private (company|firm|employer)|a company|an organi[sz]ation|top (company|firm))\b/i.test(String(name));
}

/**
 * JobPosting markup for one post, or null when it should not have any.
 * `employer` is the hiring organisation's name (imported employer, else the publisher's alias).
 */
export function jobPostingFor(post, { employer, origin }) {
  if (!post || post.category !== 'jobs' || isPlaceholderEmployer(employer)) return null;
  // Imported titles are "Role · Employer"; Google's title should be the role alone.
  const title = String(post.title).split(' · ')[0].trim();
  if (!title) return null;
  const body = String(post.description || '').trim() || `${title} in ${post.location || 'Nigeria'}.`;
  return {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title,
    description: escapeHtml(body).split(/\n{2,}/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join(''),
    identifier: { '@type': 'PropertyValue', name: 'Revlo.ng', value: post.uid },
    datePosted: post.created_at,
    ...(post.expires_at ? { validThrough: post.expires_at } : {}),
    ...(employmentType(`${post.title} ${body}`) ? { employmentType: employmentType(`${post.title} ${body}`) } : {}),
    hiringOrganization: { '@type': 'Organization', name: employer },
    jobLocation: { '@type': 'Place', address: nigerianAddress(post.location) },
    directApply: false,
    url: `${origin}/p/${post.uid}`,
    ...(post.header_url ? { image: post.header_url } : {}),
  };
}
