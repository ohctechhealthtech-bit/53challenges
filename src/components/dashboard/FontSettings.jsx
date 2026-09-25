import { useState } from 'react';
import { Loader2, Save, Check, Type } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useSiteSettings, refreshSiteSettings } from '@/hooks/useSiteSettings';
import { SITE_FONTS, findFont } from '@/lib/siteFonts';

/** Admin font picker — persists `theme_font_family` for the whole site. */
export default function FontSettings() {
  const { settings } = useSiteSettings();
  const current = settings.theme_font_family || '';
  const [choice, setChoice] = useState(current);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async (value) => {
    setSaving(true);
    try {
      const existing = await base44.entities.SiteSetting.filter({ key: 'theme_font_family' });
      if (existing.length > 0) {
        await base44.entities.SiteSetting.update(existing[0].id, { value });
      } else {
        await base44.entities.SiteSetting.create({ key: 'theme_font_family', value });
      }
      await refreshSiteSettings();
      setChoice(value);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      /* ignore */
    }
    setSaving(false);
  };

  return (
    <div className="mt-8 border-t border-border pt-6">
      <h3 className="font-heading text-lg font-bold">Font</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Set the typeface — it applies to headings and body text across the entire site.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Type className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <select
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
            className="c53-input w-64 pl-10"
          >
            {SITE_FONTS.map((f) => (
              <option key={f.id || 'default'} value={f.id}>{f.label}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => save(choice)}
          disabled={saving || choice === current}
          className="inline-flex items-center gap-2 rounded-xl grad-bg px-5 py-2.5 text-sm font-bold text-white transition hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
        >
          {saved ? <Check className="h-4 w-4" /> : saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saved ? 'Saved' : saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      <p className="mt-4 text-2xl font-bold" style={{ fontFamily: findFont(choice).family }}>
        The quick brown fox jumps over the lazy dog
      </p>

      {current && (
        <button
          onClick={() => save('')}
          disabled={saving}
          className="mt-4 text-sm font-medium text-muted-foreground transition hover:text-destructive disabled:opacity-50"
        >
          Reset to default font
        </button>
      )}
    </div>
  );
}