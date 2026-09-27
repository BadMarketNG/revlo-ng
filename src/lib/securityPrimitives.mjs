export function serializeJsonForHtml(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function requiredSecret(name, minimumLength = 32) {
  const secret = process.env[name] || '';
  if (secret.length < minimumLength) {
    throw new Error(`${name} must be configured with at least ${minimumLength} characters.`);
  }
  return secret;
}

export function detectUploadType(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: 'image/jpeg', extension: 'jpg' };
  }
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mime: 'image/png', extension: 'png' };
  }
  const prefix = bytes.subarray(0, 6).toString('ascii');
  if (prefix === 'GIF87a' || prefix === 'GIF89a') {
    return { mime: 'image/gif', extension: 'gif' };
  }
  if (bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') {
    return { mime: 'image/webp', extension: 'webp' };
  }
  if (bytes.subarray(4, 8).toString('ascii') === 'ftyp') {
    return { mime: 'video/mp4', extension: 'mp4' };
  }
  if (bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) {
    return { mime: 'video/webm', extension: 'webm' };
  }
  return null;
}
