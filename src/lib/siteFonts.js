// Font choices available in the admin Branding panel. `id` is stored in the
// `theme_font_family` SiteSetting; ThemeApplier loads the Google font and
// rewires the --font-* tokens so every page picks it up.
export const SITE_FONTS = [
  { id: '', label: 'Inter (default)', family: "'Inter', ui-sans-serif, system-ui, sans-serif", google: 'Inter:wght@400;500;600;700;800' },
  { id: 'poppins', label: 'Poppins', family: "'Poppins', ui-sans-serif, system-ui, sans-serif", google: 'Poppins:wght@400;500;600;700;800' },
  { id: 'montserrat', label: 'Montserrat', family: "'Montserrat', ui-sans-serif, system-ui, sans-serif", google: 'Montserrat:wght@400;500;600;700;800' },
  { id: 'dm-sans', label: 'DM Sans', family: "'DM Sans', ui-sans-serif, system-ui, sans-serif", google: 'DM+Sans:wght@400;500;700' },
  { id: 'nunito', label: 'Nunito', family: "'Nunito', ui-sans-serif, system-ui, sans-serif", google: 'Nunito:wght@400;500;600;700;800' },
  { id: 'work-sans', label: 'Work Sans', family: "'Work Sans', ui-sans-serif, system-ui, sans-serif", google: 'Work+Sans:wght@400;500;600;700;800' },
  { id: 'playfair', label: 'Playfair Display', family: "'Playfair Display', ui-serif, Georgia, serif", google: 'Playfair+Display:wght@400;500;600;700;800' },
  { id: 'merriweather', label: 'Merriweather', family: "'Merriweather', ui-serif, Georgia, serif", google: 'Merriweather:wght@400;700;900' },
  { id: 'space-grotesk', label: 'Space Grotesk', family: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif", google: 'Space+Grotesk:wght@400;500;600;700' },
];

export function findFont(id) {
  return SITE_FONTS.find((f) => f.id === (id || '')) || SITE_FONTS[0];
}