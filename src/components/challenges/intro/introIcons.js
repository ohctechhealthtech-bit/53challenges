// The highlight-card icons, shared by the intro page and the editor that
// writes them. One map, so the editor can only offer an icon the page knows
// how to draw — a key outside it renders as a sparkle, silently.
import {
  Sparkles, Trophy, Heart, Star, Gift, Users, Camera, Palette, Music,
  PenTool, Globe, Award, Lightbulb, Rocket, Shield, Clock, MapPin, Leaf,
} from 'lucide-react';

export const ICONS = {
  sparkles: Sparkles, trophy: Trophy, heart: Heart, star: Star, gift: Gift,
  users: Users, camera: Camera, palette: Palette, music: Music, pen: PenTool,
  'pen-tool': PenTool, globe: Globe, award: Award, lightbulb: Lightbulb,
  rocket: Rocket, shield: Shield, clock: Clock, 'map-pin': MapPin, leaf: Leaf,
};

/** The choices offered in the editor; 'pen-tool' is an alias of 'pen'. */
export const ICON_KEYS = Object.keys(ICONS).filter((k) => k !== 'pen-tool');

export const iconFor = (key) => ICONS[String(key || '').toLowerCase()] || Sparkles;

/** Display names for the colour themes in accents.js. */
export const ACCENT_NAMES = {
  orange: 'Sunset Orange',
  purple: 'Studio Purple',
  blue: 'Electric Blue',
  emerald: 'Fresh Emerald',
  rose: 'Bold Rose',
  amber: 'Golden Amber',
};
