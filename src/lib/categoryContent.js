import { categoryMeta } from '@/lib/challenges-data';

// Fallback content used when a ChallengeCategory entity record hasn't been
// populated yet. The entity (managed by admins) always overrides these values
// on the category detail page, so this just guarantees the page is never empty.

const SHARED_LEARNING = [
  'Creative thinking', 'Practical skills', 'New techniques', 'Problem-solving',
  'Project planning', 'Working from a brief', 'Presentation skills', 'Confidence',
  'Portfolio development', 'Receiving and applying feedback',
];

const SHARED_BENEFITS = [
  { icon: '🏆', title: 'Showcase your talent', description: 'Put your work in front of a national audience.' },
  { icon: '📁', title: 'Build your portfolio', description: 'Collect real, finished pieces you can be proud of.' },
  { icon: '📈', title: 'Improve your skills', description: 'Every brief stretches your craft a little further.' },
  { icon: '🎁', title: 'Win prizes and awards', description: 'Cash, gear and recognition for standout work.' },
  { icon: '💬', title: 'Receive feedback', description: 'Judges and the community help you grow.' },
  { icon: '🌟', title: 'Gain community recognition', description: 'Get noticed by peers, brands and recruiters.' },
  { icon: '🤝', title: 'Meet other creators', description: 'Join a friendly, ambitious community of makers.' },
  { icon: '🚀', title: 'Discover future opportunities', description: 'Open doors to classes, studios and jobs.' },
  { icon: '🖼️', title: 'Be featured in 53 Gallery', description: 'Eligible work can be showcased in the Gallery.' },
];

const SHARED_FORMATS = [
  { icon: '🖼️', label: 'Image submission', description: 'Upload a photo of your work.' },
  { icon: '🎥', label: 'Video submission', description: 'Share a recorded performance or demo.' },
  { icon: '✍️', label: 'Written entry', description: 'Submit writing, poetry or ideas.' },
  { icon: '💻', label: 'Digital artwork', description: 'Created with digital tools.' },
  { icon: '🧱', label: 'Physical artwork', description: 'Document a physical piece.' },
  { icon: '🎭', label: 'Live or recorded performance', description: 'Perform on stage or on camera.' },
  { icon: '👤', label: 'Individual project', description: 'Enter on your own.' },
  { icon: '👥', label: 'Team project', description: 'Collaborate with others.' },
  { icon: '🗳️', label: 'Public voting', description: 'The community decides.' },
  { icon: '⚖️', label: 'Expert judging', description: 'Judges score against a rubric.' },
  { icon: '🎯', label: 'Combined voting & judging', description: 'A weighted blend of both.' },
];

const SHARED_AUDIENCE = [
  'Beginners', 'Intermediate participants', 'Experienced creators', 'Individuals', 'Teams',
  'Students', 'Instructors & professionals', 'Children (7–12)', 'Teens (13–19)', 'Adults (20+)',
  'Australian residents', 'International participants (where permitted)', 'NDIS participants & accessibility support',
];

const SHARED_FAQ = [
  { question: 'Who can participate?', answer: 'Most challenges are open to Australian residents across age divisions. Each challenge lists its own eligibility — always check before entering.' },
  { question: 'Can beginners enter?', answer: 'Yes. Many challenges welcome first-time creators, with divisions and categories designed for all skill levels.' },
  { question: 'Is entry free?', answer: 'Some challenges are free to enter and others charge a small fee. The entry type is shown on every challenge card.' },
  { question: 'Can minors enter?', answer: 'Yes, with the appropriate division and, where required, guardian consent. Age requirements are set per challenge.' },
  { question: 'Can teams participate?', answer: 'Many challenges allow team entries. The entry type (individual or team) is shown on the challenge card.' },
  { question: 'What content can I upload?', answer: 'Accepted formats depend on the challenge — images, video, writing or digital files. Check the challenge rules for specifics.' },
  { question: 'How are winners selected?', answer: 'Through public voting, expert judging, or a weighted combination of both, depending on the challenge scoring model.' },
  { question: 'How does voting work?', answer: 'Registered voters can support entries during the voting window. Verified votes are counted and audited before results are published.' },
  { question: 'Can I change my entry after submission?', answer: 'Entries are usually locked once submitted. Check each challenge’s rules for the exact edit window.' },
  { question: 'Who owns the submitted work?', answer: 'You keep ownership of your work. Entering grants the platform a limited licence to showcase eligible entries, as set out in the challenge terms.' },
  { question: 'Will entries appear in the Gallery?', answer: 'Approved, consented entries may be featured in 53 Gallery. This is opt-in per challenge.' },
  { question: 'When are prizes issued?', answer: 'Prizes are issued after results are verified and audited. Timing depends on the challenge and prize type.' },
];

