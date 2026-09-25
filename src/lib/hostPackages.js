/**
 * D8 — Host Experience Principles: plain language, benefit-led descriptions.
 * Marketing content for the three hosting packages shown on /host-a-challenge.
 * Each package leads with who it's for, then the outcome the host gets.
 * Keys match DELIVERY_LEVELS in hostWizardDefaults.js.
 */
import { HOST_DEPOSITS, formatAud } from '@/lib/hostDeposit';

export const HOST_PACKAGES = [
  {
    key: 'self_service',
    name: 'Self-service',
    headline: 'For individuals and community groups',
    outcome: 'Launch your own branded challenge — no experience needed.',
    tagline: 'Launch fast, on your terms',
    price: 'No deposit',
    priceNote: 'Pay only for the services you add',
    audience: 'Perfect for individuals, creators and small community groups',
    benefits: [
      'Step-by-step guided setup — no experience needed',
      'Your own branded challenge page on our platform',
      'Built-in entry collection and public voting',
      'Automatic entrant emails and reminders',
      'Live results and a winner showcase page',
    ],
    highlight: false,
  },
  {
    key: 'supported',
    name: 'Supported',
    headline: 'For schools, councils and growing brands',
    outcome: 'You lead the vision, we handle the complexity.',
    reassurance: 'Compliance, legal checks and entry moderation included.',
    tagline: 'You lead, we back you up',
    price: formatAud(HOST_DEPOSITS.supported.amount),
    priceNote: 'Refundable deposit — comes off your final cost',
    audience: 'The sweet spot for businesses, schools and growing brands',
    benefits: [
      'Everything in Self-service, plus:',
      'A dedicated specialist reviews your challenge before launch',
      'Legal check of your rules and terms included',
      'Entry moderation so only quality entries appear',
      'Priority support throughout your challenge',
      'Post-challenge results report',
    ],
    highlight: true,
    badge: 'Most popular',
  },
  {
    key: 'fully_managed',
    name: 'Fully managed',
    headline: 'For corporates and large organisations',
    outcome: 'Sit back — we run your challenge end to end.',
    reassurance: 'Dedicated manager, judging panel, social campaign and prize handling all included.',
    tagline: 'Sit back — we run it all',
    price: formatAud(HOST_DEPOSITS.fully_managed.amount),
    priceNote: 'Refundable deposit — comes off your final cost',
    audience: 'Built for corporates and large organisations',
    benefits: [
      'Everything in Supported, plus:',
      'A dedicated challenge manager from start to finish',
      'Professional judging panel arranged for you',
      'Social campaign and launch promotion handled by us',
      'Prize handling and winner payments looked after',
      'Full compliance, permits and consent managed end to end',
      'Executive wrap-up report with engagement insights',
    ],
    highlight: false,
    badge: 'For corporates',
  },
];