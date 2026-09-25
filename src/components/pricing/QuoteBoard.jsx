import React from 'react';
import { fmt } from '@/lib/pricingEngine';

const SECTIONS = ['per_challenge', 'program', 'prize', 'summary'];
const SECTION_LABELS = {
  per_challenge: 'Per challenge',
  program: 'Program',
  prize: 'Prize administration',
  summary: 'Summary',
};

export default function QuoteBoard({ quote, onSave, saving, savedId, onProceed }) {
  if (quote.isEnterprise) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-heading text-lg font-bold">Quoted by proposal</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          National-scale campaigns are quoted individually through our enterprise pipeline — there is no self-submission path at this scale.
        </p>
        <p className="mt-4 text-3xl font-extrabold grad-text">From {fmt(quote.total)}</p>
        <p className="mt-1 text-xs text-muted-foreground">Indicative starting point — final pricing confirmed by proposal.</p>
        <button
          type="button"
          onClick={onProceed}
          className="mt-4 w-full rounded-xl grad-bg px-4 py-2.5 text-sm font-semibold text-white"
        >
          Proceed to enterprise intake
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="font-heading text-lg font-bold">Your indicative quote</h3>
      <div className="mt-4 space-y-4">
        {SECTIONS.map((sec) => {
          const secLines = quote.lines.filter((l) => l.section === sec);
          if (!secLines.length) return null;
          return (
            <div key={sec}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{SECTION_LABELS[sec]}</p>
              <div className="mt-1 space-y-1">
                {secLines.map((l) => (
                  <div
                    key={l.key}
                    className={`flex justify-between gap-3 text-sm ${l.isTotal ? 'border-t border-border pt-2 font-bold text-base' : ''}`}
                  >
                    <div className="min-w-0">
                      <span>{l.label}</span>
                      {l.note && <span className="block text-xs text-muted-foreground">{l.note}</span>}
                    </div>
                    <span className={`whitespace-nowrap ${l.amount < 0 ? 'text-emerald-400' : ''}`}>{fmt(l.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">Indicative only — final pricing confirmed at intake.</p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save quote'}
        </button>
        <button
          type="button"
          onClick={onProceed}
          className="flex-1 rounded-xl grad-bg px-4 py-2.5 text-sm font-semibold text-white"
        >
          Proceed to intake
        </button>
      </div>
      {savedId && <p className="mt-2 text-xs text-emerald-400">Quote saved (…{savedId.slice(-6)})</p>}
    </div>
  );
}