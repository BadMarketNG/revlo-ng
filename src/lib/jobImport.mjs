// Job import (2026-10-02): turns partner job listings into Revlo posts published by support@revlo.ng.
// The source is confidential (owner's choice): posts name the employer and place, never the source,
// and carry no outside link. Applicants use the post's normal Contact, which reaches support@revlo.ng;
// support finds the listing in revlo_imported_jobs by the post's uid.
import { stripPostLinks } from './postLinks.mjs';

export const JOB_POSTER = 'support@revlo.ng';
export const JOB_HEADERS = ['jobs-1', 'jobs-2', 'jobs-3', 'jobs-4', 'jobs-5'];
export const JOB_ICONS = ['01', '07', '12', '13', '14'];

// Revlo's own place names (the feed's location filter matches these exactly). Imported listings use
// them, so "Lagos, Lagos State" from a partner shows under "Lagos, Nigeria". (2026-10-03 fix.)
export const REVLO_LOCATIONS = ['Lagos, Nigeria', 'Abuja FCT', 'Kano, Kano State', 'Ibadan, Oyo State', 'Port Harcourt, Rivers', 'Enugu, Enugu State', 'Kaduna, Kaduna State', 'Benin City, Edo State'];
export function revloLocation(place) {
  const text = String(place || '').toLowerCase();
  const match = REVLO_LOCATIONS.find(l => text.includes(l.split(/[ ,]/)[0].toLowerCase()) || (l === 'Abuja FCT' && /\bfct\b/.test(text)) || (l === 'Port Harcourt, Rivers' && text.includes('port harcourt')) || (l === 'Benin City, Edo State' && text.includes('benin')));
  return match || (String(place || '').trim() || 'Nigeria');
}

export const hash = text => [...String(text)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/** The post fields for one normalised job (see fromJooble in partnerFeed.mjs). */
export function jobToPost(job, origin = 'https://revlo.ng') {
  const h = hash(job.id);
  const title = stripPostLinks(job.title.split(' · ')[0]).slice(0, 120);
  // ORIGINAL (2026-10-03): const place = job.location || 'Nigeria';
  const place = revloLocation(job.location);
  const lines = [
    job.company ? `${stripPostLinks(job.company)} is hiring: ${title}.` : `Hiring: ${title}.`,
    stripPostLinks(job.summary) || null,
    job.salary ? `Pay: ${stripPostLinks(job.salary)}` : null,
    'Interested? Use Contact on this post with your name and phone number and Revlo will pass on how to apply.',
  ].filter(Boolean);
  const city = place.split(',')[0].trim().toLowerCase();
  return {
    title: job.company ? `${title} · ${stripPostLinks(job.company)}`.slice(0, 200) : title,
    description: lines.join('\n\n').slice(0, 5000),
    location: place.slice(0, 200),
    category: 'jobs',
    header_url: `${origin}/samples/headers/${JOB_HEADERS[h % JOB_HEADERS.length]}.jpg`,
    thumb_url: `${origin}/samples/icons/icon-${JOB_ICONS[(h >> 3) % JOB_ICONS.length]}.jpg`,
    tags: ['jobs', city].filter(t => /^[a-z][a-z ]{1,30}$/.test(t)),
  };
}
