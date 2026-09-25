/**
 * D8 — Host Experience Principles.
 * Rules applied: D8.1 (plain language options), D8.2 (question-answer pattern).
 * Static option catalogues for the host application wizard.
 */
import {
  User, Building2, GraduationCap, Palette, Camera, PenLine, Laptop, Mic,
  Sparkles, Users, Award, Blend, Smile, Rocket, Repeat, CalendarDays, Heart,
  Sprout, Mountain,
} from 'lucide-react';
import { DELIVERY_LEVELS, PARTICIPANT_RANGES } from '@/lib/hostWizardDefaults';

export const HOST_TYPE_OPTIONS = [
  { value: 'individual', label: 'Just me', description: "I'm an individual creator or community member.", icon: User },
  { value: 'business', label: 'A business or brand', description: 'We want to run a challenge for our customers or community.', icon: Building2 },
  { value: 'school_community', label: 'A school or community group', description: 'For our students, members or local community.', icon: GraduationCap },
];

export const DELIVERY_OPTIONS = DELIVERY_LEVELS.map((l, i) => ({
  value: l.key,
  label: l.label,
  description: l.description,
  icon: [User, Users, Award][i],
}));

export const CATEGORY_OPTIONS = [
  { value: 'art-craft-making', label: 'Art, Craft & Making', description: 'Painting, drawing, craft and hands-on making.', icon: Palette },
  { value: 'food-farming-community', label: 'Food, Farming & Community', description: 'Cooking, growing food and community projects.', icon: Sprout },
  { value: 'music-dance-performance', label: 'Music, Dance & Performance', description: 'Music, dance, song and spoken word.', icon: Mic },
  { value: 'outdoor-adventure', label: 'Outdoor & Adventure', description: 'Getting outside, sport and exploring.', icon: Mountain },
  { value: 'photography-film-digital', label: 'Photography, Film & Digital', description: 'Photos, video, film and digital art.', icon: Camera },
  { value: 'writing-ideas-innovation', label: 'Writing, Ideas & Innovation', description: 'Stories, poems, ideas and bright thinking.', icon: PenLine },
];

export const WINNER_OPTIONS = [
  { value: 'public', label: 'The public votes', description: 'Everyone can vote for their favourite entries.', icon: Users },
  { value: 'judges', label: 'A panel of judges decides', description: 'Qualified judges score every entry.', icon: Award },
  { value: 'combination', label: 'A combination of both', description: 'Judges score entries, and public votes count too.', icon: Blend },
];

export const DIVISION_OPTIONS = [
  { value: 'children', label: 'Kids (under 13)', icon: Smile },
  { value: 'teens', label: 'Teens (13–17)', icon: Sparkles },
  { value: 'adults', label: 'Adults (18+)', icon: User },
  { value: 'seniors', label: 'Seniors (65+)', icon: Heart },
];

export const SERIES_COUNT_OPTIONS = [
  { value: '3', label: '3 challenges', description: 'A short run to test the format.', icon: Repeat },
  { value: '6', label: '6 challenges', description: 'A solid season of activity.', icon: Repeat },
  { value: '12', label: '12 challenges', description: 'A full year of challenges.', icon: CalendarDays },
];

export const SERIES_CADENCE_OPTIONS = [
  { value: 'monthly', label: 'One a month', description: 'A steady monthly rhythm.', icon: CalendarDays },
  { value: 'quarterly', label: 'One a quarter', description: 'Four moments across the year.', icon: CalendarDays },
  { value: 'yearly', label: 'One a year', description: 'A single annual highlight.', icon: CalendarDays },
];

export const PARTICIPANT_OPTIONS = PARTICIPANT_RANGES.map((r) => ({
  value: r.key,
  label: r.label,
  icon: Users,
}));

export const SCOPE_OPTIONS = [
  { value: 'single', label: 'A one-off challenge', description: 'One challenge, one set of winners.', icon: Rocket },
  { value: 'series', label: 'A series of challenges', description: 'A few challenges running back to back.', icon: Repeat },
  { value: 'annual_program', label: 'An ongoing yearly program', description: 'A recurring program that runs every year.', icon: CalendarDays },
];