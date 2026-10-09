import { useEffect, useState } from 'react';
import { Loader2, Lock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { adminChallengeApi } from '@/lib/adminChallengeApi';
import CheckboxGroup from '@/components/admin/challenges/CheckboxGroup';
import ChallengeAiSuggestButton from '@/components/admin/challenges/ChallengeAiSuggestButton';
import { statusLabel, titleCase, toLocalDT, dtToIso, weightsLocked } from '@/components/admin/challenges/challengeMeta';
import EntryTypeCards from '@/components/admin/challenges/EntryTypeCards';
import CoverImagePicker from '@/components/challenges/CoverImagePicker';
import ChallengeIntroFields from '@/components/challenges/intro/ChallengeIntroFields';
import { CONTENT_TYPE_OPTIONS, normalizeContentType } from '@/lib/contentType';

const deepEqual = (a, b) => {
  if (a === b) return true;
  if (a == null || b == null) return a == b;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  // Objects (the intro block) compare by content, so an untouched intro is
  // not re-sent on every edit.
  if (typeof a === 'object' && typeof b === 'object') return JSON.stringify(a) === JSON.stringify(b);
  return false;
};

const initial = (c, categories) => ({
  title: c?.title || '',
  theme: c?.theme || c?.title || '',
  description: c?.description || c?.brief || '',
  category: c?.category || categories?.[0]?.key || '',
  state: c?.state || '',
  season: c?.season || '',
  stage: c?.stage || 'state',
  status: c?.status || 'draft',
  start_date: toLocalDT(c?.start_date),
  end_date: toLocalDT(c?.end_date),
  voting_end_date: toLocalDT(c?.voting_end_date),
  cover_image: c?.cover_image || '',
  entry_fee: c?.entry_fee ?? 0,
  accepted_entry_types: c?.accepted_entry_types || [],
  age_divisions: c?.age_divisions || [],
  judge_weight: c?.judge_weight ?? 70,
  public_weight: c?.public_weight ?? 30,
  judges_required: c?.judges_required ?? 3,
  content_type: normalizeContentType(c?.content_type),
  capacity_limit: c?.capacity_limit ?? 0,
  intro: c?.intro && typeof c.intro === 'object' ? c.intro : {},
});

export default function ChallengeFormDialog({
  open, onOpenChange, challenge, categories, reference, onSaved,
  // Optional overrides — lets other flows (e.g. converting a host request)
  // reuse this exact form with their own create call.
  titleText, submitLabel, intro, onSubmit,
  // When the challenge data is already complete (e.g. from a child-app
  // preview), skip the parent-API fetch and use the passed object as-is.
  skipFetch,
}) {
  const editing = !!challenge?.id;
  const [values, setValues] = useState(() => initial(challenge, categories));
  const [full, setFull] = useState(challenge);
  const [archived, setArchived] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Editing pulls the full record so weights, divisions and the archived-season
  // flag reflect what the parent actually stores.
  useEffect(() => {
    if (!editing || skipFetch) return;
    let cancelled = false;
    (async () => {
      try {
        const d = await adminChallengeApi.getChallenge({ id: challenge.id });
        if (cancelled) return;
        setFull(d.challenge || challenge);
        setArchived(!!d.season_archived);
        setValues(initial(d.challenge || challenge, categories));
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
    })();
    return () => { cancelled = true; };
  }, [editing, challenge?.id]);

  // When skipFetch is true, the caller already has the full challenge object —
  // sync it into the form whenever the challenge changes.  Without this, the
  // useState initializer only runs once (on mount), so clicking Edit on a
  // different challenge shows the previous challenge's data.
  useEffect(() => {
    if (!skipFetch) return;
    setFull(challenge);
    setArchived(false);
    setValues(initial(challenge, categories));
    setError('');
  }, [skipFetch, challenge?.id]);

  const set = (k, v) => setValues((p) => ({ ...p, [k]: v }));
  const locked = weightsLocked(full);
  const readOnly = archived;
  const missing = !values.theme.trim() || !values.description.trim() || !values.start_date || !values.end_date;

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      let payload;
      if (editing && !onSubmit) {
        // Edit: send only the fields that actually changed (deep-compare arrays).
        const orig = initial(full, categories);
        payload = {};
        const addIfChanged = (key, transform) => {
          const cur = values[key];
          const old = orig[key];
          if (!deepEqual(cur, old)) {
            payload[key] = transform ? transform(cur) : cur;
          }
        };
        addIfChanged('title', (v) => (v || '').trim() || values.theme.trim());
        addIfChanged('theme', (v) => v.trim());
        addIfChanged('description', (v) => v.trim());
        addIfChanged('category');
        addIfChanged('state');
        addIfChanged('season');
        addIfChanged('stage');
        addIfChanged('status');
        addIfChanged('start_date', (v) => dtToIso(v));
        addIfChanged('end_date', (v) => dtToIso(v));
        addIfChanged('voting_end_date', (v) => (v ? dtToIso(v) : null));
        addIfChanged('cover_image', (v) => v.trim());
        addIfChanged('entry_fee', (v) => Number(v) || 0);
        addIfChanged('accepted_entry_types');
        addIfChanged('age_divisions');
        addIfChanged('content_type');
        addIfChanged('capacity_limit', (v) => Math.max(0, Number(v) || 0));
        addIfChanged('intro');
        // Weight fields are only writable while the challenge is still in Draft.
        if (!locked) {
          addIfChanged('judge_weight', (v) => Number(v));
          addIfChanged('public_weight', (v) => Number(v));
          addIfChanged('judges_required', (v) => Number(v));
        }
      } else {
        // Create or custom submit: send the full form.
        payload = {
          title: values.title.trim() || values.theme.trim(),
          theme: values.theme.trim(),
          description: values.description.trim(),
          category: values.category,
          state: values.state,
          season: values.season,
          stage: values.stage,
          status: values.status,
          start_date: dtToIso(values.start_date),
          end_date: dtToIso(values.end_date),
          ...(values.voting_end_date ? { voting_end_date: dtToIso(values.voting_end_date) } : {}),
          cover_image: values.cover_image.trim(),
          entry_fee: Number(values.entry_fee) || 0,
          accepted_entry_types: values.accepted_entry_types,
          age_divisions: values.age_divisions,
          judges_required: Number(values.judges_required),
          content_type: values.content_type,
          capacity_limit: Math.max(0, Number(values.capacity_limit) || 0),
          intro: values.intro,
          ...(locked ? {} : {
            judge_weight: Number(values.judge_weight),
            public_weight: Number(values.public_weight),
          }),
        };
      }
      if (onSubmit) await onSubmit(payload);
      else if (editing) await adminChallengeApi.updateChallenge({ id: challenge.id, challenge: payload });
      else await adminChallengeApi.createChallenge({ challenge: payload });
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[95vw] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{titleText || (editing ? `Edit ${challenge.title || 'challenge'}` : 'Add challenge')}</DialogTitle>
        </DialogHeader>

        {intro && <p className="text-sm text-muted-foreground">{intro}</p>}

        {readOnly && (
          <p className="rounded-xl border border-border bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
            This challenge belongs to an archived season, so it is permanently read-only.
          </p>
        )}

        <div className="space-y-4">
          {!readOnly && (
            <ChallengeAiSuggestButton
              values={values}
              reference={reference}
              onApply={(patch) => setValues((p) => ({ ...p, ...patch }))}
            />
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Text id="title" label="Title" value={values.title} disabled={readOnly} onChange={set} />
            <Text id="theme" label="Theme" required value={values.theme} disabled={readOnly} onChange={set} />
          </div>

          <Wrap id="description" label="Description" required>
            <textarea id="ch-description" rows={3} className="c53-input" disabled={readOnly} value={values.description} onChange={(e) => set('description', e.target.value)} />
          </Wrap>

          <ChallengeIntroFields value={values.intro} disabled={readOnly} onChange={(v) => set('intro', v)} />

          <div className="grid gap-3 sm:grid-cols-3">
            <Wrap id="category" label="Category">
              <select id="ch-category" className="c53-input" disabled={readOnly} value={values.category} onChange={(e) => set('category', e.target.value)}>
                {(categories || []).map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </Wrap>
            <Wrap id="state" label="State">
              <select id="ch-state" className="c53-input" disabled={readOnly} value={values.state} onChange={(e) => set('state', e.target.value)}>
                <option value="">Nationwide</option>
                {(reference?.states || []).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Wrap>
            <Text id="season" label="Season" value={values.season} disabled={readOnly} onChange={set} placeholder="e.g. 2026" />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Wrap id="stage" label="Stage">
              <select id="ch-stage" className="c53-input" disabled={readOnly} value={values.stage} onChange={(e) => set('stage', e.target.value)}>
                {(reference?.pipeline_stages || ['state']).map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
              </select>
            </Wrap>
            <Wrap id="status" label="Status">
              <select id="ch-status" className="c53-input" disabled={readOnly} value={values.status} onChange={(e) => set('status', e.target.value)}>
                {(reference?.statuses || ['draft']).map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
              </select>
            </Wrap>
            <Text id="entry_fee" label="Entry fee (cents)" type="number" value={values.entry_fee} disabled={readOnly} onChange={set} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Wrap id="content_type" label="Content type">
              <select id="ch-content_type" className="c53-input" disabled={readOnly} value={values.content_type} onChange={(e) => set('content_type', e.target.value)}>
                {CONTENT_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label} — {o.description}</option>)}
              </select>
            </Wrap>
            <Wrap id="capacity_limit" label="Participant capacity">
              <input id="ch-capacity_limit" type="number" min="0" className="c53-input" disabled={readOnly} placeholder="0 = no limit" value={values.capacity_limit} onChange={(e) => set('capacity_limit', e.target.value)} />
              <p className="mt-1 text-xs text-muted-foreground">Maximum approved entries. 0 = unlimited.</p>
            </Wrap>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Text id="start_date" label="Start date & time" type="datetime-local" required value={values.start_date} disabled={readOnly} onChange={set} />
            <Text id="end_date" label="Submission deadline" type="datetime-local" required value={values.end_date} disabled={readOnly} onChange={set} />
            <Text id="voting_end_date" label="Voting closes" type="datetime-local" value={values.voting_end_date} disabled={readOnly} onChange={set} />
          </div>

          <Wrap id="cover_image" label="Cover image">
            <CoverImagePicker value={values.cover_image} disabled={readOnly} onChange={(v) => set('cover_image', v)} />
          </Wrap>

          <Wrap id="accepted_entry_types" label="Entry types accepted">
            <EntryTypeCards
              options={reference?.entry_types || []}
              values={values.accepted_entry_types}
              disabled={readOnly}
              onChange={(v) => set('accepted_entry_types', v)}
            />
            <p className="mt-1 text-xs text-muted-foreground">Leave all unticked to accept every type.</p>
          </Wrap>

          <CheckboxGroup
            label="Age divisions"
            options={reference?.age_divisions || []}
            values={values.age_divisions}
            disabled={readOnly}
            onChange={(v) => set('age_divisions', v)}
          />

          <div className="grid gap-3 sm:grid-cols-3">
            <Text id="judge_weight" label="Judge weight" type="number" value={values.judge_weight} disabled={readOnly || locked} onChange={set} />
            <Text id="public_weight" label="Public weight" type="number" value={values.public_weight} disabled={readOnly || locked} onChange={set} />
            <Text id="judges_required" label="Judges required" type="number" value={values.judges_required} disabled={readOnly || locked} onChange={set} />
          </div>

          {Number(values.judge_weight) + Number(values.public_weight) !== 100 && !readOnly && !locked && (
            <p className="text-xs text-destructive">Judge and public weights must add up to 100.</p>
          )}
          {locked && !readOnly && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5" /> Locked once the challenge leaves Draft.
            </p>
          )}

          {missing && !readOnly && (
            <p className="text-xs text-muted-foreground">Theme, description, start date and end date are required.</p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || readOnly || missing}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} {submitLabel || (editing ? 'Save changes' : 'Create challenge')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Wrap({ id, label, required, children }) {
  return (
    <div>
      <label htmlFor={`ch-${id}`} className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {label}{required && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      {children}
    </div>
  );
}

function Text({ id, label, value, type = 'text', required, disabled, placeholder, onChange }) {
  return (
    <Wrap id={id} label={label} required={required}>
      <input
        id={`ch-${id}`}
        type={type}
        className="c53-input"
        placeholder={placeholder}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(id, e.target.value)}
      />
    </Wrap>
  );
}