/**
 * Extra intro-page content (hero, gallery, highlights) for challenges whose
 * upstream record only carries a cover image. Keyed by challenge id and
 * merged over `challenge.intro` on the challenge page.
 */
const MEDIA = 'https://media.base44.com/images/public/6a683318ec3c2cc96e77b420/';

const CONTENT = {
  // Singing Challenge — Show Us Your Voice
  '6aaa7e0a99df11bc8bcc649b': {
    headline: 'Singing Challenge',
    tagline: 'Your voice matters. Sing. Perform. Inspire.',
    hero_image: `${MEDIA}6d1c612d7_WhatsAppImage2026-09-15at90505AM.jpeg`,
    body: 'Music brings us together. Pick a song, sing your heart out and let the music take over. Whether you sing in the shower, on stage or under the open sky, this challenge is your chance to own the stage and let your voice be heard.',
    requirements: [
      'One song, up to 4 minutes long',
      'Video, audio recording or a link to your performance',
      'Original or cover songs welcome',
      'Keep it family-friendly',
    ],
    highlights: [
      { title: 'Talent', text: 'Show us what your voice can do.' },
      { title: 'Passion', text: 'Sing the song that moves you.' },
      { title: 'Performance', text: 'Own the stage — wherever it is.' },
      { title: 'Community', text: 'Good music, brighter people.' },
    ],
    gallery: [
      `${MEDIA}c53014546_WhatsAppImage2026-09-15at90505AM2.jpeg`,
      `${MEDIA}4d72fc5c1_WhatsAppImage2026-09-15at90505AM1.jpeg`,
      `${MEDIA}55506e657_WhatsAppImage2026-09-15at90504AM.jpeg`,
      `${MEDIA}0376a6d91_WhatsAppImage2026-09-15at90505AM3.jpeg`,
      `${MEDIA}96e3f319d_WhatsAppImage2026-09-15at90506AM1.jpeg`,
      `${MEDIA}0a5ac2bb3_WhatsAppImage2026-09-15at90506AM.jpeg`,
    ],
    cta_participate_label: 'Enter the Singing Challenge',
  },
};

export function introContentFor(challengeId) {
  return CONTENT[String(challengeId || '')] || null;
}