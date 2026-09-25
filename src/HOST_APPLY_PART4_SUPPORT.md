# /host-apply — Part 4: Supporting Components, Hooks, Shared Logic & Entities

This is part 4. See also:
- `HOST_APPLY_PART1_API_PAGE.md` — API reference & page
- `HOST_APPLY_PART2_WIZARD.md` — Wizard model, screen router, shell
- `HOST_APPLY_PART3_STEPS.md` — All step components

---

## Supporting Components

### BeneficiaryFields.jsx

**File:** `src/components/host/apply/BeneficiaryFields.jsx`

```jsx
/** Details about the organisation a host is running the challenge on behalf of. */
import FieldError, { errorRing } from '@/components/host/apply/FieldError';

const Req = () => <span className="font-normal text-destructive">(required)</span>;
const Opt = () => <span className="font-normal text-muted-foreground">(optional)</span>;

export default function BeneficiaryFields({ answers, set, errorFor = () => '' }) {
  const field = (k) => (e) => set(k, e.target.value);
  const inputProps = (k) => {
    const message = errorFor(k);
    return {
      className: `c53-input ${errorRing(message)}`.trim(),
      'aria-invalid': message ? 'true' : undefined,
      'aria-describedby': message ? `${k}-error` : undefined,
    };
  };

  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="beneficiary_name" className="mb-1 block text-sm font-semibold">
          Organisation or group name <Req />
        </label>
        <p className="mb-2 text-xs text-muted-foreground">
          The brand, school, club or community this challenge is being run for.
        </p>
        <input
          id="beneficiary_name"
          {...inputProps('beneficiary_name')}
          placeholder="e.g. Riverside Primary School"
          value={answers.beneficiary_name || ''}
          onChange={field('beneficiary_name')}
        />
        <FieldError id="beneficiary_name-error" message={errorFor('beneficiary_name')} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="beneficiary_contact_name" className="mb-1 block text-sm font-semibold">
            Contact person <Req />
          </label>
          <input
            id="beneficiary_contact_name"
            {...inputProps('beneficiary_contact_name')}
            placeholder="e.g. Sarah Nguyen"
            value={answers.beneficiary_contact_name || ''}
            onChange={field('beneficiary_contact_name')}
          />
          <FieldError id="beneficiary_contact_name-error" message={errorFor('beneficiary_contact_name')} />
        </div>
        <div>
          <label htmlFor="beneficiary_contact_role" className="mb-1 block text-sm font-semibold">
            Their role <Opt />
          </label>
          <input
            id="beneficiary_contact_role"
            className="c53-input"
            placeholder="e.g. Marketing Manager"
            value={answers.beneficiary_contact_role || ''}
            onChange={field('beneficiary_contact_role')}
          />
        </div>
        <div>
          <label htmlFor="beneficiary_contact_email" className="mb-1 block text-sm font-semibold">
            Contact email <Req />
          </label>
          <input
            id="beneficiary_contact_email"
            type="email"
            {...inputProps('beneficiary_contact_email')}
            placeholder="e.g. sarah@riverside.edu.au"
            value={answers.beneficiary_contact_email || ''}
            onChange={field('beneficiary_contact_email')}
          />
          <FieldError id="beneficiary_contact_email-error" message={errorFor('beneficiary_contact_email')} />
        </div>
        <div>
          <label htmlFor="beneficiary_contact_phone" className="mb-1 block text-sm font-semibold">
            Contact phone <Opt />
          </label>
          <input
            id="beneficiary_contact_phone"
            type="tel"
            className="c53-input"
            placeholder="e.g. 0400 000 000"
            value={answers.beneficiary_contact_phone || ''}
            onChange={field('beneficiary_contact_phone')}
          />
        </div>
      </div>

      <div>
        <label htmlFor="beneficiary_website" className="mb-1 block text-sm font-semibold">
          Website or portal link <Opt />
        </label>
        <p className="mb-2 text-xs text-muted-foreground">
          Their website, portal or social page — anything that helps us understand them.
        </p>
        <input
          id="beneficiary_website"
          className="c53-input"
          placeholder="e.g. https://riverside.edu.au"
          value={answers.beneficiary_website || ''}
          onChange={field('beneficiary_website')}
        />
      </div>
    </div>
  );
}
```

### FieldError.jsx

**File:** `src/components/host/apply/FieldError.jsx`

```jsx
/** Inline, per-field error message for wizard questions. */
import { AlertCircle } from 'lucide-react';

/** Extra classes that mark an input as having an error. */
export const errorRing = (message) =>
  message ? 'border-destructive ring-1 ring-destructive/40' : '';

export default function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-destructive">
      <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
}
```

### OrganisationChoiceTiles.jsx

**File:** `src/components/host/apply/OrganisationChoiceTiles.jsx`

```jsx
/** Two-tile choice: is this challenge for my own organisation, or someone else? */
import { Building2, Users, User, Check } from 'lucide-react';

export default function OrganisationChoiceTiles({ orgName, isIndividual = false, value, onChange }) {
  const tiles = [
    {
      value: 'my_org',
      icon: orgName ? Building2 : (isIndividual ? User : Building2),
      label: orgName
        ? "I'm organising this for my company"
        : isIndividual
          ? "I'm organising this for myself"
          : "I'm organising this for my own organisation",
      hint: orgName || 'No extra details needed',
    },
    {
      value: 'other',
      icon: Users,
      label: "I'm organising this for someone else",
      hint: 'Another company, school, club or community',
    },
  ];

  return (
    <div role="radiogroup" aria-label="Who is this challenge being organised for?" className="grid gap-4 sm:grid-cols-2">
      {tiles.map((t) => {
        const active = value === t.value;
        const Icon = t.icon;
        return (
          <button
            key={t.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(t.value)}
            className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors ${
              active ? 'border-gold bg-gold/10' : 'border-border bg-card hover:border-primary/40'
            }`}
          >
            <Icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">{t.label}</span>
              <span className="block text-xs text-muted-foreground">{t.hint}</span>
            </span>
            {active && <Check className="h-5 w-5 shrink-0 text-gold" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}
