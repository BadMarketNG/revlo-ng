// Telegram partner import (2026-10-02): turns a channel post into Revlo post fields.

const RULES = [
  ['jobs', /\b(hiring|vacanc(y|ies)|job (opening|alert|offer)|we are recruiting|recruitment|apply (now|via|here|before)|salary|cv to|send (your )?cv|position:|graduate trainee|internship)\b/i],
  ['rentals', /\b(to let|for rent|rent:|per annum|self[- ]?con(tain(ed)?)?|bedroom|bed ?flat|mini ?flat|shortlet|short let|apartment|duplex|bungalow|office space|shop space|caution fee|agency fee)\b/i],
  ['for_sale', /\b(for sale|selling|price:|brand new|fairly used|tokunbo|uk used|negotiable|buy now|in stock|available for sale|dm to (buy|order))\b|₦\s?\d/i],
  ['promotions', /\b(promo|discount|\d+% off|giveaway|special offer|event|tickets?|launch|grand opening|this weekend only)\b/i],
];

export function classify(text, fallback = 'general') {
  for (const [category, pattern] of RULES) if (pattern.test(text)) return category;
  return fallback;
}

const CITIES = [['Lagos', 'Lagos, Nigeria'], ['Ikeja', 'Lagos, Nigeria'], ['Lekki', 'Lagos, Nigeria'], ['Yaba', 'Lagos, Nigeria'], ['Surulere', 'Lagos, Nigeria'], ['Ajah', 'Lagos, Nigeria'],
  ['Abuja', 'Abuja FCT'], ['Gwarinpa', 'Abuja FCT'], ['Wuse', 'Abuja FCT'], ['Maitama', 'Abuja FCT'], ['Port Harcourt', 'Port Harcourt, Rivers'], ['Ibadan', 'Ibadan, Oyo State'],
  ['Kano', 'Kano, Kano State'], ['Enugu', 'Enugu, Enugu State'], ['Kaduna', 'Kaduna, Kaduna State'], ['Benin City', 'Benin City, Edo State'], ['Abeokuta', 'Abeokuta, Ogun State'],
  ['Owerri', 'Owerri, Imo State'], ['Uyo', 'Uyo, Akwa Ibom'], ['Calabar', 'Calabar, Cross River'], ['Jos', 'Jos, Plateau State'], ['Ilorin', 'Ilorin, Kwara State'], ['Warri', 'Warri, Delta State']];

export function detectLocation(text, fallback = 'Nigeria') {
  for (const [name, location] of CITIES) if (new RegExp(`\\b${name}\\b`, 'i').test(text)) return location;
  return fallback || 'Nigeria';
}

/** First meaningful line as the title, the rest as the description. */
export function splitPost(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean);
  const at = lines.findIndex(l => /[\p{L}\p{N}]{3,}/u.test(l));
  if (at < 0) return { title: '', description: '' };
  const first = lines[at].replace(/^[^\p{L}\p{N}₦]+/u, '').replace(/[*_~`]+/g, '').replace(/\s+/g, ' ').trim();
  const title = first.length > 120 ? `${first.slice(0, 117).replace(/\s+\S*$/, '')}…` : first;
  const rest = lines.slice(at + 1).join('\n');
  return { title, description: (rest || first).slice(0, 4500) };
}

/** Fields for a Revlo post from a Telegram message and its channel's settings. */
export function telegramToPost(message, channel) {
  const text = message.text || message.caption || '';
  const { title, description } = splitPost(text);
  if (!title || title.length < 3) return null;
  const category = classify(text, channel.default_category);
  const credit = channel.credit ? `\n\nShared from Telegram: ${channel.credit_name || (channel.username ? `@${channel.username}` : channel.title)}` : '';
  return {
    title: title.slice(0, 200),
    description: `${description}${credit}`.slice(0, 5000),
    location: detectLocation(text, channel.default_area),
    category,
  };
}
