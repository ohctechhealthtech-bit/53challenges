/** Photos for the idea wizard tiles, keyed by option value. */
const u = (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&q=80`;

export const ORG_TYPE_IMAGES = {
  individual: u('1531123897727-8f129e1688ce'),
  business: u('1522071820081-009f0129c71c'),
  school: u('1580582932707-520aed937b7b'),
};

export const PURPOSE_IMAGES = {
  awareness: u('1523961131990-5ea7c61b2107'),
  leads: u('1521737604893-d14cc237f11d'),
  sales: u('1556742049-0cfed4f6a45d'),
  content: u('1492691527719-9d1e07e534b4'),
  goodwill: u('1559027615-cd4628902d4a'),
  education: u('1524178232363-1fb2b075b655'),
  recruitment: u('1521791136064-7986c2920216'),
  insight: u('1454165804606-c3d57bc86b40'),
  loyalty: u('1543269865-cbf427effbad'),
  publicity: u('1495020689067-958852a7765e'),
};

export const ACTIVITY_IMAGES = {
  'art-craft-making': u('1513364776144-60967b0f800f'),
  'food-farming-community': u('1466637574441-749b8f19452f'),
  'music-dance-performance': u('1470229722913-7c0e2dbbafd3'),
  'outdoor-adventure': u('1551632811-561732d1e306'),
  'photography-film-digital': u('1502920917128-1aa500764cbd'),
  'writing-ideas-innovation': u('1455390582262-044cdead277a'),
  not_sure: u('1499750310107-5fef28a66643'),
};