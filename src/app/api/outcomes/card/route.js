// Results (2026-10-02): the share card image for a result (1200×630), used as the /r/<id> preview.
import { ImageResponse } from 'next/og';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { headline } from '@/lib/outcomes.mjs';

// Inter (SIL Open Font License), served from Revlo's own public/fonts.
async function fonts() {
  const load = async (weight) => (await fetch(`https://revlo.ng/fonts/inter-${weight}.woff`, { cache: 'force-cache' })).arrayBuffer();
  const [heavy, semi] = await Promise.all([load(900), load(600)]);
  return [{ name: 'Inter', data: heavy, weight: 900, style: 'normal' }, { name: 'Inter', data: semi, weight: 600, style: 'normal' }];
}

export async function GET(request) {
  const id = new URL(request.url).searchParams.get('id') || '';
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response('Not found', { status: 404 });
  const { data: r } = await supabaseAdmin.from('revlo_outcomes').select('outcome,label,hours,share').eq('id', id).maybeSingle();
  if (!r || !r.share) return new Response('Not found', { status: 404 });
  const rooster = 'https://revlo.ng/revlo-rooster.png';
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: '#1b5e20', color: '#fff', padding: '64px 72px', fontFamily: 'Inter', position: 'relative' }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1 }}>
          <div style={{ display: 'flex', fontSize: 36, fontWeight: 900, letterSpacing: -0.5 }}>revlo<span style={{ color: '#f5c518' }}>.ng</span></div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: 28, fontWeight: 900, color: '#f5c518', textTransform: 'uppercase', letterSpacing: 3 }}>
              <div style={{ display: 'flex', width: 34, height: 34, borderRadius: 17, background: '#f5c518', marginRight: 14, alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ display: 'flex', width: 9, height: 17, borderRight: '5px solid #1b5e20', borderBottom: '5px solid #1b5e20', transform: 'rotate(45deg)', marginTop: -4 }} />
              </div>
              Real result
            </div>
            <div style={{ display: 'flex', fontSize: 104, fontWeight: 900, lineHeight: 1.02, marginTop: 10 }}>{headline(r.outcome, Number(r.hours))}</div>
            <div style={{ display: 'flex', fontSize: 40, fontWeight: 600, marginTop: 22, color: '#e6f2e7', maxWidth: 820 }}>{r.label}</div>
          </div>
          <div style={{ display: 'flex', fontSize: 30, fontWeight: 600, color: '#cfe6d1' }}>Post free, no sign-up · revlo.ng</div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={rooster} width={214} height={320} alt="" style={{ position: 'absolute', right: 70, bottom: 60 }} />
      </div>
    ),
    { width: 1200, height: 630, fonts: await fonts(), headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' } },
  );
}