```

### PricingSummary.jsx

**File:** `src/components/host/apply/PricingSummary.jsx`

```jsx
/**
 * Live price breakdown for the application — fetched from the server so the
 * amount shown always matches what will be charged.
 */
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { hostPortal } from '@/lib/hostPortalClient';
import { formatAud } from '@/lib/hostDeposit';
import { PLATFORM_INTEGRITY_FEE } from '@/lib/hostFees';

export default function PricingSummary({ answers, onPricing }) {
  const [pricing, setPricing] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    hostPortal('price_application', { answers })
      .then((data) => {
        if (!active) return;
        setPricing(data.pricing);
        onPricing?.(data.pricing);
      })
      .catch((e) => { if (active) setError(e?.message || 'Could not price your application'); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!pricing) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-border bg-card py-8">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  const lines = [
    { name: pricing.package.label, amount: pricing.package.amount },
    ...pricing.addons,
  ].filter((l) => l.amount > 0);

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your application</p>
      {lines.length === 0 && (
        <p className="text-sm text-muted-foreground">Nothing to pay now — the self-service package is free to apply.</p>
      )}
      <ul className="space-y-2">
        {lines.map((l) => (
          <li key={l.name} className="flex items-center justify-between text-sm">
            <span>{l.name}</span>
            <span className="font-semibold">{formatAud(l.amount / 100)}</span>
          </li>
        ))}
        <li className="flex items-center justify-between text-sm" title={PLATFORM_INTEGRITY_FEE.explainer}>
          <span>
            {PLATFORM_INTEGRITY_FEE.label}
            <span className="mt-0.5 block text-xs text-muted-foreground">{PLATFORM_INTEGRITY_FEE.explainer}</span>
          </span>
          <span className="font-semibold">{formatAud(PLATFORM_INTEGRITY_FEE.amount / 100)}</span>
        </li>
      </ul>
      {lines.length > 0 && (
        <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
          <span className="text-sm font-semibold">Total due now</span>
          <span className="font-heading text-lg font-extrabold">{formatAud(pricing.total_amount / 100)}</span>
        </div>
      )}
    </div>
  );
}
```

### QuestionTiles.jsx

**File:** `src/components/host/QuestionTiles.jsx`

```jsx
/**
 * D8 — Host Experience Principles.
 * Rules applied: D8.2 (visual answer tiles, not form fields), D8.7 (Recommended badge).
 */
import { Check } from 'lucide-react';
import RecommendedBadge from '@/components/host/RecommendedBadge';

