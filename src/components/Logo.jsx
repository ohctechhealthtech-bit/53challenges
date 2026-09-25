import { useSiteSettings, DEFAULT_LOGO_URL } from '@/hooks/useSiteSettings';

/**
 * Renders the platform logo. Pulls the custom logo URL from SiteSetting
 * (set via the admin dashboard branding panel) and falls back to the
 * default logo when none is configured.
 */
export default function Logo({ className = '', alt = '53 Challenges logo' }) {
  const { settings } = useSiteSettings();
  const src = settings.logo_url || DEFAULT_LOGO_URL;
  return <img src={src} alt={alt} className={className} />;
}