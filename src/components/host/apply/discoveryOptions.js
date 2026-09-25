/**
 * Guided discovery answer catalogues — the three quick questions that follow
 * the category choice, plus the accent colours for the category tiles.
 */
import {
  Camera, Video, PenLine, Sparkles, Mic, Hammer, UtensilsCrossed, Footprints,
  Smile, User, Users, Heart, GraduationCap, Building2, Home, Globe,
} from 'lucide-react';

// Tailwind classes written as literals so the build keeps them.
export const CATEGORY_ACCENTS = {
  'art-craft-making': 'bg-rose-100 text-rose-600',
  'food-farming-community': 'bg-amber-100 text-amber-600',
  'music-dance-performance': 'bg-purple-100 text-purple-600',
  'outdoor-adventure': 'bg-emerald-100 text-emerald-600',
  'photography-film-digital': 'bg-blue-100 text-blue-600',
  'writing-ideas-innovation': 'bg-teal-100 text-teal-600',
};

const OPEN = { value: 'open_submission', label: 'Open submission', description: 'Entrants choose how they take part.', icon: Sparkles };
const PHOTO = { value: 'photo', label: 'A photo challenge', description: 'People enter with a single image.', icon: Camera };
const VIDEO = { value: 'video', label: 'A video or film', description: 'Short clips, diaries or films.', icon: Video };
const WRITTEN = { value: 'written', label: 'A written piece', description: 'Stories, poems or reflections.', icon: PenLine };
const MAKE = { value: 'made_object', label: 'Something they make', description: 'A physical piece, photographed for entry.', icon: Hammer };
const PERFORM = { value: 'performance', label: 'A performance', description: 'Recorded music, dance or spoken word.', icon: Mic };
const COOK = { value: 'cooked_dish', label: 'Something they grow or cook', description: 'A dish, a garden or a food project.', icon: UtensilsCrossed };
const ACTIVITY = { value: 'outdoor_activity', label: 'An outdoor activity', description: 'Getting out and doing something.', icon: Footprints };

export const FORMAT_OPTIONS = {
  'art-craft-making': [MAKE, PHOTO, OPEN],
  'food-farming-community': [COOK, PHOTO, WRITTEN, OPEN],
  'music-dance-performance': [PERFORM, VIDEO, OPEN],
  'outdoor-adventure': [ACTIVITY, PHOTO, VIDEO, OPEN],
  'photography-film-digital': [PHOTO, VIDEO, OPEN],
  'writing-ideas-innovation': [WRITTEN, VIDEO, OPEN],
};

export const AGE_OPTIONS = [
  { value: 'under_13', label: 'Kids (under 13)', icon: Smile },
  { value: 'ages_13_to_17', label: 'Teens (13–17)', icon: Sparkles },
  { value: 'adults_18_plus', label: 'Adults (18+)', icon: User },
  { value: 'seniors_65_plus', label: 'Seniors (65+)', icon: Users },
  { value: 'all_ages', label: 'Everyone, all ages', icon: Heart },
];

export const SETTING_OPTIONS = [
  { value: 'school', label: 'School or education setting', icon: GraduationCap },
  { value: 'workplace', label: 'Workplace or organisation', icon: Building2 },
  { value: 'community', label: 'Local community', icon: Home },
  { value: 'public', label: 'Open to the public', icon: Globe },
];

export const formatsFor = (category) => FORMAT_OPTIONS[category] || [OPEN];