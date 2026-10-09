import { useState } from 'react';
import { ChevronDown, ChevronRight, Wand2 } from 'lucide-react';
import CoverImagePicker from '@/components/challenges/CoverImagePicker';
import IntroHighlightsEditor from './IntroHighlightsEditor';
import IntroGalleryEditor from './IntroGalleryEditor';
import { ACCENTS } from './accents';
import { ACCENT_NAMES } from './introIcons';

// Everything that drives a challenge's public intro page — the `intro`
// object on the challenge. Keys match what the intro page reads.
export default function ChallengeIntroFields({ value, onChange, disabled, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const v = value || {};
  const set = (k, x) => onChange({ ...v, [k]: x });


  return (
    <div className="rounded-lg border border-border">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left" aria-expanded={open}>
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        <Wand2 className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Intro page content</span>
        <span className="text-xs text-muted-foreground">hero words, video, images &amp; highlight cards</span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-border px-3 pb-4 pt-4">
          <p className="text-xs text-muted-foreground">
            The page people land on when they open this challenge. Anything left blank falls back to the theme, description and cover image.
          </p>
          <Field label="Hero headline">
            <input className="c53-input" disabled={disabled} placeholder="e.g. Paint the Colours of Spring" value={v.headline || ''} onChange={(e) => set('headline', e.target.value)} />
          </Field>
          <Field label="Tagline">
            <input className="c53-input" disabled={disabled} placeholder="One punchy line that hooks people in" value={v.tagline || ''} onChange={(e) => set('tagline', e.target.value)} />
          </Field>
          <Field label="Intro story">
            <textarea rows={4} className="c53-input" disabled={disabled} placeholder="What it's about, who it's for, what happens next…" value={v.body || ''} onChange={(e) => set('body', e.target.value)} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Hero background image">
              <CoverImagePicker value={v.hero_image || ''} disabled={disabled} onChange={(x) => set('hero_image', x)} />
            </Field>
            <Field label="Colour theme">
              <select className="c53-input" disabled={disabled} value={v.accent || 'orange'} onChange={(e) => set('accent', e.target.value)}>
                {Object.keys(ACCENTS).map((k) => <option key={k} value={k}>{ACCENT_NAMES[k] || k}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Intro video">
            <input className="c53-input" disabled={disabled} placeholder="YouTube / Vimeo link, or a direct .mp4 URL" value={v.video_url || ''} onChange={(e) => set('video_url', e.target.value)} />
          </Field>
          <Field label="Highlight cards">
            <IntroHighlightsEditor value={v.highlights || []} disabled={disabled} onChange={(x) => set('highlights', x)} />
          </Field>
          <Field label="Inspiration gallery">
            <IntroGalleryEditor value={v.gallery || []} disabled={disabled} onChange={(x) => set('gallery', x)} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label='"Participate" button label'>
              <input className="c53-input" disabled={disabled} placeholder="Participate" value={v.cta_participate_label || ''} onChange={(e) => set('cta_participate_label', e.target.value)} />
            </Field>
            <Field label='"Vote" button label'>
              <input className="c53-input" disabled={disabled} placeholder="Vote" value={v.cta_vote_label || ''} onChange={(e) => set('cta_vote_label', e.target.value)} />
            </Field>
          </div>
        </div>
      )}
    </div>
  );
}

// Module scope, not inside the component: a component declared during render
// is a new type each time, so React remounts its inputs and they lose focus
// after every keystroke.
function Field({ label, children }) {
  return (
    <div>
      <p className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}
