// Job import (2026-10-02): turns partner job listings into Revlo posts published by support@revlo.ng.
// The source is confidential (owner's choice): posts name the employer and place, never the source,
// and carry no outside link. Applicants use the post's normal Contact, which reaches support@revlo.ng;
// support finds the listing in revlo_imported_jobs by the post's uid.

export const JOB_POSTER = 'support@revlo.ng';
export const JOB_HEADERS = ['jobs-1', 'jobs-2', 'jobs-3', 'jobs-4', 'jobs-5'];
export const JOB_ICONS = ['01', '07', '12', '13', '14'];

export const hash = text => [...String(text)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/** The post fields for one normalised job (see fromJooble in partnerFeed.mjs). */
export function jobToPost(job, origin = 'https://revlo.ng') {
  const h = hash(job.id);
  const title = job.title.split(' · ')[0].slice(0, 120);
  const place = job.location || 'Nigeria';
  const lines = [
    job.company ? `${job.company} is hiring: ${title}.` : `Hiring: ${title}.`,
    job.summary || null,
    job.salary ? `Pay: ${job.salary}` : null,
    'Interested? Use Contact on this post with your name and phone number and Revlo will pass on how to apply.',
  ].filter(Boolean);
  const city = place.split(',')[0].trim().toLowerCase();
  return {
    title: job.company ? `${title} · ${job.company}`.slice(0, 200) : title,
    description: lines.join('\n\n').slice(0, 5000),
    location: place.slice(0, 200),
    category: 'jobs',
    header_url: `${origin}/samples/headers/${JOB_HEADERS[h % JOB_HEADERS.length]}.jpg`,
    thumb_url: `${origin}/samples/icons/icon-${JOB_ICONS[(h >> 3) % JOB_ICONS.length]}.jpg`,
    tags: ['jobs', city].filter(t => /^[a-z][a-z ]{1,30}$/.test(t)),
  };
}
