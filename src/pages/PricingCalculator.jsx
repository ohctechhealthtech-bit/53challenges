import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { pricingCalculator } from '@/lib/pricingCalculator';
import { computeQuote } from '@/lib/pricingEngine';
import CalculatorInputs from '@/components/pricing/CalculatorInputs';
import TierScopePanel from '@/components/pricing/TierScopePanel';
import QuoteBoard from '@/components/pricing/QuoteBoard';

const FINE_PRINT = [
  'Quotes are indicative only and subject to confirmation at intake.',
  'Scale uplift applies to service fees only; prize administration is exempt.',
  'Permit assistance is automatically added when public voting or hybrid winner-decision is selected.',
  'National-scale campaigns are quoted by proposal through the enterprise pipeline — no self-submission path.',
  'Program discounts apply to series (3 challenges) and annual programs (6 challenges).',
  'All prices are in AUD. GST is calculated on the subtotal.',
  'The rate card version is recorded with each saved quote; saved quotes reflect the figures at the time of saving.',
];

export default function PricingCalculator() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [inputs, setInputs] = useState({
    service_tier_id: '',
    program_scope: 'single',
    scale_band_id: '',
    category_id: '',
    participants: 100,
    duration_weeks: 4,
    winner_mode: 'expert_panel',
    prize_pool: 0,
    addons: [],
  });
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await pricingCalculator.getActiveRateCard();
        setData(res);
        const firstTier = (res.service_tiers || [])[0];
        const firstBand = (res.scale_bands || [])[0];
        setInputs((s) => ({ ...s, service_tier_id: firstTier?.id || '', scale_band_id: firstBand?.id || '' }));
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const rateCard = data?.rate_card;
  const tiers = data?.service_tiers || [];
  const bands = data?.scale_bands || [];
  const deliverables = data?.deliverables || [];
  const categories = data?.categories || [];

  const tier = tiers.find((t) => t.id === inputs.service_tier_id);
  const band = bands.find((b) => b.id === inputs.scale_band_id);

  const quote = useMemo(() => {
    if (!rateCard) return { lines: [], subtotal: 0, gst: 0, total: 0, isEnterprise: false, needsPermit: false };
    return computeQuote(rateCard, bands, tiers, inputs);
  }, [rateCard, bands, tiers, inputs]);

  const buildConfig = () => ({
    ...inputs,
    tier_name: tier?.name || '',
    scale_band_name: band?.name || '',
    category_name: categories.find((c) => c.id === inputs.category_id)?.name || '',
    category_slug: categories.find((c) => c.id === inputs.category_id)?.slug || '',
  });

  const doSave = async () => {
    setSaving(true);
    try {
      const res = await pricingCalculator.saveQuote({
        rate_card_id: rateCard.id,
        configuration: buildConfig(),
        computed_lines: quote.lines,
        subtotal: quote.subtotal,
        gst: quote.gst,
        total: quote.total,
        is_enterprise: quote.isEnterprise,
      });
      setSavedId(res.saved_quote.id);
      return res.saved_quote.id;
    } catch (e) {
      alert(e.message || 'Failed to save quote');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => { doSave(); };

  const handleProceed = async () => {
    if (quote.isEnterprise) {
      navigate('/corporate-intake');
      return;
    }
    const id = savedId || (await doSave());
    if (id) navigate(`/host-apply?quote_id=${id}`);
  };

  if (loading) {
    return (
      <div className="container-tight flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!rateCard) {
    return (
      <div className="container-tight py-12">
        <h1 className="font-heading text-2xl font-bold">Pricing Calculator</h1>
        <p className="mt-2 text-sm text-muted-foreground">No active rate card is configured yet. Please check back soon.</p>
      </div>
    );
  }

  return (
    <div className="container-tight py-10">
      <header className="mb-8">
        <h1 className="font-heading text-3xl font-extrabold sm:text-4xl">
          Pricing <span className="grad-text">Calculator</span>
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Build an indicative quote for your challenge program. Adjust the inputs to see live pricing — when you're ready, save your quote and proceed to intake.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-heading text-lg font-semibold">Configure your challenge</h2>
            <div className="mt-4">
              <CalculatorInputs tiers={tiers} bands={bands} categories={categories} inputs={inputs} onChange={setInputs} />
            </div>
          </div>
          <TierScopePanel tier={tier} deliverables={deliverables} />
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <QuoteBoard quote={quote} onSave={handleSave} saving={saving} savedId={savedId} onProceed={handleProceed} />
          {quote.needsPermit && !quote.isEnterprise && (
            <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
              Permit assistance has been added because public voting or hybrid winner-decision is selected.
            </p>
          )}
        </div>
      </div>

      <section className="mt-10 rounded-xl border border-border bg-card p-5">
        <h2 className="font-heading text-sm font-semibold uppercase tracking-wide text-muted-foreground">Fine print</h2>
        <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
          {FINE_PRINT.map((line) => (
            <li key={line} className="flex gap-2">
              <span className="text-primary">•</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}