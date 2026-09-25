// Centralised brand and social configuration for 53 Challenges.
// Update these values to change social links and brand metadata across the app.

export const SITE_CONFIG = {
  brand: '53 Challenges',
  tagline: "Australia's home of challenges.",
  domain: 'https://53challenges.com',
  classesDomain: 'https://53classes.com',
  galleryDomain: 'https://53gallery.com',
  social: {
    instagram: 'https://instagram.com/53challenges',
    facebook: 'https://facebook.com/53challenges',
    youtube: 'https://youtube.com/@53challenges',
    tiktok: 'https://tiktok.com/@53challenges',
  },
  contact: {
    email: 'hello@53challenges.com',
  },
};

// External class details page on the 53 Classes site (deep-link for enrollments).
export const classDetailsUrl = (classId) =>
  classId ? `${SITE_CONFIG.classesDomain}/ClassDetails?id=${classId}` : SITE_CONFIG.classesDomain;

export const TRUST_PAGES = [
  { to: '/privacy-policy', label: 'Privacy Policy' },
  { to: '/terms-of-use', label: 'Terms of Use' },
  { to: '/competition-rules', label: 'Competition Rules' },
  { to: '/safety-and-wellbeing', label: 'Safety & Wellbeing' },
  { to: '/contact-us', label: 'Contact Us' },
];