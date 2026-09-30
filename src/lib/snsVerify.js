import crypto from 'crypto';

// Verifies that a message really came from Amazon SNS (2026-09-30): the
// signing certificate must be served by sns.<region>.amazonaws.com over HTTPS,
// and the message signature must check out against it.
const CERT_HOST = /^sns\.[a-z0-9-]+\.amazonaws\.com$/;
const certCache = new Map();

function isAwsSnsUrl(value, pathTest) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && CERT_HOST.test(url.hostname) && pathTest(url.pathname);
  } catch {
    return false;
  }
}

export const isSnsSubscribeUrl = (value) => isAwsSnsUrl(value, () => true);

function stringToSign(message) {
  const keys = message.Type === 'Notification'
    ? ['Message', 'MessageId', 'Subject', 'Timestamp', 'TopicArn', 'Type']
    : ['Message', 'MessageId', 'SubscribeURL', 'Timestamp', 'Token', 'TopicArn', 'Type'];
  return keys.filter((key) => message[key] !== undefined).map((key) => `${key}\n${message[key]}\n`).join('');
}

export async function verifySnsMessage(message) {
  if (!message || typeof message.Signature !== 'string') return false;
  if (!isAwsSnsUrl(message.SigningCertURL, (path) => path.endsWith('.pem'))) return false;
  let cert = certCache.get(message.SigningCertURL);
  if (!cert) {
    const response = await fetch(message.SigningCertURL, { cache: 'no-store' });
    if (!response.ok) return false;
    cert = await response.text();
    certCache.set(message.SigningCertURL, cert);
  }
  const algorithm = message.SignatureVersion === '2' ? 'RSA-SHA256' : 'RSA-SHA1';
  try {
    return crypto.createVerify(algorithm).update(stringToSign(message), 'utf8').verify(cert, message.Signature, 'base64');
  } catch {
    return false;
  }
}
