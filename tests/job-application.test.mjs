import assert from 'node:assert/strict';
import test from 'node:test';
import { validateJobApplication } from '../src/lib/jobApplication.mjs';

const valid = {
  name: 'Ada Okafor', birthDate: '1998-05-13',
  coverLetter: 'I have supported customers for four years and would welcome the opportunity to join your team.',
  filename: 'ada-cv.pdf', bytes: Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(110)]),
};

test('job applications require a valid adult identity, cover letter and PDF or DOCX CV', () => {
  assert.equal(validateJobApplication(valid).contentType, 'application/pdf');
  assert.match(validateJobApplication({ ...valid, name: 'A' }).error, /full name/);
  assert.match(validateJobApplication({ ...valid, birthDate: '2020-01-01' }).error, /at least 18/);
  assert.match(validateJobApplication({ ...valid, birthDate: '1998-02-30' }).error, /valid date/);
  assert.match(validateJobApplication({ ...valid, coverLetter: 'Interested.' }).error, /cover letter/);
  assert.match(validateJobApplication({ ...valid, bytes: Buffer.alloc(110), filename: 'cv.pdf' }).error, /PDF or DOCX/);
  assert.match(validateJobApplication({ ...valid, bytes: Buffer.alloc(4 * 1024 * 1024 + 1) }).error, /under 4 MB/);
});

test('an optional camera photo is private attachment data and must be a small image', () => {
  assert.equal(validateJobApplication(valid).photo, null);
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(110)]);
  const withPhoto = validateJobApplication({ ...valid, photoFilename: 'camera.jpg', photoBytes: jpeg });
  assert.equal(withPhoto.photo.contentType, 'image/jpeg');
  assert.equal(withPhoto.photo.filename, 'camera.jpg');
  assert.match(validateJobApplication({ ...valid, photoFilename: 'bad.jpg', photoBytes: Buffer.alloc(110) }).error, /JPEG, PNG or WebP/);
  assert.match(validateJobApplication({ ...valid, photoFilename: 'big.jpg', photoBytes: Buffer.alloc(200 * 1024 + 1) }).error, /under 200 KB/);
});