const WORK_TYPES = {
  'outdoor-adventure': ['Bushwalking', 'Camping', 'Fishing', 'Field sports', 'Orienteering', 'Cycling', 'Paddling', 'Gardening', 'Conservation', 'Adventure racing', 'Outdoor cooking', 'Field crafts'],
  'art-craft-making': ['Painting', 'Drawing', 'Sculpture', 'Pottery', 'Jewellery', 'Textile design', 'Woodwork', 'Handmade products', 'Recycled art', 'Digital illustration', 'Mixed media', 'Community art'],
  'music-dance-performance': ['Singing', 'Instrumental', 'Songwriting', 'Dance', 'Choreography', 'Theatre', 'Spoken word', 'Band performance', 'Beat-making', 'Stagecraft', 'Busking', 'Recorded performance'],
  'photography-film-digital': ['Photography', 'Filmmaking', 'Video', 'Animation', 'Digital art', 'Editing', 'Drone', 'Documentary', 'Portraiture', 'Motion graphics', 'Sound design', 'VFX'],
  'writing-ideas-innovation': ['Poetry', 'Short fiction', 'Essays', 'Ideas', 'Innovation briefs', 'Scriptwriting', 'Spoken word', 'Journalism', 'Song lyrics', 'Pitching', 'Storytelling', 'Opinion pieces'],
  'food-farming-community': ['Cooking', 'Baking', 'Farming', 'Gardening', 'Community projects', 'Food art', 'Preserving', 'Brewing', 'Market stalls', 'Sustainability', 'Hospitality', 'Food writing'],
};

const DESCRIPTIONS = {
  'outdoor-adventure': { tagline: 'Get outside. Get involved.', short: 'Outdoors, sport, fishing & field crafts', full: 'Outdoor & Adventure challenges celebrate life outside — from fishing and field sports to bushwalking, camping and conservation. Take on a brief, get outdoors, and share your love of the natural world.' },
  'art-craft-making': { tagline: 'Make something worth sharing.', short: 'Painting, drawing, craft & making', full: 'Art, Craft & Making challenges span painting, drawing, sculpture, pottery, textiles and handmade design. Develop an idea from sketch to finished piece and share your craft with the community.' },
  'music-dance-performance': { tagline: 'Take the stage.', short: 'Music, dance & stage performance', full: 'Music, Dance & Performance challenges cover singing, instruments, songwriting, dance and theatre. Perform live or on camera, and let an audience discover your stage talent.' },
  'photography-film-digital': { tagline: 'Frame your world.', short: 'Photography, film, video & digital art', full: 'Photography, Film & Digital challenges include stills, video, animation and digital art. Capture, edit and deliver visual stories that move people.' },
  'writing-ideas-innovation': { tagline: 'Find the right words.', short: 'Writing, poetry, ideas & innovation', full: 'Writing, Ideas & Innovation challenges cover poetry, fiction, essays and big ideas. Work from a brief, sharpen your voice, and put your thinking in front of readers and judges.' },
  'food-farming-community': { tagline: 'Grow, cook, gather.', short: 'Food, farming, cooking & community', full: 'Food, Farming & Community challenges span cooking, baking, growing and community projects. Celebrate produce, sustainability and the people who bring food to the table.' },
};

export function getCategoryDefaults(slug) {
  const meta = categoryMeta(slug);
  const d = DESCRIPTIONS[slug] || { tagline: meta.blurb, short: meta.blurb, full: meta.blurb };
  return {
    name: meta.name,
    slug,
    icon: meta.icon,
    theme_colour: meta.color,
    tagline: d.tagline,
    short_description: d.short,
    full_description: d.full,
    hero_image: '',
    hero_video: '',
    gallery_images: [],
    work_types: (WORK_TYPES[slug] || []).map((t) => ({ label: t, icon: '•' })),
    learning_outcomes: SHARED_LEARNING,
    benefits: SHARED_BENEFITS,
    audience_types: SHARED_AUDIENCE,
    eligibility_guidance: 'Eligibility, age requirements, location restrictions and submission rules may differ between challenges. Please review the individual challenge rules before entering.',
    challenge_formats: SHARED_FORMATS,
    faq_items: SHARED_FAQ,
  };
}