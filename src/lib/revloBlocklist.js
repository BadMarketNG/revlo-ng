import { isIP } from 'node:net';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export function normaliseEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function normaliseIp(value) {
  const candidate = typeof value === 'string' ? value.trim().replace(/^\[|\]$/g, '') : '';
  return isIP(candidate) ? candidate : '';
}

export function requestIp(request) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0];
  return normaliseIp(forwarded || request.headers.get('x-real-ip') || '');
}

export async function findActiveBlock({ email, ip }) {
  const checks = [];
  const cleanEmail = normaliseEmail(email);
  const cleanIp = normaliseIp(ip);
  if (cleanEmail) checks.push(['email', cleanEmail]);
  if (cleanIp) checks.push(['ip', cleanIp]);

  const now = new Date();
  for (const [blockType, value] of checks) {
    const { data } = await supabaseAdmin
      .from('revlo_access_blocks')
      .select('id,block_type,value,reason,expires_at')
      .eq('block_type', blockType)
      .eq('value', value)
      .maybeSingle();
    if (data && (!data.expires_at || new Date(data.expires_at) > now)) return data;
  }
  return null;
}

export function blockedResponse() {
  return NextResponse.json(
    { error: 'This email or network address cannot perform this action on Revlo.' },
    { status: 403, headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function addAutomaticBlocks({ email, ip, reason, source, durationMs }) {
  const expiresAt = new Date(Date.now() + durationMs).toISOString();
  const candidates = [
    ['email', normaliseEmail(email)],
    ['ip', normaliseIp(ip)],
  ].filter(([, value]) => value);

  for (const [blockType, value] of candidates) {
    const { data: existing } = await supabaseAdmin
      .from('revlo_access_blocks')
      .select('id,source,expires_at')
      .eq('block_type', blockType)
      .eq('value', value)
      .maybeSingle();
    if (!existing) {
      await supabaseAdmin.from('revlo_access_blocks').insert({
        block_type: blockType,
        value,
        reason,
        source,
        expires_at: expiresAt,
        created_by: 'automatic',
      });
    } else if (existing.source !== 'manual' && existing.expires_at && new Date(existing.expires_at) <= new Date()) {
      await supabaseAdmin.from('revlo_access_blocks').update({
        reason,
        source,
        expires_at: expiresAt,
        created_by: 'automatic',
        created_at: new Date().toISOString(),
      }).eq('id', existing.id);
    }
  }
}
