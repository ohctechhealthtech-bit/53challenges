// Shared media logic for dashboard entry/challenge cards.
// Priority order for picking the image shown on a dashboard card:
//   1. challenge banner / hero image
//   2. entry direct image URL
//   3. entry YouTube link → YouTube thumbnail
//   4. styled fallback tile (no <img> at all)

const IMAGE_EXT_RE = /\.(png|jpe?g|webp|gif|avif|bmp|svg)(\?|$)/i;

const KNOWN_IMAGE_HOSTS = [
  'images.unsplash.com',
  'img.youtube.com',
  'media.base44.com',
  'static.wixstatic.com',
  'res.cloudinary.com',
  'firebasestorage.googleapis.com',
  'amazonaws.com',
  'cloudfront.net',
  'i.ytimg.com',
];

export function isValidImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const s = url.trim();
  if (!s) return false;
  try {
    const u = new URL(s);
    if (IMAGE_EXT_RE.test(u.pathname)) return true;
    return KNOWN_IMAGE_HOSTS.some((h) => u.hostname.includes(h));
  } catch {
    return false;
  }
}

export function ytThumb(url) {
  if (!url || typeof url !== 'string') return null;
  const m = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([\w-]{11})/
  );
  return m ? `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` : null;
}

/**
 * Returns { type: 'image', src } when a usable image is available, otherwise
 * { type: 'fallback' } so the caller renders a styled tile instead of a bare
 * icon placeholder.
 */
export function getDashboardCardImage(challenge, entry) {
  // 1. Challenge banner / hero image
  const challengeImg =
    challenge?.cover_image ||
    challenge?.hero_image ||
    challenge?.image ||
    challenge?.banner_image;
  if (isValidImageUrl(challengeImg)) {
    return { type: 'image', src: challengeImg };
  }

  // 2. Entry direct image URL
  const entryImg = entry?.work_link || entry?.work_url;
  if (isValidImageUrl(entryImg)) {
    return { type: 'image', src: entryImg };
  }

  // 3. Entry YouTube thumbnail
  const yt = ytThumb(entry?.work_link || entry?.work_url);
  if (yt) {
    return { type: 'image', src: yt };
  }

  // 4. Styled fallback
  return { type: 'fallback' };
}