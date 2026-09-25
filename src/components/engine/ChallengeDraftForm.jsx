import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import DivisionPicker from '@/components/engine/DivisionPicker';
import { CONTENT_TYPE_OPTIONS, DEFAULT_CONTENT_TYPE } from '@/lib/contentType';

const CATEGORIES = ['visual-arts', 'photography', 'writing', 'digital-creativity', 'performance-voice', 'open-experimental'];
const STAGES = ['state', 'national', 'grand_final'];
const STATUSES = ['draft', 'active', 'voting', 'completed', 'archived'];

const EMPTY = {
  title: '', category: 'visual-arts', brief: '', stage: 'state', state: '', season: '', divisions: [],
  cover_image: '', starts_at: '', submission_ends_at: '', voting_ends_at: '', status: 'draft',
  content_type: DEFAULT_CONTENT_TYPE,
};

export default function ChallengeDraftForm({ initial, onSubmit, onCancel, submitting }) {
  const [form, setForm] = useState({ ...EMPTY, ...(initial || {}) });
  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  const submit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-border bg-card p-4">
      <Field label="Title"><input className="c53-input" value={form.title} onChange={(e) => set('title', e.target.value)} required /></Field>
      <Field label="Category">
        <select className="c53-input" value={form.category} onChange={(e) => set('category', e.target.value)}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>
      <Field label="Content type — who creates and manages the content">
        <select className="c53-input" value={form.content_type || DEFAULT_CONTENT_TYPE} onChange={(e) => set('content_type', e.target.value)}>
          {CONTENT_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Field>
      <Field label="Age divisions open to entry">
        <DivisionPicker value={form.divisions || []} onChange={(v) => set('divisions', v)} />
      </Field>
      <Field label="Brief"><textarea className="c53-input min-h-[100px]" value={form.brief} onChange={(e) => set('brief', e.target.value)} required /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Stage">
          <select className="c53-input" value={form.stage} onChange={(e) => set('stage', e.target.value)}>
            {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <select className="c53-input" value={form.status} onChange={(e) => set('status', e.target.value)}>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="State"><input className="c53-input" value={form.state} onChange={(e) => set('state', e.target.value)} placeholder="QLD" /></Field>
        <Field label="Season"><input className="c53-input" value={form.season} onChange={(e) => set('season', e.target.value)} placeholder="Good 2026" /></Field>
        <Field label="Cover image URL"><input className="c53-input" value={form.cover_image} onChange={(e) => set('cover_image', e.target.value)} /></Field>
        <Field label="Starts"><input type="date" className="c53-input" value={(form.starts_at || '').slice(0, 10)} onChange={(e) => set('starts_at', e.target.value)} /></Field>
        <Field label="Submissions close"><input type="date" className="c53-input" value={(form.submission_ends_at || '').slice(0, 10)} onChange={(e) => set('submission_ends_at', e.target.value)} /></Field>
        <Field label="Voting closes"><input type="date" className="c53-input" value={(form.voting_ends_at || '').slice(0, 10)} onChange={(e) => set('voting_ends_at', e.target.value)} /></Field>
      </div>
      <div className="flex gap-2 pt-1">
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
          Create challenge
        </Button>
        {onCancel && <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>}
      </div>
    </form>
  );
}

function Field({ label, children }) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}