import { useSiteSettings, DEFAULT_LOGO_URL } from '@/hooks/useSiteSettings';

/**
 * Primary header/footer logo: the admin-uploaded image from SiteSetting
 * `logo_url`, or the default logo image when none is set.
 *
 * There used to be a third state — a built-in blue chevron and "53
 * Challenges" lockup drawn while the settings were still loading — and
 * because settings load from the network on every visit, that lockup was
 * the first thing every visitor saw, replaced a moment later by the real
 * logo. It is gone. The real logo is the only logo; while a custom one is
 * unknown, the default image stands in, which is a logo too.
 *
 * `size` sets the visual height in px of the lockup.
 */
export default function SiteLogo({ size = 28, className = '' }) {
  const { settings } = useSiteSettings();
  const src = settings.logo_url || DEFAULT_LOGO_URL;

  return (
    <span className={`inline-flex items-center ${className}`} style={{ height: size * 1.75 }}>
      <img
        src={src}
        alt="53 Challenges logo"
        draggable="false"
        fetchPriority="high"
        className="h-full w-auto max-w-none select-none object-contain object-left"
        style={{ imageRendering: 'auto' }}
      />
    </span>
  );
}
