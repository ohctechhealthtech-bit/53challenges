/**
 * Graphical end-to-end workflow of the host marketplace, for the Portal Manual.
 * Vertical on mobile, horizontal flow on desktop.
 */
import { FileText, CreditCard, Search, FileSignature, CheckCircle2, Rocket, ArrowRight } from 'lucide-react';

const STAGES = [
  {
    n: 1,
    icon: FileText,
    title: 'Apply',
    who: 'Host',
    detail: '10-question guided wizard — package, concept, entries, audience, winner method, add-ons.',
    tone: 'primary',
  },
  {
    n: 2,
    icon: CreditCard,
    title: 'Deposit',
    who: 'Host',
    detail: 'A$149 Supported / A$299 Fully managed, paid by card in-page. Self-service skips this.',
    tone: 'primary',
  },
  {
    n: 3,
    icon: Search,
    title: 'Review',
    who: 'Admin',
    detail: 'Proposal enters the Host Proposal Queue. Admin approves, requests changes, or declines.',
    tone: 'blue',
  },
  {
    n: 4,
    icon: FileSignature,
    title: 'Agreement',
    who: 'Both',
    detail: 'Terms assembled and signed. Host sees "Agreement ready — please review and sign".',
    tone: 'amber',
  },
  {
    n: 5,
    icon: CheckCircle2,
    title: 'Approval',
    who: 'Admin',
    detail: 'Approval creates the real Challenge record in draft and enters the compliance gates.',
    tone: 'emerald',
  },
  {
    n: 6,
    icon: Rocket,
    title: 'Go live',
    who: 'Platform',
    detail: 'Lifecycle gates open entries → voting → judging → audited results.',
    tone: 'emerald',
  },
];

const TONES = {
  primary: 'border-primary/40 bg-primary/10 text-primary',
  blue: 'border-blue-500/40 bg-blue-500/10 text-blue-300',
  amber: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  emerald: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
};

export default function HostWorkflowDiagram() {
  return (
    <div>
      <div className="grid gap-3 lg:grid-cols-6">
        {STAGES.map((s, i) => (
          <div key={s.n} className="relative">
            <div className={`h-full rounded-2xl border bg-card p-4 ${TONES[s.tone].split(' ')[0]}`}>
              <div className="flex items-center gap-2">
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl border ${TONES[s.tone]}`}>
                  <s.icon className="h-4 w-4" />
                </span>
                <span className="font-heading text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Step {s.n}
                </span>
              </div>
              <p className="mt-3 font-heading text-sm font-bold text-foreground">{s.title}</p>
              <span className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${TONES[s.tone]}`}>
                {s.who}
              </span>
              <p className="mt-2 text-xs text-muted-foreground">{s.detail}</p>
            </div>
            {i < STAGES.length - 1 && (
              <ArrowRight
                className="absolute -right-3 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-muted-foreground/50 lg:block"
                aria-hidden="true"
              />
            )}
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        A "changes requested" outcome sends the proposal back to Step 1 for editing, and a host edit automatically
        resubmits it for review. A declined proposal stops at Step 3 with a written reason.
      </p>
    </div>
  );
}