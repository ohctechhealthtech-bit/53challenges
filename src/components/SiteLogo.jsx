import { useSiteSettings } from '@/hooks/useSiteSettings';

/**
 * Primary header/footer logo. When an admin has uploaded a custom logo in
 * the dashboard Branding panel (SiteSetting `logo_url`), that image is
 * rendered everywhere. Otherwise falls back to the built-in SVG lockup.
 *
 * `size` sets the visual height in px of the lockup.
 */
export default function SiteLogo({ size = 28, className = '' }) {
  const { settings } = useSiteSettings();

  if (settings.logo_url) {
    return (
      <span className={`inline-flex items-center ${className}`} style={{ height: size * 1.75 }}>
        <img
          src={settings.logo_url}
          alt="53 Challenges logo"
          draggable="false"
          className="h-full w-auto max-w-none select-none object-contain object-left"
          style={{ imageRendering: 'auto' }}
        />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center ${className}`}
      style={{ height: size, gap: size * 0.38 }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
        aria-hidden="true"
      >
        <rect x="0.75" y="0.75" width="30.5" height="30.5" rx="7.5" fill="#1677C8" />
        {/* Upward chevron — progress / ranking */}
        <path
          d="M8.5 20.5 16 12l7.5 8.5"
          stroke="#FFFFFF"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="16" cy="23.5" r="1.6" fill="#FFFFFF" opacity="0.85" />
      </svg>
      <span
        className="whitespace-nowrap font-heading leading-none tracking-tight"
        style={{ fontSize: size * 0.7 }}
      >
        <span className="font-extrabold">53</span>
        <span className="font-medium"> Challenges</span>
      </span>
    </span>
  );
}