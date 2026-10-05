const PDF = 'application/pdf';
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const MAX_CV_BYTES = 4 * 1024 * 1024;

export function validateJobApplication({ name, birthDate, coverLetter, filename, bytes }) {
  const cleanName = String(name || '').trim().replace(/\s+/g, ' ');
  const cleanLetter = String(coverLetter || '').trim();
  const date = String(birthDate || '');
  if (cleanName.length < 3 || cleanName.length > 120 || !/^[\p{L}\p{M} .'-]+$/u.test(cleanName)) return { error: 'Enter your full name.' };
  const adultCutoff = new Date();
  adultCutoff.setUTCFullYear(adultCutoff.getUTCFullYear() - 18);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T00:00:00Z`))
    || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date
    || date < '1900-01-01' || date > adultCutoff.toISOString().slice(0, 10)) return { error: 'Enter a valid date of birth. Applicants must be at least 18.' };
  if (cleanLetter.length < 40 || cleanLetter.length > 2000) return { error: 'Write a short cover letter of 40 to 2,000 characters.' };
  if (!Buffer.isBuffer(bytes) || bytes.length < 100 || bytes.length > MAX_CV_BYTES) return { error: 'Upload a CV under 4 MB.' };
  const safeFilename = String(filename || '').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100);
  const pdf = /\.pdf$/i.test(safeFilename) && bytes.subarray(0, 5).toString() === '%PDF-';
  const docx = /\.docx$/i.test(safeFilename) && bytes.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  if (!pdf && !docx) return { error: 'Upload a PDF or DOCX CV.' };
  return { name: cleanName, birthDate: date, coverLetter: cleanLetter, filename: safeFilename,
    contentType: pdf ? PDF : DOCX, bytes };
}
