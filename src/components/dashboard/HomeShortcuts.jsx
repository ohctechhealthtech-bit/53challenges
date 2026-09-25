import { Link } from 'react-router-dom';
import { Gavel, Crown, ArrowRight } from 'lucide-react';

const BLUE = '#2e5bff';
const GOLD = '#f59e0b';

/** Judge + Winnings shortcuts on the Home tab. Judge only shows for judges. */
export default function HomeShortcuts({ judge }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {judge && (
        <ShortcutCard
          icon={Gavel}
          color={BLUE}
          title="Judge"
          body="You're on a judging panel. Score your allocated entries in the judge portal."
          to="/judge-portal"
          cta="Open judge portal"
        />
      )}
      <ShortcutCard
        icon={Crown}
        color={GOLD}
        title="Winnings"
        body="See the winners gallery and how your own entries placed."
        to="/hall-of-fame"
        cta="View winners"
        secondary={{ to: '/my-entries', label: 'My results' }}
      />
    </div>
  );
}

function ShortcutCard({ icon: Icon, color, title, body, to, cta, secondary }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
        <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ backgroundColor: `${color}1a`, color }}>
          <Icon className="h-4 w-4" />
        </span>
        {title}
      </h2>
      <p className="mt-2 text-sm text-slate-500">{body}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          to={to}
          className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold text-white"
          style={{ backgroundColor: color }}
        >
          {cta} <ArrowRight className="h-4 w-4" />
        </Link>
        {secondary && (
          <Link
            to={secondary.to}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
          >
            {secondary.label}
          </Link>
        )}
      </div>
    </section>
  );
}