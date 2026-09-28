import LegalPage, { CONTACT_EMAIL } from '@/components/LegalPage';

export const metadata = {
  title: 'Privacy Policy — Revlo.ng',
  description: 'How Revlo.ng collects, uses, shares and protects personal data under the Nigeria Data Protection Act 2023.',
  alternates: { canonical: '/privacy' },
};

const SECTIONS = [
  ['Who we are',
    `Revlo.ng ("Revlo", "we", "us") runs an accountless publishing platform for jobs, rentals, items for sale and promotions in Nigeria. We are the data controller for the personal data described here. We process it in line with the Nigeria Data Protection Act 2023 (NDPA) and the rules of the Nigeria Data Protection Commission (NDPC). For any privacy question or request, email ${CONTACT_EMAIL}.`,
  ],
  ['What we collect',
    [
      'Email addresses: when you ask for a publish link, publish a post, contact a poster, follow a publisher, request a delete link or make a payment.',
      'Post content: the title, description, location, category, photos, videos and anything else you choose to publish. Posts are public.',
      'Messages: the text of messages you send to posters through the contact feature.',
      'Network data: your IP address and basic request information, used for security, rate limiting and blocking abuse.',
      'Device identifiers: a random visitor ID kept in your browser to count people currently online, and a random, hourly browser session ID used so each post view is counted only once.',
      'Payment records: the payment reference, amount, email address and status of any Premium or promotion payment. Card and bank details are entered on Paystack and never reach Revlo.',
      'Records of emails: when publish links and notifications were sent, opened and used, so we can prevent abuse and fix delivery problems.',
      'Reports: the posts you report and the reason you give.',
    ]],
  ['How we use it',
    [
      'To send you publish, confirmation, delete and follow links, and to publish and display your posts (to perform the service you asked for).',
      'To pass verified messages between people and posters, and to notify followers of new posts.',
      'To process payments and apply Premium badges and promotions.',
      'To calculate publisher badges from the number of verified posts.',
      'To detect and prevent fraud, spam, scams and abuse, including blocking email addresses, domains and IP addresses (our legitimate interest in keeping Revlo safe).',
      'To keep financial records and to comply with the law and lawful requests from authorities (legal obligation).',
      'We do not sell your personal data, and we do not use it for third-party advertising.',
    ]],
  ['What other people can see',
    [
      'Everything in a post (text, photos, videos, location and category) is public and may be seen, shared or indexed by search engines while the post is live.',
      'Your email address is not shown on your post.',
      'If you send a message through the contact feature, the poster receives your message and your email address so they can reply to you.',
      'Badges shown on posts reveal how active a publisher is and whether they hold Premium.',
    ]],
  ['Who we share it with',
    'We share personal data only with service providers that help us run Revlo, under contracts that require them to protect it:',
    [
      'Supabase: database and file storage.',
      'Vercel: website hosting and delivery.',
      'Resend: sending emails.',
      'Paystack: processing payments.',
    ],
    'We may also disclose data where the law requires it, to respond to valid requests from the Nigeria Police Force, courts or regulators, or to protect people from fraud or harm. Some providers store data outside Nigeria. Where they do, we rely on the safeguards the NDPA allows for cross-border transfers.',
  ],
  ['How long we keep it',
    [
      'Posts stop being public when they expire (after 24 hours, 1, 2 or 3 months, as you choose) or when you delete them.',
      'Records of posts, emails, reports and blocks are kept only as long as needed for safety, dispute resolution and fraud prevention, and are then deleted or anonymised.',
      'Payment records are kept for as long as tax and accounting law requires.',
      'View session IDs rotate every hour. The online-visitor ID stays in your browser until you clear your site data.',
    ]],
  ['Browser storage',
    'Revlo does not use advertising or tracking cookies. We use your browser\'s local and session storage for the app to work: your publish session, view counting, the online-visitor count and interface preferences. Administrator sign-in uses a secure cookie that only Revlo staff receive. Clearing your browser data removes these items.',
  ],
  ['Your rights',
    [
      'Ask for a copy of the personal data we hold about you.',
      'Ask us to correct inaccurate data, or to delete data we no longer need.',
      'Object to or restrict processing, or withdraw consent where we rely on it.',
      'Ask to receive your data in a portable format.',
      'Unfollow at any time using the link in any follow email, and delete your posts with an emailed delete link.',
      `To make a request, email ${CONTACT_EMAIL} from the email address concerned. We will respond within the time the NDPA requires. If you are not satisfied, you can complain to the Nigeria Data Protection Commission (ndpc.gov.ng).`,
    ]],
  ['Security',
    'We protect data with encrypted connections (HTTPS), access controls, single-use and time-limited links, rate limiting and monitoring. No system is perfectly secure. If a breach puts your rights at risk, we will notify you and the NDPC as the law requires.',
  ],
  ['Children',
    'Revlo is not for anyone under 18. We do not knowingly collect data from children. If you believe a child has used Revlo, email us and we will remove the data.',
  ],
  ['Changes to this policy',
    'We may update this policy. The date at the top shows the latest version. Significant changes will be highlighted on the site.',
  ],
];

export default function PrivacyPage() {
  return (
    <LegalPage
      active="privacy"
      eyebrow="Your data"
      title="Privacy Policy"
      intro="Revlo is built to work without accounts and to collect as little about you as possible. This policy explains what we collect, why, who we share it with and your rights."
      sections={SECTIONS}
    />
  );
}
