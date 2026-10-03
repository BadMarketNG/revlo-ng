// Report a scam contact (2026-10-03): one format for emails and numbers so reports and checks match.
// No country is assumed: numbers given with + (or 00) keep it; otherwise digits only.
import crypto from 'crypto';

export const CONTACT_METHODS = ['Through a Revlo post', 'Email', 'Phone call', 'SMS', 'WhatsApp', 'Telegram', 'Social media', 'Other'];
export const SCAM_TYPES = ['Fake job offer', 'Fake landlord or agent', 'Fake buyer or seller', 'Asked for money upfront', 'Pretending to be a company or official', 'Phishing link or code request', 'Other'];

export const hashValue = value => crypto.createHash('sha256').update(String(value).trim().toLowerCase()).digest('hex');

export function cleanEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i.test(email) ? email : null;
}

export function cleanPhone(value) {
  const raw = String(value || '').trim();
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return null;
  return raw.startsWith('+') || raw.startsWith('00') ? `+${digits.replace(/^00/, '')}` : digits;
}

/** Hashes to try for a typed email or number (canonical form plus common number variants). */
export function lookupHashes(value) {
  const email = cleanEmail(value);
  if (email) return [hashValue(email)];
  const raw = String(value || '').trim();
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return [];
  return [...new Set([digits, `+${digits}`, digits.startsWith('00') ? `+${digits.slice(2)}` : null].filter(Boolean))].map(hashValue);
}
