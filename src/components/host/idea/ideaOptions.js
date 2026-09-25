/** Option catalogues for the "Tell us your idea" wizard. */
import {
  GraduationCap, Building2, Users, Trophy, Briefcase, Landmark, User,
  Palette, Sprout, Mic, Mountain, Camera, PenLine, HelpCircle,
  Award, Blend, Smile, Sparkles, Heart, Gift, Coins, Wallet, Banknote,
  CalendarDays, CalendarClock, CalendarRange, Repeat, MapPin, Globe, Building,
  Megaphone, UserPlus, ShoppingBag, Video, HandHeart, BookOpen, Search, BarChart3, Newspaper,
} from 'lucide-react';

/** What the host is actually trying to achieve (sponsor outcome framework). */
export const PURPOSE_OPTIONS = [
  { value: 'awareness', label: 'Awareness — get our name out there', icon: Megaphone },
  { value: 'leads', label: 'Leads — collect interested contacts', icon: UserPlus },
  { value: 'sales', label: 'Sales or bookings', icon: ShoppingBag },
  { value: 'content', label: 'Content we can reuse', icon: Video },
  { value: 'goodwill', label: 'Community goodwill', icon: HandHeart },
  { value: 'education', label: 'Teach people something', icon: BookOpen },
  { value: 'recruitment', label: 'Find people to join us', icon: Search },
  { value: 'insight', label: 'Learn what people think', icon: BarChart3 },
  { value: 'loyalty', label: 'Keep our people engaged', icon: Heart },
  { value: 'publicity', label: 'Media and publicity', icon: Newspaper },
];

/** Common rules hosts can pick from, plus a free-text fallback in the wizard. */
export const RULE_HELPER_OPTIONS = [
  { value: 'original_work', label: 'Original work only', icon: PenLine },
  { value: 'safe_appropriate', label: 'Must be safe & appropriate', icon: Smile },
  { value: 'no_offensive', label: 'No offensive content', icon: HelpCircle },
  { value: 'family_friendly', label: 'Family-friendly', icon: Heart },
  { value: 'individual_only', label: 'Individual entries only', icon: User },
  { value: 'teams_allowed', label: 'Team entries allowed', icon: Users },
  { value: 'one_entry', label: 'One entry per person', icon: Trophy },
  { value: 'multiple_entries', label: 'Multiple entries allowed', icon: Sparkles },
  { value: 'host_may_publish', label: 'Host may publish or feature entries', icon: Video },
  { value: 'media_consent', label: 'Photo/video consent required', icon: Camera },
  { value: 'social_sharing', label: 'Social sharing encouraged', icon: Megaphone },
  { value: 'age_requirement', label: 'Must meet an age requirement', icon: CalendarDays },
  { value: 'location_restricted', label: 'Location-restricted', icon: MapPin },
  { value: 'members_only', label: 'Members, school or organisation only', icon: Building },
  { value: 'invite_only', label: 'Invite-only', icon: UserPlus },
];

export const ORG_TYPE_OPTIONS = [
  { value: 'individual', label: 'For my own organisation', description: 'Running it myself, for my own organisation.', icon: User },
  { value: 'business', label: 'A business or brand', description: 'Marketing, engagement or a customer campaign.', icon: Building2 },
  { value: 'school', label: 'A school or community group', description: 'Students, members or a local community.', icon: GraduationCap },
];

export const ACTIVITY_OPTIONS = [
  { value: 'art-craft-making', label: 'Art, craft & making', description: 'Painting, drawing, craft and hands-on making.', icon: Palette },
  { value: 'food-farming-community', label: 'Food, farming & community', description: 'Cooking, growing food and community projects.', icon: Sprout },
  { value: 'music-dance-performance', label: 'Music, dance & performance', description: 'Music, dance, song and spoken word.', icon: Mic },
  { value: 'outdoor-adventure', label: 'Outdoor & adventure', description: 'Getting outside, sport and exploring.', icon: Mountain },
  { value: 'photography-film-digital', label: 'Photography, film & digital', description: 'Photos, video, film and digital art.', icon: Camera },
  { value: 'writing-ideas-innovation', label: 'Writing, ideas & innovation', description: 'Stories, poems, ideas and bright thinking.', icon: PenLine },
  { value: 'not_sure', label: 'Not sure yet', description: "We'll help you choose the right fit.", icon: HelpCircle },
];

