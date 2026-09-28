import LegalPage, { CONTACT_EMAIL } from '@/components/LegalPage';

export const metadata = {
  title: 'Community Rules — Revlo.ng',
  description: 'What you can and cannot post on Revlo.ng, and how we keep jobs, rentals, sales and promotions safe.',
  alternates: { canonical: '/rules' },
};

const SECTIONS = [
  ['Who can post',
    [
      'You must be at least 18 years old to publish, contact a poster, follow a publisher or pay for a feature.',
      'Use an email address you own and can read. Disposable or throwaway email services are not accepted.',
      'Each emailed publish link creates one post. Do not share, sell or reuse publish links.',
      'One person, one identity. Do not impersonate another person, business, government agency or Revlo.',
    ]],
  ['Every post must be honest',
    [
      'Describe exactly what is on offer: the real job, property, item, service or event.',
      'Use your own photos or videos, or ones you have permission to use. Photos must show the actual item or property, not stock or copied images.',
      'State prices in naira (₦) and include every fee the other person will have to pay. No hidden charges.',
      'Choose the correct category and location. Do not post the same thing repeatedly or in several categories to gain visibility.',
      'Remove or let your post expire as soon as the job is filled, the property is let or the item is sold.',
    ]],
  ['Jobs',
    [
      'Only post real vacancies that you are authorised to fill. Include the role, location, and pay or pay range where possible.',
      'Never charge applicants for applying, interviews, training, uniforms, medicals or "processing". Any job that asks candidates to pay will be removed and the poster blocked.',
      'No discrimination on the grounds of ethnicity, religion, gender, disability or marital status, except where the law genuinely allows it for the role.',
      'No pyramid, multi-level recruitment or "earn from home" schemes where income depends on recruiting others or paying first.',
      'Offers to work abroad must name the real employer and must not ask for visa, travel or placement fees up front.',
      'Treat applicants\' personal data carefully: use CVs and contact details only for the recruitment you advertised.',
    ]],
  ['Rentals and property',
    [
      'Only list a property if you are the owner, the landlord or an agent with the owner\'s written authority.',
      'State the full rent and every other charge up front: agency, legal, caution or service fees.',
      'Do not ask for inspection fees or deposits before a viewing. Renters should never pay for a property they have not seen.',
      'Photos and descriptions must match the actual property and its condition.',
      'Shortlets must be genuine, available on the dates offered and legal in their location.',
    ]],
  ['For sale',
    [
      'You must own, or be authorised to sell, anything you list.',
      'Describe the condition honestly (new, used or refurbished) and disclose faults.',
      'No stolen goods, counterfeits or replicas presented as originals, or items that are recalled or unsafe.',
      'Vehicles must come with valid papers. Phones and electronics must not be blacklisted or stolen.',
    ]],
  ['Promotions and paid features',
    [
      'Promotions are advertising. They must follow the same rules as every other post and must not make false or misleading claims.',
      'Health, finance, investment, education and property claims must be accurate and must not promise guaranteed results or returns.',
      'Paid promotion does not mean Revlo endorses or has verified the advertiser.',
      'Revlo may pause or remove a promotion that breaks these rules. See the Terms of Use for how payments and refunds work.',
    ]],
  ['Never allowed on Revlo',
    [
      'Weapons, ammunition, explosives, or instructions for making them.',
      'Illegal drugs, controlled or prescription-only medicines, and drug paraphernalia.',
      'Sexual services, adult content, escorting, or anything that sexualises minors.',
      'Human trafficking, "sponsorship" or "adoption" of people, organ sales, and exploitative domestic or foreign labour.',
      'Ponzi schemes, "doubling" offers, unlicensed investments, forex or crypto signals that promise returns, loan scams and advance-fee fraud.',
      'Forged or stolen documents, certificates, IDs, SIM cards, bank accounts, BVN/NIN details, or social media accounts.',
      'Hacking, surveillance or spyware services, and "bypass" or unlocking services for stolen devices.',
      'Wildlife, protected species, and animal parts from protected species.',
      'Gambling, betting or lottery services without a valid licence.',
      'Alcohol or tobacco offered to anyone under 18.',
      'Anything else that is illegal in Nigeria or in the place where the offer is made.',
    ]],
  ['Respect people and their privacy',
    [
      'No hate speech, threats, harassment, bullying or incitement to violence.',
      'Do not post anyone else\'s phone number, address, photos or personal details without their permission.',
      'Do not post content that infringes copyright, trademarks or other people\'s rights.',
      'Do not use the contact or follow features to spam, harass or send unsolicited promotions.',
      'No political campaign material, and no religious or tribal content intended to insult or incite.',
    ]],
  ['Badges and Premium',
    [
      'Silver, Bronze and Gold badges are earned by publishing genuine, verified posts over time. Premium Green is a paid badge.',
      'Badges show activity and payment, not a guarantee of identity, quality or trustworthiness. Always do your own checks.',
      'Trying to game badges (for example with fake or duplicate posts) will lead to the badge being removed and the account blocked.',
      'Revlo may remove any badge from a publisher who breaks these rules.',
    ]],
  ['Stay safe when you deal with people',
    [
      'Meet in busy public places and bring someone with you. Inspect items and properties in person before paying.',
      'Never pay "processing", "registration" or "inspection" fees to secure a job, room or item.',
      'Be wary of prices that are far below market value, pressure to decide quickly, or requests to move to another platform to pay.',
      'Revlo will never ask for your password, card PIN, OTP or BVN. Do not share them with anyone.',
      'Revlo is a publishing platform. Deals are between you and the other person, and Revlo is not a party to them.',
    ]],
  ['Reporting and enforcement',
    [
      'Use "Report this post" on any post that breaks these rules. Reports are reviewed by the Revlo team.',
      'We may remove posts, remove badges or promotions, and block email addresses, domains or network addresses without notice when these rules are broken.',
      'Serious matters such as fraud, trafficking or threats to safety may be reported to the Nigeria Police Force or other authorities, and we will cooperate with lawful requests.',
      `If you believe your post was removed or you were blocked in error, email ${CONTACT_EMAIL} with the post link and an explanation.`,
    ]],
  ['Changes to these rules',
    'We may update these rules as Revlo grows. The date at the top shows the latest version. Continuing to use Revlo after a change means you accept the updated rules.',
  ],
];

export default function RulesPage() {
  return (
    <LegalPage
      active="rules"
      eyebrow="Community standards"
      title="Revlo Rules"
      intro="Revlo is an accountless noticeboard for jobs, rentals, items for sale and promotions across Nigeria. These rules keep it useful and safe for everyone. By publishing, contacting, following or paying on Revlo, you agree to them."
      sections={SECTIONS}
    />
  );
}
