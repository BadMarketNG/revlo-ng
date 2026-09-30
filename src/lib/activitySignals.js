import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { normaliseEmail, requestIp } from '@/lib/revloBlocklist';

// Collusion signals (2026-09-30). A random first-party device cookie ties
// actions from the same browser together, so an administrator can see when a
// poster's followers were created on the poster's own device.
export const DEVICE_COOKIE = 'revlo_device';
const DEVICE_MAX_AGE = 2 * 365 * 24 * 60 * 60;

export function deviceIdFrom(request) {
  const existing = request.cookies?.get?.(DEVICE_COOKIE)?.value;
  return typeof existing === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(existing) ? existing : null;
}

// Returns the request's device ID, creating one when the browser has none.
export function ensureDeviceId(request) {
  return deviceIdFrom(request) || crypto.randomBytes(18).toString('base64url');
}

export function attachDeviceCookie(response, deviceId) {
  if (!deviceId) return response;
  response.cookies.set(DEVICE_COOKIE, deviceId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: DEVICE_MAX_AGE,
  });
  return response;
}

// Best effort: a failure to record a signal must never block the user's action.
export async function recordSignal(request, { kind, actorEmail, subjectEmail = null, postUid = null, deviceId = null }) {
  try {
    const userAgent = request.headers.get('user-agent') || '';
    await supabaseAdmin.from('revlo_activity_signals').insert({
      kind,
      actor_email: normaliseEmail(actorEmail),
      subject_email: subjectEmail ? normaliseEmail(subjectEmail) : null,
      post_uid: postUid,
      ip: requestIp(request) || null,
      device_id: deviceId || deviceIdFrom(request),
      ua_hash: userAgent ? crypto.createHash('sha256').update(userAgent).digest('hex').slice(0, 16) : null,
    });
  } catch (error) {
    console.error('[activity-signals]', error?.message || error);
  }
}