export default function QuestionTiles({ options, value, onChange, multi = false, recommended }) {
  const selected = multi ? value || [] : value;
  const isSelected = (v) => (multi ? selected.includes(v) : selected === v);
  const isRecommended = (v) =>
    multi ? (recommended || []).includes(v) : recommended === v;

  const toggle = (v) => {
    if (multi) {
      onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
    } else {
      onChange(v);
    }
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role={multi ? 'group' : 'radiogroup'}>
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = isSelected(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            role={multi ? 'checkbox' : 'radio'}
            aria-checked={active}
            onClick={() => toggle(opt.value)}
            className={`relative flex flex-col items-start gap-2 rounded-2xl p-4 text-left transition-all ${
              active
                ? 'border-2 border-[#1677C8] bg-blue-50 text-[#102A43]'
                : 'border border-border bg-card hover:border-primary/50'
            }`}
          >
            {active && (
              <Check className="absolute right-3 top-3 h-4 w-4 text-[#1677C8]" aria-hidden="true" />
            )}
            <div className="flex w-full items-start justify-between gap-2 pr-6">
              {Icon && <Icon className={`h-6 w-6 ${active ? 'text-[#1677C8]' : 'text-muted-foreground'}`} aria-hidden="true" />}
              {isRecommended(opt.value) && <RecommendedBadge />}
            </div>
            <span className="font-heading text-sm font-bold">{opt.label}</span>
            {opt.description && (
              <span className={`text-xs leading-relaxed ${active ? 'text-slate-600' : 'text-muted-foreground'}`}>{opt.description}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
```

### AddonPicker.jsx

**File:** `src/components/host/AddonPicker.jsx`

```jsx
/**
 * D8 — Host Experience Principles.
 * Rules applied: D8.1 (services named in plain language), D8.7 (recommended defaults badged).
 * Scrollable list of optional services with their price — driven by the live
 * services list from the platform, nothing hard-coded in the UI.
 */
import { Check, Loader2 } from 'lucide-react';
import RecommendedBadge from '@/components/host/RecommendedBadge';
import useHostServices from '@/hooks/useHostServices';

export default function AddonPicker({ value = [], onChange, recommended = [] }) {
  const { services, loading, error } = useHostServices();

  const toggle = (key) =>
    onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-border bg-card py-10">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (error || services.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No optional services are available right now — you can add them later from your workspace.
      </p>
    );
  }

  return (
    <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
      {services.map((a) => {
        const active = value.includes(a.key);
        return (
          <button
            key={a.key}
            type="button"
            role="checkbox"
            aria-checked={active}
            onClick={() => toggle(a.key)}
            className={`flex w-full items-start justify-between gap-3 rounded-xl border p-4 text-left transition ${
              active
                ? 'border-2 border-[#1677C8] bg-blue-50'
                : 'border-border bg-card hover:border-primary/50'
            }`}
          >
            <span>
              <span className="flex items-center gap-2">
                <span className="block font-semibold text-[#102A43]">{a.name}</span>
                {recommended.includes(a.key) && <RecommendedBadge />}
              </span>
              {a.description && <span className="mt-0.5 block text-sm text-muted-foreground">{a.description}</span>}
            </span>
            <span className="flex shrink-0 items-center gap-2 text-sm font-medium text-slate-700">
              A${a.price?.toLocaleString?.() ?? a.price}
              {a.price_note ? ` ${a.price_note}` : ''}
              {active && <Check className="h-4 w-4 text-[#1677C8]" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
```

### OnboardingChecklist.jsx

**File:** `src/components/host/OnboardingChecklist.jsx`

```jsx
/**
 * D8 — Host Experience Principles.
 * Rules applied: D8.3 (horizontal checklist, not blockers) — 5 numbered steps.
 * Three states: green tick = done, blue = current, grey = still to come.
 */
import { Check } from 'lucide-react';
import { HOST_JOURNEY_STEPS as STEPS } from '@/components/host/journeySteps';

export default function OnboardingChecklist({ currentStep = 1 }) {
  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Your journey to going live
      </p>
      <ol className="flex items-center gap-1 sm:gap-2">
        {STEPS.map((label, i) => {
          const stepNum = i + 1;
          const isDone = stepNum < currentStep;
          const isActive = stepNum === currentStep;
          const nextIsActive = stepNum + 1 === currentStep;
          return (
            <li key={label} className="flex flex-1 items-center gap-1 sm:gap-2">
              <div className="flex min-w-0 flex-col items-center gap-1.5 text-center">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    isDone
                      ? 'bg-success text-white'
                      : isActive
                      ? 'bg-primary text-white'
                      : 'border border-border bg-muted text-muted-foreground'
                  }`}
                  aria-hidden="true"
                >
                  {isDone ? <Check className="h-4 w-4" /> : stepNum}
                </span>
                <span
                  className={`text-[10px] sm:text-xs ${
                    isActive
                      ? 'font-bold text-foreground'
                      : isDone
                      ? 'font-semibold text-[#2E9B66]'
                      : 'font-semibold text-muted-foreground'
                  }`}
                >
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <span
                  className={`step-connector h-px flex-1 bg-border ${
                    isDone || nextIsActive ? 'is-filled' : ''
                  } ${isDone ? 'text-success' : 'text-primary'}`}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
```

### DraftSavedNote.jsx

**File:** `src/components/host/DraftSavedNote.jsx`

```jsx
/**
 * D8 — Host Experience Principles: calm reassurance that nothing is lost.
 */
import { Check } from 'lucide-react';

export default function DraftSavedNote({ savedAt }) {
  if (!savedAt) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <Check className="h-3.5 w-3.5 text-[#2E9B66]" aria-hidden="true" />
      Draft saved
    </span>
  );
}
```

### RecommendedBadge.jsx

**File:** `src/components/host/RecommendedBadge.jsx`

```jsx
/**
 * D8 — Host Experience Principles.
 * Rules applied: D8.7 (recommended defaults are clearly badged).
 */
export default function RecommendedBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
      Recommended for you
    </span>
  );
}
```

---

## Hooks

### useApplicationDraft.js

**File:** `src/components/host/apply/useApplicationDraft.js`

```javascript
/**
 * Server-side application draft: loads the host's active draft on mount and
 * autosaves answers (debounced, monotonic revision — an older save can never
 * overwrite a newer one).
 */
import { useEffect, useRef, useState } from 'react';
import { hostPortal } from '@/lib/hostPortalClient';

export default function useApplicationDraft(blankAnswers) {
  const [answers, setAnswers] = useState(blankAnswers);
  const [draftId, setDraftId] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const revRef = useRef(0);
  const draftIdRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    let active = true;
    hostPortal('get_application_draft')
      .then((data) => {
        if (!active) return;
        if (data.draft) {
          draftIdRef.current = data.draft.id;
          setDraftId(data.draft.id);
          revRef.current = data.draft.revision || 0;
          setAnswers((a) => ({ ...a, ...(data.draft.answers || {}) }));
        }
        setLoaded(true);
      })
      .catch(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        const next = revRef.current + 1;
        const data = await hostPortal('save_application_draft', {
          draft_id: draftIdRef.current, answers, revision: next,
        });
        revRef.current = data.revision || next;
        if (data.draft_id) {
          draftIdRef.current = data.draft_id;
          setDraftId(data.draft_id);
        }
        setSavedAt(Date.now());
      } catch { /* retried on the next change */ }
    }, 800);
    return () => clearTimeout(timerRef.current);
  }, [answers, loaded]);

  return { answers, setAnswers, draftId, loaded, savedAt };
}
```

### useHostOrganisation.js

**File:** `src/components/host/apply/useHostOrganisation.js`

```javascript
/**
 * Loads the signed-in host's organisation once, so the wizard knows whether it
 * still needs to ask for organisation details.
 */
import { useCallback, useEffect, useState } from 'react';
import { hostPortal } from '@/lib/hostPortalClient';

export default function useHostOrganisation() {
  const [organisation, setOrganisation] = useState(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const res = await hostPortal('get_organisation').catch(() => null);
    setOrganisation(res?.has_organisation ? res.organisation : null);
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return { organisation, loading, reload };
}
```

### usePackageOptions.js

**File:** `src/components/host/usePackageOptions.js`

```javascript
/**
 * D8 — Host Experience Principles.
 * Turns the configured hosting packages into wizard answer tiles so the
 * apply wizard shows the same package names as /host-a-challenge.
 */
import { User, Users, Award } from 'lucide-react';
import useHostPackages from '@/hooks/useHostPackages';

const ICONS = [User, Users, Award];

export default function usePackageOptions() {
  const { packages } = useHostPackages();

  return packages.map((pkg, i) => ({
    value: pkg.key,
    label: pkg.name,
    description: pkg.tagline || pkg.audience || '',
    icon: ICONS[i] || Users,
  }));
}
```

### useCategoryOptions.js

**File:** `src/components/host/useCategoryOptions.js`

```javascript
/**
 * Category answer options for the host wizard — always sourced from the live
 * category API (no hardcoded catalogue). Returns an empty list while loading,
 * de-duplicated by slug and ordered by the API's sort order.
 */
import { Palette } from 'lucide-react';
import { useCategories } from '@/hooks/useCategories';

export default function useCategoryOptions() {
  const { categories, loading } = useCategories();
  const seen = new Set();
  const options = (categories || [])
    .filter((c) => c.is_active !== false && c.slug)
    .filter((c) => (seen.has(c.slug) ? false : seen.add(c.slug)))
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((c) => ({
      value: c.slug,
      label: c.name,
      description: c.blurb || '',
      icon: Palette,
    }));
  return { options, loading };
}
```

### useHostPackages.js

**File:** `src/hooks/useHostPackages.js`

```javascript
/** Hosting packages from the hostPackages API, with the local copy as fallback. */
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { HOST_PACKAGES } from '@/lib/hostPackages';

export default function useHostPackages() {
  const { data, isLoading } = useQuery({
    queryKey: ['hostPackages'],
    queryFn: async () => {
      const res = await base44.functions.invoke('hostPackages', {});
      return res.data?.packages?.length ? res.data.packages : HOST_PACKAGES;
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  return { packages: data || HOST_PACKAGES, isLoading };
}
```

### useHostServices.js

**File:** `src/hooks/useHostServices.js`

```javascript
import { useEffect, useState } from 'react';
import { listHostServices } from '@/lib/hostServices';

export default function useHostServices() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    listHostServices()
      .then((rows) => { if (active) setServices(rows); })
      .catch((e) => { if (active) setError(e?.message || 'Could not load the optional services'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return { services, loading, error };
}
```

### useCategories.js

**File:** `src/hooks/useCategories.js`

```javascript
import { useEffect, useState } from 'react';
import { challengeApi } from '@/lib/challengeApi';
import { setCategories, getCategories } from '@/lib/challenges-data';

// Module-level cache + in-flight promise so every component using categories
// shares a single API call.
let cache = null;
let promise = null;

export function useCategories(includeInactive = false) {
  const [categories, setCategoriesState] = useState(cache || getCategories());
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    let mounted = true;
    if (!promise) {
      promise = challengeApi
        .listCategories(includeInactive)
        .then((cats) => {
          cache = setCategories(cats);
        })
        .catch(() => {
          cache = getCategories();
        });
    }
    promise.then(() => {
      if (!mounted) return;
      setCategoriesState([...cache]);
      setLoading(false);
    });
    return () => { mounted = false; };
  }, [includeInactive]);

  return { categories, loading };
}
```

---

## Shared Logic (backend)

### hostPricing.ts

**File:** `base44/shared/hostPricing.ts`

```typescript
// Shared pricing table for host applications (amounts in cents, AUD).
// Used by the hostPortal 'price_application' / 'start_application_payment' actions.

export const PACKAGE_FEES: Record<string, { amount: number; label: string }> = {
  self_service: { amount: 0, label: 'Self-service package' },
  supported: { amount: 14900, label: 'Supported package deposit' },
  fully_managed: { amount: 29900, label: 'Fully managed package deposit' },
};

export const ADDON_FEES: Record<string, { amount: number; name: string }> = {
  legal_review: { amount: 9900, name: 'Legal review' },
  social_campaign: { amount: 14900, name: 'Social campaign setup' },
  entry_moderation: { amount: 9900, name: 'Entry moderation' },
  judging_panel: { amount: 19900, name: 'Judging panel' },
  prize_handling: { amount: 7900, name: 'Prize handling' },
  winner_showcase: { amount: 5900, name: 'Winner showcase' },
};

export function priceApplication(answers: any = {}) {
  const pkgKey = PACKAGE_FEES[answers.delivery_level] ? answers.delivery_level : 'self_service';
  const pkg = PACKAGE_FEES[pkgKey];
  const addonKeys: string[] = Array.isArray(answers.addons) ? answers.addons : [];
  const addons = addonKeys
    .filter((k) => ADDON_FEES[k])
    .map((k) => ({ key: k, name: ADDON_FEES[k].name, amount: ADDON_FEES[k].amount }));
  const addons_total = addons.reduce((s, a) => s + a.amount, 0);
  const total_amount = pkg.amount + addons_total;
  return {
    currency: 'aud',
    package: { key: pkgKey, label: pkg.label, amount: pkg.amount },
    addons,
    addons_total,
    total_amount,
    payment_required: total_amount > 0,
  };
}

// Simple routing / risk scoring used when an application is submitted.
export function scoreApplication(answers: any = {}) {
  const divisions: string[] = Array.isArray(answers.divisions) ? answers.divisions : [];
  const minors = divisions.includes('children') || divisions.includes('teens');
  const large = answers.participant_range === '1000_plus';
  let risk_level = 'low';
  let route_queue = 'standard';
  if (minors) { risk_level = 'high'; route_queue = 'compliance'; }
  else if (large) { risk_level = 'medium'; route_queue = 'senior'; }
  else if (answers.delivery_level === 'fully_managed') { risk_level = 'medium'; route_queue = 'coordinator'; }
  return { risk_level, route_queue };
}
```

### customSession.ts

**File:** `base44/shared/customSession.ts`

```typescript
// Signed session tokens for the app's custom (Challenge-API) login.
//
// The custom login authenticates against the upstream Challenge API, so those
// users have no Base44 platform session. To still derive identity SERVER-SIDE
// (never from a client-supplied email), the login proxy mints an HMAC-signed
// token here and backend functions verify it.
//
// The signing key is derived from the server-only CHALLENGE_API_KEY secret, so
// a token cannot be forged by a browser.

const TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

function b64urlEncode(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str: string) {
  const pad = str.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(pad + "=".repeat((4 - (pad.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(apiKey: string) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`c53-custom-session:${apiKey}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

async function sign(payloadB64: string, apiKey: string) {
  const key = await hmacKey(apiKey);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));
  return b64urlEncode(new Uint8Array(sig));
}

/** Mint a signed session token for a Challenge-API user. */
export async function signCustomSession(
  user: { id?: string; email: string; full_name?: string },
  apiKey: string
) {
  const payload = {
    email: String(user.email || "").toLowerCase().trim(),
    name: user.full_name || "",
    uid: user.id || "",
    exp: Math.floor(Date.now() / 1000) + TTL_SECONDS,
  };
  const payloadB64 = b64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  return `${payloadB64}.${await sign(payloadB64, apiKey)}`;
}

/** Verify a token. Returns the payload, or null when invalid/expired. */
export async function verifyCustomSession(token: string, apiKey: string) {
  if (!token || !apiKey) return null;
  const [payloadB64, sig] = String(token).split(".");
  if (!payloadB64 || !sig) return null;
  const expected = await sign(payloadB64, apiKey);
  if (expected.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(payloadB64)));
    if (!payload?.email) return null;
    if (!payload.exp || payload.exp * 1000 < Date.now()) return null;
    return payload as { email: string; name: string; uid: string; exp: number };
  } catch {
    return null;
  }
}
```

### hostRequestPush.ts

**File:** `base44/shared/hostRequestPush.ts`

```typescript
// A submitted host application (/host-apply) becomes a host request in two
// places: a PartnerInquiry record in this app (what admins review in the
// dashboard) and a request on the main domain's request API.
//
// Both are built from ONE mapping, so the admin dashboard and the main app can
// never show different details for the same application.
const HOST_PORTAL_API =
  'https://base44.app/api/apps/69341410f89d26a8fc73a4d1/functions/hostPortal';

/** ChallengeDraft-style application → PartnerInquiry fields. */
export function toPartnerInquiry(p: any) {
  const a = p.answers || {};
  const email = String(a.host_email || a.contact_email || '').toLowerCase();
  const audience = [a.discovery_age, a.discovery_setting].filter(Boolean).join(' · ');
  return {
    company_name: a.organisation_name || a.org_name || a.contact_name || 'Host',
    company_website: a.beneficiary_website || '',
    industry: a.org_kind || '',
    contact_name: a.contact_name || a.name || '',
    contact_email: email,
    contact_phone: a.contact_phone || a.phone || '',
    challenge_title: p.challenge_title || 'Untitled challenge',
    challenge_type: p.category || '',
    challenge_goal: a.primary_objective || '',
    challenge_description: p.challenge_description || p.challenge_title || '',
    audience_description: audience || a.beneficiary_name || 'To be confirmed',
    audience_size: p.participant_range || p.scale_band || '',
    geographic_scope: a.org_state || '',
    launch_timing: p.program_scope || '',
    start_date: a.start_date || '',
    end_date: a.end_date || '',
    prize_format: a.prize_pool || '',
    how_heard: a.template_name ? `Template: ${a.template_name}` : 'Host application wizard',
    additional_notes: [
      `Source: host application wizard (/host-apply)`,
      `Package: ${p.delivery_level || ''}`,
      `Organised for: ${a.beneficiary_for === 'other' ? a.beneficiary_name || 'someone else' : 'their own organisation'}`,
      `Divisions: ${(p.divisions || []).join(', ')}`,
      `Add-ons: ${(p.addons || []).join(', ')}`,
      a.beneficiary_notes ? `Notes: ${a.beneficiary_notes}` : '',
    ].filter(Boolean).join('\n'),
  };
}

/**
 * Sends the application to the parent's hostPortal as a guest_apply.
 * THROWS on any failure.
 */
export async function pushHostRequest(p: any): Promise<string> {
  const a = p.answers || {};
  const email = String(a.host_email || a.contact_email || '').toLowerCase().trim();
  const contactName = String(a.contact_name || a.name || '').trim();
  const phone = String(a.contact_phone || a.phone || '').trim();
  const orgName = String(
    a.organisation_name || a.org_name || a.contact_name || a.beneficiary_name || 'Individual host'
  ).trim();
  const savedQuoteId = String(a.saved_quote_id || '').trim();

  const payload: Record<string, unknown> = {
    action: 'guest_apply',
    email,
    contact_name: contactName,
    phone,
    organisation_name: orgName,
    answers: a,
  };
  if (savedQuoteId) payload.saved_quote_id = savedQuoteId;

  let res: Response;
  try {
    res = await fetch(HOST_PORTAL_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    throw new Error(`Could not reach the main 53 Challenges app: ${e.message}`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `The main app rejected this application (${res.status}).`);
  }
  const id = String(data?.proposal_id || data?.request_id || data?.id || '');
  if (!id) throw new Error(data?.error || 'The main app did not confirm this application.');
  return id;
}
```

### hostOrganisation.ts

**File:** `base44/shared/hostOrganisation.ts`

```typescript
// Host Organisations API — the single source of truth for a host's
// organisation. Nothing about an organisation is stored in this app's own
// database: every read goes to this external API.
const BASE = 'https://base44.app/api/apps/69341410f89d26a8fc73a4d1/functions/hostOrganisationApi';

const key = () => Deno.env.get('CHALLENGE_API_KEY') || '';

async function call(body: Record<string, unknown>) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key() },
    body: JSON.stringify(body),
  });
  return await res.json().catch(() => ({}));
}

/** Look an organisation up by owner/member email, app user id, or org id. */
export async function getOrganisation(idents: { email?: string; user_id?: string; id?: string }) {
  const body: Record<string, unknown> = { action: 'organisation' };
  if (idents.email) body.email = String(idents.email).toLowerCase();
  else if (idents.user_id) body.user_id = idents.user_id;
  else if (idents.id) body.id = idents.id;
  else return { found: false, organisation: null, membership: null };

  const res = await call(body).catch(() => ({}));
  return {
    found: !!res?.found && !!res?.organisation,
    organisation: res?.organisation || null,
    membership: res?.membership || null,
    is_owner: !!res?.is_owner,
  };
}

/** Everyone attached to an organisation. */
export async function getOrganisationMembers(organisationId: string) {
  const res = await call({ action: 'members', organisation_id: organisationId }).catch(() => ({}));
  return Array.isArray(res?.members) ? res.members : [];
}
```

### challengeApiHelper.ts

**File:** `base44/shared/challengeApiHelper.ts`

```typescript
const DEFAULT_BASE = "https://base44.app/api/apps/69341410f89d26a8fc73a4d1/functions/publicChallengeApi";
const GET_ACTIONS = new Set(["challenges", "entries", "votes"]);
const GET_PARAMS = ["status", "stage", "season", "id", "limit", "challenge_id", "sort", "user_email", "featured", "phase", "category", "division", "state", "page", "offset", "include_inactive"];

const DEFAULT_ADMIN_BASE = "https://base44.app/api/apps/69341410f89d26a8fc73a4d1/functions/adminChallengeApi";

export function adminBaseUrl(publicBase, adminOverride) {
  if (adminOverride) return adminOverride;
  if (!publicBase) return DEFAULT_ADMIN_BASE;
  return publicBase.replace(/\/[^/]*$/, "/adminChallengeApi");
}

export async function fetchAdminChallengeApi(action, params, apiKey, baseUrl) {
  if (!apiKey) throw new Error("CHALLENGE_API_KEY secret not set");
  const res = await fetch(baseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify({ action, params: params || {} }),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return {
      ok: false,
      error: { code: "bad_response", message: `Parent returned non-JSON (HTTP ${res.status}): ${text.slice(0, 300)}` },
      status: res.status,
    };
  }
  return { ...json, status: res.status };
}

export async function fetchChallengeApi(action, params, apiKey, baseUrl) {
  if (!apiKey) throw new Error("CHALLENGE_API_KEY secret not set");
  const BASE = baseUrl || DEFAULT_BASE;

  if (GET_ACTIONS.has(action)) {
    const urlParams = new URLSearchParams({ action });
    for (const k of GET_PARAMS) {
      if (params[k] !== undefined && params[k] !== null && params[k] !== "") {
        urlParams.set(k, String(params[k]));
      }
    }
    const res = await fetch(`${BASE}?${urlParams.toString()}`, {
      headers: { "x-api-key": apiKey },
    });
    return res.json();
  } else {
    const res = await fetch(BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({ action, ...params }),
    });
    return res.json();
  }
}
```

---

## Shared Logic (frontend)

### hostWizardDefaults.js

**File:** `src/lib/hostWizardDefaults.js`

```javascript
export const DELIVERY_LEVELS = [
  { key: 'self_service', label: 'Self-service', description: 'You set everything up yourself with our step-by-step guide.' },
  { key: 'supported', label: 'Supported', description: 'You lead the way and our team helps with the tricky parts.' },
  { key: 'fully_managed', label: 'Fully managed', description: 'Our team runs the whole challenge for you from start to finish.' },
];

export const PARTICIPANT_RANGES = [
  { key: 'up_to_50', label: 'Up to 50', count: 50 },
  { key: '50_250', label: '50 – 250', count: 250 },
  { key: '250_1000', label: '250 – 1,000', count: 1000 },
  { key: '1000_plus', label: 'More than 1,000', count: 2000 },
];

export function participantCount(rangeKey) {
  return PARTICIPANT_RANGES.find((r) => r.key === rangeKey)?.count || 0;
}

export function getWizardDefaults(hostType, deliveryLevel, count = 0) {
  const category = hostType === 'business' ? 'digital-creativity' : hostType === 'school_community' ? 'visual-arts' : 'photography';
  const winnerMethod = count > 250 ? 'combination' : deliveryLevel === 'fully_managed' ? 'judges' : 'public';
  const divisions = hostType === 'school_community' ? ['children', 'teens'] : ['adults'];
  const programScope = deliveryLevel === 'fully_managed' ? 'series' : 'single';
  const addons = ['legal_review'];
  if (deliveryLevel === 'supported' || deliveryLevel === 'fully_managed' || count > 1000) addons.push('entry_moderation');
  if (deliveryLevel === 'fully_managed') addons.push('social_campaign', 'judging_panel');
  return { delivery_level: 'supported', category, winner_method: winnerMethod, divisions, participant_range: '50_250', program_scope: programScope, addons: [...new Set(addons)] };
}

export function toStructuredAnswers(answers = {}) {
  const winnerMap = {
    public: { voting_purpose: 'determines_winner', weight_in_final_result: 100 },
    judges: { voting_purpose: 'audience_award_only', weight_in_final_result: 0 },
    combination: { voting_purpose: 'weighted_component', weight_in_final_result: 30 },
  };
  return {
    voting_configuration: winnerMap[answers.winner_method] || winnerMap.public,
    challenge: { category: answers.category || '', divisions: answers.divisions || [] },
    challenge_draft: { program_scope: answers.program_scope || 'single', scale_band: answers.participant_range || '' },
  };
}
```

### appSession.js / customSession.js

**File:** `src/lib/appSession.js`

```javascript
export { getSessionToken, setSessionToken, clearSessionToken } from '@/lib/customSession';
```

**File:** `src/lib/customSession.js`

```javascript
const KEY = 'challengeApi_session_token';

export function setSessionToken(token) {
  try { if (token) localStorage.setItem(KEY, token); } catch { }
}

export function getSessionToken() {
  try { return localStorage.getItem(KEY) || ''; } catch { return ''; }
}

export function clearSessionToken() {
  try { localStorage.removeItem(KEY); } catch { }
}
```

### functionErrors.js

**File:** `src/lib/functionErrors.js`

```javascript
export function functionErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  return (
    err?.response?.data?.error ||
    err?.data?.error ||
    (err?.message && !/status code/i.test(err.message) ? err.message : '') ||
    fallback
  );
}

export function isSessionExpired(err) {
  const status = err?.status || err?.response?.status || err?.data?.status;
  return status === 401 || /status code 401/i.test(String(err?.message || ''));
}
```

### emailVerification.js

**File:** `src/lib/emailVerification.js`

```javascript
import { base44 } from '@/api/base44Client';

const call = async (payload) => {
  const res = await base44.functions.invoke('emailVerification', payload)
    .catch((err) => ({ data: { error: err?.response?.data?.error || 'Something went wrong. Please try again.' } }));
  return res?.data || {};
};

export const sendEmailCode = (email, purpose) => call({ action: 'send', email, purpose });
export const verifyEmailCode = (email, purpose, code) => call({ action: 'verify', email, purpose, code });
```

### hostDeposit.js

**File:** `src/lib/hostDeposit.js`

```javascript
export const HOST_DEPOSITS = {
  supported: { amount: 149, label: 'Supported package' },
  fully_managed: { amount: 299, label: 'Fully managed package' },
};

export const requiresDeposit = (deliveryLevel) => Boolean(HOST_DEPOSITS[deliveryLevel]);
export const getDeposit = (deliveryLevel) => HOST_DEPOSITS[deliveryLevel] || null;
export const formatAud = (amount) => `A$${Number(amount).toLocaleString('en-AU')}`;
```

### hostFees.js

**File:** `src/lib/hostFees.js`

```javascript
export const PLATFORM_INTEGRITY_FEE = {
  key: 'platform_integrity_fee',
  label: 'Platform integrity fee',
  amount: 4900,
  explainer: "A small fee that confirms your intent and protects the platform's quality.",
};
```

### journeySteps.js

**File:** `src/components/host/journeySteps.js`

```javascript
export const HOST_JOURNEY_STEPS = ['Apply', 'Review', 'Agreement', 'Approval', 'Go Live'];
export default HOST_JOURNEY_STEPS;
```

### applySteps.js

**File:** `src/components/host/applySteps.js`

```javascript
import {
  User, Building2, GraduationCap, Palette, Camera, PenLine, Mic,
  Sparkles, Users, Award, Blend, Smile, Rocket, Repeat, CalendarDays, Heart,
  Sprout, Mountain,
} from 'lucide-react';
import { DELIVERY_LEVELS, PARTICIPANT_RANGES } from '@/lib/hostWizardDefaults';

export const HOST_TYPE_OPTIONS = [
  { value: 'individual', label: 'Just me', description: "I'm an individual creator or community member.", icon: User },
  { value: 'business', label: 'A business or brand', description: 'We want to run a challenge for our customers or community.', icon: Building2 },
  { value: 'school_community', label: 'A school or community group', description: 'For our students, members or local community.', icon: GraduationCap },
];

export const DELIVERY_OPTIONS = DELIVERY_LEVELS.map((l, i) => ({ value: l.key, label: l.label, description: l.description, icon: [User, Users, Award][i] }));

export const CATEGORY_OPTIONS = [
  { value: 'art-craft-making', label: 'Art, Craft & Making', description: 'Painting, drawing, craft and hands-on making.', icon: Palette },
  { value: 'food-farming-community', label: 'Food, Farming & Community', description: 'Cooking, growing food and community projects.', icon: Sprout },
  { value: 'music-dance-performance', label: 'Music, Dance & Performance', description: 'Music, dance, song and spoken word.', icon: Mic },
  { value: 'outdoor-adventure', label: 'Outdoor & Adventure', description: 'Getting outside, sport and exploring.', icon: Mountain },
  { value: 'photography-film-digital', label: 'Photography, Film & Digital', description: 'Photos, video, film and digital art.', icon: Camera },
  { value: 'writing-ideas-innovation', label: 'Writing, Ideas & Innovation', description: 'Stories, poems, ideas and bright thinking.', icon: PenLine },
];

export const WINNER_OPTIONS = [
  { value: 'public', label: 'The public votes', description: 'Everyone can vote for their favourite entries.', icon: Users },
  { value: 'judges', label: 'A panel of judges decides', description: 'Qualified judges score every entry.', icon: Award },
  { value: 'combination', label: 'A combination of both', description: 'Judges score entries, and public votes count too.', icon: Blend },
];

export const DIVISION_OPTIONS = [
  { value: 'children', label: 'Kids (under 13)', icon: Smile },
  { value: 'teens', label: 'Teens (13–17)', icon: Sparkles },
  { value: 'adults', label: 'Adults (18+)', icon: User },
  { value: 'seniors', label: 'Seniors (65+)', icon: Heart },
];

export const SERIES_COUNT_OPTIONS = [
  { value: '3', label: '3 challenges', description: 'A short run to test the format.', icon: Repeat },
  { value: '6', label: '6 challenges', description: 'A solid season of activity.', icon: Repeat },
  { value: '12', label: '12 challenges', description: 'A full year of challenges.', icon: CalendarDays },
];

export const SERIES_CADENCE_OPTIONS = [
  { value: 'monthly', label: 'One a month', description: 'A steady monthly rhythm.', icon: CalendarDays },
  { value: 'quarterly', label: 'One a quarter', description: 'Four moments across the year.', icon: CalendarDays },
  { value: 'yearly', label: 'One a year', description: 'A single annual highlight.', icon: CalendarDays },
];

export const PARTICIPANT_OPTIONS = PARTICIPANT_RANGES.map((r) => ({ value: r.key, label: r.label, icon: Users }));

export const SCOPE_OPTIONS = [
  { value: 'single', label: 'A one-off challenge', description: 'One challenge, one set of winners.', icon: Rocket },
  { value: 'series', label: 'A series of challenges', description: 'A few challenges running back to back.', icon: Repeat },
  { value: 'annual_program', label: 'An ongoing yearly program', description: 'A recurring program that runs every year.', icon: CalendarDays },
];
```

---

## Entity Schemas

### HostApplicationDraft

```jsonc
{
  "name": "HostApplicationDraft",
  "type": "object",
  "properties": {
    "owner_email": { "type": "string", "default": "" },
    "owner_id": { "type": "string", "default": "" },
    "answers": { "type": "object", "default": {} },
    "revision": { "type": "number", "default": 0 },
    "status": { "type": "string", "enum": ["active", "submitted", "discarded"], "default": "active" },
    "pricing_snapshot": { "type": "object", "default": {} },
    "proposal_id": { "type": "string", "default": "" }
  },
  "required": []
}
```

### HostInvoice

```jsonc
{
  "name": "HostInvoice",
  "type": "object",
  "properties": {
    "owner_email": { "type": "string", "default": "" },
    "organisation_id": { "type": "string", "default": "" },
    "draft_id": { "type": "string", "default": "" },
    "proposal_id": { "type": "string", "default": "" },
    "purpose": { "type": "string", "enum": ["application", "deposit", "balance"], "default": "application" },
    "label": { "type": "string", "default": "" },
    "amount": { "type": "number", "default": 0 },
    "currency": { "type": "string", "default": "aud" },
    "line_items": { "type": "array", "items": { "type": "object", "properties": { "name": { "type": "string" }, "amount": { "type": "number" } } }, "default": [] },
    "status": { "type": "string", "enum": ["pending", "paid", "void"], "default": "pending" },
    "stripe_payment_intent_id": { "type": "string", "default": "" },
    "paid_at": { "type": "string", "format": "date-time" }
  },
  "required": []
}
```

### ChallengeDraft (key fields)

```jsonc
{
  "name": "ChallengeDraft",
  "type": "object",
  "properties": {
    "origin": { "type": "string", "enum": ["admin_created", "corporate_intake", "host_apply"], "default": "admin_created" },
    "content_type": { "type": "string", "enum": ["host_managed", "admin_managed"], "default": "admin_managed" },
    "host_organisation_id": { "type": "string", "default": "" },
    "review_status": { "type": "string", "enum": ["intake_received", "in_review", "builder_started", "submitted_for_review", "changes_requested", "terms_pending", "approved", "approved_and_signed", "rejected", "live"], "default": "intake_received" },
    "challenge_id": { "type": "string", "default": "" },
    "challenge_title": { "type": "string", "default": "" },
    "challenge_description": { "type": "string", "default": "" },
    "host_type": { "type": "string", "default": "" },
    "delivery_level": { "type": "string", "default": "" },
    "participant_range": { "type": "string", "default": "" },
    "category": { "type": "string", "default": "" },
    "winner_method": { "type": "string", "default": "" },
    "divisions": { "type": "array", "items": { "type": "string" }, "default": [] },
    "addons": { "type": "array", "items": { "type": "string" }, "default": [] },
    "answers": { "type": "object", "default": {} },
    "scale_band": { "type": "string", "default": "" },
    "program_scope": { "type": "string", "enum": ["single", "series", "annual_program"], "default": "single" },
    "template_id": { "type": "string", "default": "" }
  },
  "required": ["origin"]
}
```

### PartnerInquiry (key fields)

```jsonc
{
  "name": "PartnerInquiry",
  "type": "object",
  "properties": {
    "owner_email": { "type": "string", "default": "" },
    "parent_request_id": { "type": "string", "default": "" },
    "company_name": { "type": "string" },
    "contact_name": { "type": "string" },
    "contact_email": { "type": "string" },
    "challenge_title": { "type": "string", "default": "" },
    "challenge_description": { "type": "string", "default": "" },
    "status": { "type": "string", "enum": ["new", "planning", "contacted", "in-progress", "approved", "completed", "rejected"], "default": "new" }
  },
  "required": ["company_name", "contact_name", "contact_email", "challenge_title", "challenge_description", "audience_description"]
}
```

### HostNotification

```jsonc
{
  "name": "HostNotification",
  "type": "object",
  "properties": {
    "recipient_email": { "type": "string", "default": "" },
    "title": { "type": "string", "default": "" },
    "body": { "type": "string", "default": "" },
    "proposal_id": { "type": "string", "default": "" },
    "read": { "type": "boolean", "default": false }
  },
  "required": []
}
```

---

## Required Secrets

| Secret | Used For |
|--------|----------|
| `STRIPE_SECRET_KEY` | Creating and verifying Stripe PaymentIntents |
| `STRIPE_PUBLISHABLE_KEY` | Returned to the browser to load Stripe Elements |
| `CHALLENGE_API_KEY` | Signing/verifying custom session tokens; calling the parent Challenge API |
| `CHALLENGE_API_BASE_URL` | Base URL for the parent's publicChallengeApi (optional — has a default) |
| `GOOGLE_CLIENT_ID` | Google OAuth sign-in |

---

## CSS — host-light theme

Add this to `src/index.css`:

```css
@layer components {
  .host-light {
    --background: 80 12% 97%;
    --foreground: 209 61% 16%;
    --card: 0 0% 100%;
    --card-foreground: 209 61% 16%;
    --popover: 0 0% 100%;
    --popover-foreground: 209 61% 16%;
    --secondary: 220 14% 96%;
    --secondary-foreground: 209 61% 16%;
    --muted: 220 14% 96%;
    --muted-foreground: 220 9% 46%;
    --border: 214 20% 88%;
    --input: 214 20% 88%;
    color-scheme: light;
    @apply bg-background text-foreground;
  }
  .host-light .c53-input { @apply bg-white; }
  .c53-input {
    @apply w-full rounded-xl border border-input bg-white/5 px-4 py-2.5 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--ring];
  }
  .c53-input option, select option { @apply bg-white text-black; }
}
```

---

## Route Registration

In `src/App.jsx`:

```jsx
import HostApplication from './pages/host/HostApplication';
// ...inside <Routes>:
<Route path="/host-apply" element={<HostApplication />} />
```

---

## NPM Dependencies

- `@stripe/react-stripe-js` — Stripe Elements payment form
- `@stripe/stripe-js` — Stripe.js loader
- `@tanstack/react-query` — host packages query
- `lucide-react` — icons
- `react-router-dom` — Link, useLocation

---

*End of Part 4 — complete reference.*