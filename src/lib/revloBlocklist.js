import { isIP } from 'node:net';
import { readFileSync } from 'node:fs';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  domainIsListed,
  normaliseEmailRule,
  wildcardCandidates,
} from '@/lib/emailBlocklistPrimitives.mjs';

const DISPOSABLE_DOMAINS_PATH = new URL('../data/disposable-email-domains.txt', import.meta.url);
const DISPOSABLE_METADATA_PATH = new URL('../data/disposable-email-domains.metadata.json', import.meta.url);
const disposableMetadata = JSON.parse(readFileSync(DISPOSABLE_METADATA_PATH, 'utf8'));
let disposableDomains;

function knownDisposableDomains() {
  if (!disposableDomains) {
    disposableDomains = new Set(
      readFileSync(DISPOSABLE_DOMAINS_PATH, 'utf8')
        .split(/\r?\n/)
        .map((domain) => domain.trim().toLowerCase())
        .filter(Boolean),
    );
  }
  return disposableDomains;
}

export const BUILT_IN_BLOCKLIST = Object.freeze({
  source: 'mehrtat/disposable-email-domain',
  snapshot: disposableMetadata.retrieved_at,
  count: disposableMetadata.count,
});

export function normaliseEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function normaliseBlockValue(value) {
  return normaliseEmailRule(value, normaliseEmail);
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
  const cleanEmail = normaliseEmail(email);
  const cleanIp = normaliseIp(ip);

  if (cleanEmail && domainIsListed(cleanEmail, knownDisposableDomains())) {
    return {
      id: null,
      block_type: 'email',
      value: `*@${cleanEmail.split('@').pop()}`,
      reason: 'Known disposable email provider',
      source: 'built_in_disposable_domains',
      expires_at: null,
    };
  }

  const now = new Date();
  const checks = [];
  if (cleanEmail) checks.push(['email', [cleanEmail, ...wildcardCandidates(cleanEmail)]]);
  if (cleanIp) checks.push(['ip', [cleanIp]]);
  for (const [blockType, values] of checks) {
    const { data, error } = await supabaseAdmin
      .from('revlo_access_blocks')
      .select('id,block_type,value,reason,expires_at')
      .eq('block_type', blockType)
      .in('value', values)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Revlo block-list lookup failed for ${blockType}`);
    const active = data?.find((row) => !row.expires_at || new Date(row.expires_at) > now);
    if (active) return active;
  }
  return null;
}

export function silentEmailSuccess(extra = {}) {
  return NextResponse.json({ ok: true, ...extra }, { headers: { 'Cache-Control': 'private, no-store' } });
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
