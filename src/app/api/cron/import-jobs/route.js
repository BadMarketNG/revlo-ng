// Job import cron (2026-10-02, additive). Once a day: fetch jobs from the partner job API and
// publish new ones as 24-hour Revlo posts by support@revlo.ng (they show in "Right now" and Jobs).
// Protected like /api/cron/expire: Vercel Cron sends "Authorization: Bearer <CRON_SECRET>".
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { constantTimeBearerMatches, requiredSecret } from '@/lib/security';
import { makeUid, expiryFor } from '@/lib/util';
import { USER_AGENT, fromJooble } from '@/lib/partnerFeed.mjs';
import { JOB_POSTER, jobToPost } from '@/lib/jobImport.mjs';
import { notifyIndexNow } from '@/lib/indexNow.mjs';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// One search per city per day (about 90 requests a month against the 500-request allowance).
const CITIES = ['Lagos', 'Abuja', 'Port Harcourt'];
const MAX_NEW_PER_RUN = 30;

async function fetchJobs(key) {
  const all = [];
  for (const city of CITIES) {
    try {
      const response = await fetch(`https://ng.jooble.org/api/${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
        body: JSON.stringify({ keywords: 'jobs', location: city }),
        cache: 'no-store',
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) { console.error('[cron:import-jobs]', city, 'status', response.status); continue; }
      const body = await response.json();
      all.push(...(body.jobs ?? []).map(fromJooble).filter(Boolean));
    } catch (error) { console.error('[cron:import-jobs]', city, error?.name || 'failed'); }
  }
  return all;
}

export async function GET(request) {
  let secret;
  try { secret = requiredSecret('CRON_SECRET'); } catch (error) {
    console.error('[cron:import-jobs]', error.message);
    return NextResponse.json({ error: 'service unavailable' }, { status: 503 });
  }
  if (!constantTimeBearerMatches(request.headers.get('authorization') || '', secret)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const key = process.env.JOOBLE_API_KEY;
  if (!key) return NextResponse.json({ ok: true, imported: 0, reason: 'no key' });

  const jobs = await fetchJobs(key);
  const ids = [...new Set(jobs.map(j => j.id))];
  const { data: known } = ids.length
    ? await supabaseAdmin.from('revlo_imported_jobs').select('external_id').in('external_id', ids)
    : { data: [] };
  const seen = new Set((known ?? []).map(r => r.external_id));
  if (seen.size) await supabaseAdmin.from('revlo_imported_jobs').update({ last_seen_at: new Date().toISOString() }).in('external_id', [...seen]);

  let imported = 0;
  const newUids = [];
  const done = new Set();
  for (const job of jobs) {
    if (imported >= MAX_NEW_PER_RUN) break;
    if (seen.has(job.id) || done.has(job.id)) continue;
    done.add(job.id);
    // Claim the job first so two runs can never publish it twice.
    const { error: claimError } = await supabaseAdmin.from('revlo_imported_jobs')
      .insert({ external_id: job.id, listing_url: job.url, title: job.title, company: job.company, location: job.location });
    if (claimError) continue;
    const post = jobToPost(job);
    const uid = makeUid();
    const { error } = await supabaseAdmin.from('posts').insert({
      uid,
      poster_email: JOB_POSTER,
      ...post,
      media_type: 'images',
      gallery: [],
      contact_visibility: 'public',
      followable: true,
      duration: 'now',
      expires_at: expiryFor('now'),
      trust_badge: null,
      premium_badge: false,
    });
    if (error) {
      console.error('[cron:import-jobs] insert', error.code || error.message);
      await supabaseAdmin.from('revlo_imported_jobs').delete().eq('external_id', job.id);
      continue;
    }
    await supabaseAdmin.from('revlo_imported_jobs').update({ post_uid: uid }).eq('external_id', job.id);
    imported += 1;
    newUids.push(uid);
  }
  await notifyIndexNow(newUids.map(u => `https://revlo.ng/p/${u}`));
  console.info('[cron:import-jobs]', 'fetched', jobs.length, 'already known', seen.size, 'imported', imported);
  return NextResponse.json({ ok: true, fetched: jobs.length, imported });
}
