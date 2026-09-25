/**
 * Hand-picked Unsplash photos for the guided discovery tiles, keyed by the
 * existing option values. Missing keys simply fall back to the icon layout.
 */
const u = (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&q=80`;

export const CATEGORY_IMAGES = {
  'art-craft-making': u('1513364776144-60967b0f800f'),
  'food-farming-community': u('1466637574441-749b8f19452f'),
  'music-dance-performance': u('1470229722913-7c0e2dbbafd3'),
  'outdoor-adventure': u('1551632811-561732d1e306'),
  'photography-film-digital': u('1502920917128-1aa500764cbd'),
  'writing-ideas-innovation': u('1455390582262-044cdead277a'),
};

export const FORMAT_IMAGES = {
  photo: u('1519183071298-a2962feb14f4'),
  video: u('1492691527719-9d1e07e534b4'),
  written: u('1519389950473-47ba0277781c'),
  made_object: u('1452860606245-08befc0ff44b'),
  performance: u('1516450360452-9312f5e86fc7'),
  cooked_dish: u('1512621776951-a57141f2eefd'),
  outdoor_activity: u('1476480862126-209bfaa8edc8'),
  open_submission: u('1499750310107-5fef28a66643'),
};

export const AGE_IMAGES = {
  under_13: u('1503454537195-1dcabb73ffb9'),
  ages_13_to_17: u('1529333166437-7750a6dd5a70'),
  adults_18_plus: u('1522071820081-009f0129c71c'),
  all_ages: u('1511895426328-dc8714191300'),
};

export const SETTING_IMAGES = {
  school: u('1580582932707-520aed937b7b'),
  workplace: u('1497366216548-37526070297c'),
  community: u('1519861531473-9200262188bf'),
  public: u('1533174072545-7a4b6ad7a6c3'),
};

export const TILE_IMAGES = {
  ...CATEGORY_IMAGES,
  ...FORMAT_IMAGES,
  ...AGE_IMAGES,
  ...SETTING_IMAGES,
};