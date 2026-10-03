const INTENTS = {
  dating: 'dating',
  relationship: 'a relationship',
  marriage: 'marriage',
};

const contactDetails = /(?:https?:\/\/|www\.|[\w.+-]+@[\w.-]+\.[a-z]{2,}|\+?234[\s.-]?[789]\d|\b0[789]\d{9}\b|\b(?:whatsapp|telegram|instagram|snapchat|tiktok|dm me|message me at)\b)/i;

export function cleanDatingProfile({ title, description, location, profile, mediaType, contactVisibility }) {
  if (!profile || profile.confirmed_adult !== true || profile.confirmed_self !== true || profile.confirmed_photo !== true) {
    return { error: 'Confirm you are 18 or older, this is your own profile, and the photo shows you.' };
  }
  const age = Number(profile.age);
  if (!Number.isInteger(age) || age < 18 || age > 99) return { error: 'Enter your age (18 or older).' };
  const intent = INTENTS[profile.intent];
  if (!intent) return { error: 'Choose what you are looking for.' };
  const name = String(title || '').trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 40 || !/^[\p{L}][\p{L}\p{M}\s'’-]*$/u.test(name)) {
    return { error: 'Use a first name or nickname of 2–40 letters as the title.' };
  }
  const about = String(description || '').trim();
  if (about.length < 30 || about.length > 1000) return { error: 'Introduce yourself in 30–1000 characters.' };
  const area = String(location || '').trim();
  if (!area || area.length > 80 || /\d|\b(?:street|road|avenue|close|estate|house number|flat number)\b/i.test(area)) {
    return { error: 'Use a city or broad area, not an exact address.' };
  }
  if (contactDetails.test(`${name} ${about}`)) return { error: 'Keep phone numbers, social handles, email addresses and links out of your profile. Use Revlo Contact instead.' };
  if (/\b(?:underage|minor|teenager|schoolgirl|schoolboy)\b/i.test(about)) return { error: 'Dating profiles must be for adults.' };
  if (/\b(?:send me money|pay me first|deposit|gift cards?|airtime|transport fare|travel fare)\b/i.test(about)) return { error: 'Dating profiles cannot ask for money, fares, deposits or gifts.' };
  if (mediaType !== 'images') return { error: 'Use your own photo for a dating profile.' };
  if (contactVisibility !== 'public') return { error: 'Turn on Revlo Contact so people can reply without seeing your email.' };
  return { title: `${name}, ${age}`, description: `Looking for ${intent}.\n\n${about}`, details: { age, intent: profile.intent } };
}
