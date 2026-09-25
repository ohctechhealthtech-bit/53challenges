import { useState } from 'react';
import { Sparkles, Search, Loader2 } from 'lucide-react';
import { aiFindPartners } from '@/lib/marketing';
import ProspectCard from './ProspectCard';

const KINDS = ['sponsor', 'school', 'club', 'workplace', 'council', 'venue', 'government'];

export default function SponsorFinder() {
  const [brief, setBrief] = useState('');
  const [kind, setKind] = useState('sponsor');
  const [location, setLocation] = useState('Australia');
  const [count, setCount] = useState(6);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [prospects, setProspects] = useState(null);

  const search = async () => {
    if (!brief.trim()) { setError('Describe the kind of sponsor you want to find.'); return; }
    setLoading(true); setError(''); setProspects(null);
    try {
      const r = await aiFindPartners({ brief, partner_kind: kind, location, count });
      setProspects(r.prospects || []);
    } catch (e) {
      setError(e?.response?.data?.error || 'Search failed — please try again.');
    }
    setLoading(false);
  };

  return (
    <div>
      <h2 className="font-heading text-xl font-extrabold">Find new sponsors</h2>
      <p className="mt-1 text-sm text-muted-foreground">Describe the sponsor you want. We research live prospects on the web, draft a tailored invitation, and let you push them into outreach.</p>

      <div className="mt-5 rounded-2xl border border-border bg-card p-5">
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">What are you looking for?</label>
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          rows={3}
          placeholder="e.g. camera retailers and photography studios that support youth creative programs"
          className="c53-input mt-2"
        />
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Sponsor type</label>
            <select value={kind} onChange={(e) => setKind(e.target.value)} className="c53-input mt-2">
              {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Location</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} className="c53-input mt-2" />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">How many</label>
            <select value={count} onChange={(e) => setCount(Number(e.target.value))} className="c53-input mt-2">
              {[4, 6, 8, 10].map((n) => <option key={n} value={n}>{n} prospects</option>)}
            </select>
          </div>
        </div>
        <button onClick={search} disabled={loading} className="mt-5 inline-flex items-center gap-2 rounded-xl grad-bg px-5 py-3 text-sm font-bold text-white disabled:opacity-60">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {loading ? 'Researching sponsors…' : 'Find sponsors'}
        </button>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      </div>

      {loading && <p className="mt-6 text-sm text-muted-foreground">Searching the web for matching organisations — this takes a few moments.</p>}

      {prospects && prospects.length === 0 && (
        <p className="mt-6 text-sm text-muted-foreground">No matches found. Try a broader brief or a wider location.</p>
      )}

      {prospects && prospects.length > 0 && (
        <div className="mt-6 space-y-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"><Search className="h-4 w-4" /> {prospects.length} prospects found</p>
          {prospects.map((pr, i) => <ProspectCard key={i} prospect={pr} partnerKind={kind} />)}
        </div>
      )}
    </div>
  );
}