/** What kind of organisation is hosting — mirrors the host application. */
export const ORG_KIND_OPTIONS = [
  { value: 'business', label: 'Business' },
  { value: 'school', label: 'School' },
  { value: 'community_group', label: 'Community group' },
  { value: 'club', label: 'Club' },
  { value: 'workplace', label: 'Workplace' },
  { value: 'council', label: 'Council' },
  { value: 'individual_host', label: 'Just me' },
];

/** Who serves as judges — the host picks the people, never the method. */
export const JUDGE_SOURCE_OPTIONS = [
  { value: 'own', label: 'Invite my own judges', description: 'Invite people you trust to join your competition as judges.', icon: UserPlus },
  { value: 'platform', label: 'Request platform judges', description: 'Let our platform provide qualified judges (premium service).', icon: Award },
  { value: 'both', label: 'Use both', description: 'Combine your own judges with judges provided by our platform.', icon: Blend },
];

export const WINNER_OPTIONS = [
  { value: 'public', label: 'The public votes', icon: Users },
  { value: 'judges', label: 'A panel of judges decides', icon: Award },
  { value: 'combination', label: 'A bit of both', icon: Blend },
  { value: 'not_sure', label: 'Not sure — advise me', icon: HelpCircle },
];

export const AGE_OPTIONS = [
  { value: 'children', label: 'Kids (under 13)', icon: Smile },
  { value: 'teens', label: 'Teens (13–17)', icon: Sparkles },
  { value: 'adults', label: 'Adults (18+)', icon: User },
  { value: 'seniors', label: 'Seniors (65+)', icon: Heart },
];

export const PARTICIPANT_OPTIONS = [
  { value: 'under_50', label: 'Under 50 people', icon: Users },
  { value: '50_250', label: '50 – 250 people', icon: Users },
  { value: '250_1000', label: '250 – 1,000 people', icon: Users },
  { value: 'over_1000', label: 'More than 1,000', icon: Users },
  { value: 'not_sure', label: 'Not sure yet', icon: HelpCircle },
];

export const PRIZE_OPTIONS = [
  { value: 'none', label: 'No prizes — just for fun', icon: Gift },
  { value: 'in_kind', label: 'Donated or in-kind prizes', icon: Gift },
  { value: 'under_1k', label: 'Under $1,000 in prizes', icon: Coins },
  { value: '1k_5k', label: '$1,000 – $5,000', icon: Wallet },
  { value: 'over_5k', label: 'More than $5,000', icon: Banknote },
  { value: 'not_sure', label: 'Not sure yet', icon: HelpCircle },
];

export const BUDGET_OPTIONS = [
  { value: 'under_2k', label: 'Under $2,000', icon: Coins },
  { value: '2k_10k', label: '$2,000 – $10,000', icon: Wallet },
  { value: '10k_50k', label: '$10,000 – $50,000', icon: Banknote },
  { value: 'over_50k', label: 'More than $50,000', icon: Banknote },
  { value: 'sponsored', label: 'Hoping sponsors will cover it', icon: Trophy },
  { value: 'not_sure', label: 'Not sure yet', icon: HelpCircle },
];

export const TIMING_OPTIONS = [
  { value: 'asap', label: 'As soon as possible', icon: CalendarClock },
  { value: '1_3_months', label: 'In the next 1–3 months', icon: CalendarDays },
  { value: '3_6_months', label: 'In 3–6 months', icon: CalendarRange },
  { value: 'later', label: 'Later than 6 months', icon: CalendarRange },
  { value: 'not_sure', label: 'Not sure yet', icon: HelpCircle },
];

export const SCOPE_OPTIONS = [
  { value: 'single', label: 'A one-off challenge', icon: Trophy },
  { value: 'series', label: 'A series of challenges', icon: Repeat },
  { value: 'annual_program', label: 'An ongoing yearly program', icon: CalendarDays },
  { value: 'not_sure', label: 'Not sure yet', icon: HelpCircle },
];

export const REACH_OPTIONS = [
  { value: 'local', label: 'Our local community', icon: MapPin },
  { value: 'internal', label: 'Just inside our organisation', icon: Building },
  { value: 'statewide', label: 'Statewide', icon: MapPin },
  { value: 'national', label: 'Australia-wide', icon: Globe },
  { value: 'not_sure', label: 'Not sure yet', icon: HelpCircle },
];