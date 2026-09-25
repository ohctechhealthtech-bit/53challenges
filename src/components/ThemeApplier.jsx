import { useEffect } from 'react';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { findFont } from '@/lib/siteFonts';

/**
 * Converts a hex color (#rrggbb) to an HSL object.
 */
function hexToHsl(hex) {
  hex = String(hex || '').replace('#', '').trim();
  if (hex.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = 0; s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/**
 * Reads the `theme_background_color` SiteSetting (a hex string) and applies it
 * to the CSS custom properties that drive the dark background tones site-wide
 * (background, card, popover, secondary, muted, input, border). Derives the
 * lighter shades automatically so all surfaces stay cohesive.
 *
 * Mounted once in Layout so every page inherits the override.
 */
export default function ThemeApplier() {
  const { settings } = useSiteSettings();
  const bgHex = settings.theme_background_color;
  const fontId = settings.theme_font_family;

  // Load the chosen Google font and rewire the --font-* tokens site-wide.
  useEffect(() => {
    const root = document.documentElement;
    if (!fontId) {
      root.style.removeProperty('--font-heading');
      root.style.removeProperty('--font-body');
      root.style.removeProperty('--font-display');
      return;
    }
    const font = findFont(fontId);
    const id = 'c53-site-font';
    let link = document.getElementById(id);
    if (!link) {
      link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    link.href = `https://fonts.googleapis.com/css2?family=${font.google}&display=swap`;
    root.style.setProperty('--font-heading', font.family);
    root.style.setProperty('--font-body', font.family);
    root.style.setProperty('--font-display', font.family);
  }, [fontId]);

  useEffect(() => {
    const root = document.documentElement;
    if (!bgHex) {
      // Clear overrides so the index.css defaults take over.
      root.style.removeProperty('--background');
      root.style.removeProperty('--card');
      root.style.removeProperty('--popover');
      root.style.removeProperty('--secondary');
      root.style.removeProperty('--muted');
      root.style.removeProperty('--input');
      root.style.removeProperty('--border');
      return;
    }
    const hsl = hexToHsl(bgHex);
    if (!hsl) return;
    const { h, s, l } = hsl;
    root.style.setProperty('--background', `${h} ${s}% ${l}%`);
    root.style.setProperty('--card', `${h} ${s}% ${Math.min(l + 5, 100)}%`);
    root.style.setProperty('--popover', `${h} ${s}% ${Math.min(l + 5, 100)}%`);
    root.style.setProperty('--secondary', `${h} ${s}% ${Math.min(l + 8, 100)}%`);
    root.style.setProperty('--muted', `${h} ${s}% ${Math.min(l + 10, 100)}%`);
    root.style.setProperty('--input', `${h} ${s}% ${Math.min(l + 4, 100)}%`);
    root.style.setProperty('--border', `${h} ${s}% ${Math.min(l + 14, 100)}%`);
  }, [bgHex]);

  return null;
}