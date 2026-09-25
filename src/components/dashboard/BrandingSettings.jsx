import { useState, useRef } from 'react';
import { Loader2, Upload, Save, Check, Image as ImageIcon } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useSiteSettings, refreshSiteSettings, DEFAULT_LOGO_URL } from '@/hooks/useSiteSettings';
import FontSettings from '@/components/dashboard/FontSettings';

/**
 * Admin branding panel — upload/paste a logo URL and persist it as a
 * SiteSetting so it renders across the entire site (navbar + footer).
 */
export default function BrandingSettings() {
  const { settings } = useSiteSettings();
  const [logoUrl, setLogoUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [themeColor, setThemeColor] = useState('');
  const [themeSaved, setThemeSaved] = useState(false);
  const fileRef = useRef(null);

  const currentLogo = settings.logo_url || DEFAULT_LOGO_URL;
  const previewUrl = logoUrl || currentLogo;
  const currentThemeColor = settings.theme_background_color || '';

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const res = await base44.integrations.Core.UploadFile({ file });
      const url = res?.file_url || res?.data?.file_url;
      if (url) setLogoUrl(url);
    } catch {
      /* ignore — inline error could be added */
    }
    setUploading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const existing = await base44.entities.SiteSetting.filter({ key: 'logo_url' });
      if (existing.length > 0) {
        await base44.entities.SiteSetting.update(existing[0].id, { value: logoUrl });
      } else {
        await base44.entities.SiteSetting.create({ key: 'logo_url', value: logoUrl });
      }
      refreshSiteSettings();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      setLogoUrl('');
    } catch {
      /* ignore */
    }
    setSaving(false);
  };

  const handleReset = async () => {
    setSaving(true);
    try {
      const existing = await base44.entities.SiteSetting.filter({ key: 'logo_url' });
      if (existing.length > 0) {
        await base44.entities.SiteSetting.update(existing[0].id, { value: '' });
      }
      refreshSiteSettings();
      setLogoUrl('');
    } catch {
      /* ignore */
    }
    setSaving(false);
  };

  const handleSaveTheme = async () => {
    let hex = String(themeColor || '').trim().replace(/^#/, '');
    // Accept 3-digit shorthand and expand to 6 digits.
    if (/^[0-9a-fA-F]{3}$/.test(hex)) {
      hex = hex.split('').map((c) => c + c).join('');
    }
    if (!/^[0-9a-fA-F]{6}$/.test(hex)) return;
    const value = `#${hex}`;
    setSaving(true);
    try {
      const existing = await base44.entities.SiteSetting.filter({ key: 'theme_background_color' });
      if (existing.length > 0) {
        await base44.entities.SiteSetting.update(existing[0].id, { value });
      } else {
        await base44.entities.SiteSetting.create({ key: 'theme_background_color', value });
      }
      await refreshSiteSettings();
      setThemeSaved(true);
      setTimeout(() => setThemeSaved(false), 2500);
      setThemeColor('');
    } catch {
      /* ignore */
    }
    setSaving(false);
  };

  const handleResetTheme = async () => {
    setSaving(true);
    try {
      const existing = await base44.entities.SiteSetting.filter({ key: 'theme_background_color' });
      if (existing.length > 0) {
        await base44.entities.SiteSetting.update(existing[0].id, { value: '' });
      }
      refreshSiteSettings();
      setThemeColor('');
    } catch {
      /* ignore */
    }
    setSaving(false);
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h2 className="font-heading text-xl font-bold">Branding</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Set the platform logo — it appears in the navbar and footer across the entire site.
      </p>

      {/* Preview */}
      <div className="mt-6 flex items-center gap-6 rounded-xl border border-border bg-background/50 p-5">
        <div className="flex h-20 w-32 shrink-0 items-center justify-center rounded-lg border border-border bg-white/5">
          <img src={previewUrl} alt="Logo preview" className="max-h-16 max-w-[120px] w-auto object-contain" />
        </div>
        <div>
          <p className="text-sm font-semibold">Live preview</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {logoUrl ? 'New logo (unsaved)' : settings.logo_url ? 'Current saved logo' : 'Default logo'}
          </p>
        </div>
      </div>

      {/* Upload */}
      <div className="mt-6">
        <label className="text-sm font-semibold">Upload logo file</label>
        <p className="mt-0.5 text-xs text-muted-foreground">PNG with transparency recommended.</p>
        <div className="mt-2 flex items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-white/5 px-4 py-2.5 text-sm font-semibold transition hover:bg-muted disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? 'Uploading…' : 'Choose file'}
          </button>
          {uploading && <span className="text-xs text-muted-foreground">Generating URL…</span>}
        </div>
      </div>

      {/* URL paste */}
      <div className="mt-5">
        <label className="text-sm font-semibold">Or paste an image URL</label>
        <div className="mt-2 flex items-center gap-2">
          <div className="relative flex-1">
            <ImageIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://…"
              className="c53-input pl-10"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={!logoUrl.trim() || saving}
            className="inline-flex items-center gap-2 rounded-xl grad-bg px-5 py-2.5 text-sm font-bold text-white transition hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {saved ? <Check className="h-4 w-4" /> : saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saved ? 'Saved' : saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* Reset */}
      {settings.logo_url && (
        <button
          onClick={handleReset}
          disabled={saving}
          className="mt-4 text-sm font-medium text-muted-foreground transition hover:text-destructive disabled:opacity-50"
        >
          Reset to default logo
        </button>
      )}

      {/* ── Theme color ─────────────────────────────────────────── */}
      <div className="mt-8 border-t border-border pt-6">
        <h3 className="font-heading text-lg font-bold">Theme Color</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Set the background color — it applies to the header, cards, and page backgrounds across the entire site.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            type="color"
            value={themeColor || currentThemeColor || '#0d0d11'}
            onChange={(e) => setThemeColor(e.target.value)}
            className="h-12 w-16 cursor-pointer rounded-lg border border-border bg-transparent p-1"
            title="Pick a color"
          />
          <input
            type="text"
            value={themeColor || currentThemeColor}
            onChange={(e) => setThemeColor(e.target.value)}
            placeholder="#0d0d11"
            className="c53-input w-40"
          />
          <button
            onClick={handleSaveTheme}
            disabled={(!themeColor.trim() || themeColor === currentThemeColor) || saving}
            className="inline-flex items-center gap-2 rounded-xl grad-bg px-5 py-2.5 text-sm font-bold text-white transition hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {themeSaved ? <Check className="h-4 w-4" /> : saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {themeSaved ? 'Saved' : saving ? 'Saving…' : 'Save'}
          </button>
        </div>

        {currentThemeColor && (
          <button
            onClick={handleResetTheme}
            disabled={saving}
            className="mt-4 text-sm font-medium text-muted-foreground transition hover:text-destructive disabled:opacity-50"
          >
            Reset to default theme
          </button>
        )}
      </div>

      <FontSettings />
    </div>
  );
}