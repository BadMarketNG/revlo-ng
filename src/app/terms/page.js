import LegalPage, { CONTACT_EMAIL } from '@/components/LegalPage';

export const metadata = {
  title: 'Terms of Use — Revlo.ng',
  description: 'The terms that apply when you publish, browse, contact, follow or pay on Revlo.ng.',
  alternates: { canonical: '/terms' },
};

const SECTIONS = [
  ['Agreement',
    'These Terms of Use are an agreement between you and Revlo.ng ("Revlo", "we", "us"). By using Revlo (browsing, publishing, contacting a poster, following a publisher or paying for a feature), you agree to these Terms, the Revlo Rules and the Privacy Policy. If you do not agree, please do not use Revlo.',
  ],
  ['Eligibility',
    'You must be at least 18 years old and able to enter a binding contract under Nigerian law. If you use Revlo for a business, you confirm you have authority to bind that business.',
  ],
  ['How Revlo works',
    [
      'Revlo has no user accounts. To publish, you request a link sent to your email. Each link is single-use: it creates one post and cannot be reused.',
      'Posts stay live for the duration you choose (24 hours, 1 month, 2 months or 3 months) and then expire.',
      'You can delete your post at any time by requesting a delete link to the email you published with.',
      'You are responsible for keeping access to your email secure. Anyone who can open your publish or delete links can act on your behalf.',
    ]],
  ['Your content',
    [
      'You keep ownership of what you post. You give Revlo a non-exclusive, royalty-free, worldwide licence to host, store, display, resize, share and promote your content on Revlo and in its marketing while the post is live, and to keep copies as needed for safety and legal reasons.',
      'You confirm your content is accurate, lawful, yours to share, and follows the Revlo Rules.',
      'You are fully responsible for your posts and for any dealings that come from them.',
      'Revlo may review, refuse, edit for formatting, hide or remove any content at any time, with or without notice.',
    ]],
  ['Revlo is a platform, not a party',
    [
      'Revlo lets people publish and find opportunities. We are not an employer, recruiter, estate agent, landlord, seller, buyer or payment intermediary for any deal made through Revlo.',
      'We do not verify every poster, listing, job, property or item. Badges show activity or payment, not a guarantee.',
      'Any agreement, payment or dispute is solely between you and the other person. Check everything yourself before you pay or commit.',
    ]],
  ['Paid features',
    [
      'Premium Green badges and post promotions are paid for through Paystack. Prices are shown in naira before you pay, and Paystack\'s own terms also apply to your payment.',
      'Premium Green is active for the number of days shown at purchase. Promotions run for the number of days you choose, starting when the promoted post is published.',
      'Paid features are digital services delivered straight away, so payments are non-refundable except where the law requires otherwise, where a feature could not be delivered because of a fault on our side, or where you were charged in error.',
      'If a post, badge or promotion is removed for breaking the Revlo Rules, no refund is due.',
      `For payment problems, email ${CONTACT_EMAIL} with your payment reference.`,
    ]],
  ['Acceptable use',
    'You must not:',
    [
      'Break any law, or the Revlo Rules.',
      'Use Revlo for fraud, scams, spam or phishing.',
      'Scrape, harvest or copy posts or email addresses by automated means, or resell Revlo content.',
      'Interfere with Revlo\'s security, overload its systems, or get around rate limits, blocks or payment checks.',
      'Upload malware, or try to access data or admin areas you are not authorised to use.',
      'Manipulate view counts, badges, reports or promotions.',
    ]],
  ['Our intellectual property',
    'The Revlo name, logo, badges, design and software belong to Revlo.ng and are protected by law. All rights not expressly granted in these Terms are reserved. You may share links to posts, but you may not copy or reuse Revlo\'s branding or software without written permission.',
  ],
  ['Suspension and termination',
    'We may remove content, withdraw features, or block email addresses, domains or network addresses at any time if we reasonably believe you have broken these Terms or the Rules, or to protect users, Revlo or third parties. You may stop using Revlo at any time.',
  ],
  ['Disclaimers',
    'Revlo is provided "as is" and "as available". We do our best to keep it running and secure, but we do not promise it will be uninterrupted, error-free, or free of harmful content posted by others, and we make no warranties about any post, poster or deal.',
  ],
  ['Limitation of liability',
    'As far as the law allows, Revlo is not liable for any indirect or consequential loss, or for loss arising from dealings between users, content posted by others, or events outside our reasonable control. Our total liability for any claim relating to Revlo is limited to the amount you paid us in the 3 months before the claim, or ₦10,000, whichever is higher. Nothing in these Terms limits liability that cannot be limited under Nigerian law, including rights under the Federal Competition and Consumer Protection Act 2018.',
  ],
  ['Indemnity',
    'You agree to compensate Revlo for claims, losses and reasonable costs arising from your content, your dealings with other users, or your breach of these Terms or the law.',
  ],
  ['Governing law and disputes',
    'These Terms are governed by the laws of the Federal Republic of Nigeria. Before starting any formal claim, please email us so we can try to resolve it. Disputes that cannot be resolved informally will be handled by the courts of Nigeria.',
  ],
  ['Changes to these Terms',
    'We may update these Terms. The date at the top shows the latest version, and significant changes will be highlighted on the site. Continuing to use Revlo after a change means you accept the updated Terms.',
  ],
  ['Contact',
    `Questions about these Terms: ${CONTACT_EMAIL}.`,
  ],
];

export default function TermsPage() {
  return (
    <LegalPage
      active="terms"
      eyebrow="Legal"
      title="Terms of Use"
      intro="Please read these terms carefully. They explain your rights and responsibilities when you use Revlo, and ours."
      sections={SECTIONS}
    />
  );
}
