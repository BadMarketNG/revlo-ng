export const DEFAULT_HOMEPAGE_COPY = Object.freeze({
  heroLine1: 'Find work, places and things nearby.',
  heroLine2: 'Post what you have or need.',
  heroDescription: 'Browse jobs, rentals and items for sale in your city. Post an offer or ask for what you need in minutes. Interested people reply through Revlo, and every post expires automatically.',
  urgentPrompts: ['Need staff today?', 'Room free this weekend?', 'Selling before you travel?', 'Promotion ends tonight?'],
  urgentButton: 'Post a 24-hour listing',
  benefitNoSignup: 'No sign-up',
  benefitEnquiries: 'Direct enquiries',
  benefitViewings: 'Request viewings online',
  benefitExpiry: 'Expires in 24h–2½ weeks',
});

const clean = (value, fallback, max) => {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
  return normalized || fallback;
};

export function normalizeHomepageCopy(input = {}) {
  const prompts = Array.isArray(input.urgentPrompts ?? input.urgent_prompts)
    ? (input.urgentPrompts ?? input.urgent_prompts)
    : [];
  return {
    heroLine1: clean(input.heroLine1 ?? input.hero_line_1, DEFAULT_HOMEPAGE_COPY.heroLine1, 90),
    heroLine2: clean(input.heroLine2 ?? input.hero_line_2, DEFAULT_HOMEPAGE_COPY.heroLine2, 90),
    heroDescription: clean(input.heroDescription ?? input.hero_description, DEFAULT_HOMEPAGE_COPY.heroDescription, 320),
    urgentPrompts: DEFAULT_HOMEPAGE_COPY.urgentPrompts.map((fallback, index) => clean(prompts[index], fallback, 70)),
    urgentButton: clean(input.urgentButton ?? input.urgent_button, DEFAULT_HOMEPAGE_COPY.urgentButton, 45),
    benefitNoSignup: clean(input.benefitNoSignup ?? input.benefit_no_signup, DEFAULT_HOMEPAGE_COPY.benefitNoSignup, 45),
    benefitEnquiries: clean(input.benefitEnquiries ?? input.benefit_enquiries, DEFAULT_HOMEPAGE_COPY.benefitEnquiries, 45),
    benefitViewings: clean(input.benefitViewings ?? input.benefit_viewings, DEFAULT_HOMEPAGE_COPY.benefitViewings, 45),
    benefitExpiry: clean(input.benefitExpiry ?? input.benefit_expiry, DEFAULT_HOMEPAGE_COPY.benefitExpiry, 45),
  };
}

export async function getHomepageCopy(db) {
  const { data, error } = await db.from('admin_log').select('detail').eq('action', 'homepage_copy_settings').order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) {
    console.error('[homepage-copy:read]', error.message || error);
    return normalizeHomepageCopy();
  }
  return normalizeHomepageCopy(data?.detail || {});
}
