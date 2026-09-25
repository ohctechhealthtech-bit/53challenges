import { Link } from 'react-router-dom';
import { ArrowRight, Calculator, Building2, ChevronRight } from 'lucide-react';

const GOLD = '#f59e0b';

/** Create / Host sub-tab: request to run your own branded challenge. */
export default function CreateHostPanel({ hostInquiries }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <span className="grid h-10 w-10 place-items-center rounded-xl" style={{ backgroundColor: `${GOLD}1a`, color: GOLD }}>
          <Building2 className="h-5 w-5" />
        </span>
        <h3 className="mt-3 text-lg font-bold text-slate-900">Run your own branded challenge</h3>
        <p className="mt-1 text-sm text-slate-500">
          Tell us your goal, audience and budget. We'll come back with a challenge design, timeline and a quote.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            to="/host-a-challenge"
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold text-white"
            style={{ backgroundColor: GOLD }}
          >
            Start a proposal <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/pricing-calculator"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
          >
            <Calculator className="h-4 w-4" /> Estimate your cost
          </Link>
        </div>
      </div>

      {hostInquiries.length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-slate-900">Your proposals</h4>
          <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {hostInquiries.map((h) => (
              <Link
                key={h.id}
                to="/host-a-challenge"
                className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 transition hover:bg-slate-50 last:border-0"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">{h.challenge_title || h.company_name || 'Challenge proposal'}</p>
                  <p className="mt-0.5 text-xs capitalize text-slate-500">
                    {(h.pipeline_status || h.status || 'in review').replace(/_/g, ' ')}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}