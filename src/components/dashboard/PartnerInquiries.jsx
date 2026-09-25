import { useEffect, useState } from 'react';
import { Loader2, Phone, Building2, Globe, Target, Users, MapPin, Calendar, DollarSign, Award, Megaphone, Sparkles } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const STATUS_STYLES = {
  new: 'bg-blue-500/15 text-blue-300',
  contacted: 'bg-amber-500/15 text-amber-300',
  'in-progress': 'bg-purple-500/15 text-purple-300',
  completed: 'bg-emerald-500/15 text-emerald-300',
  rejected: 'bg-rose-500/15 text-rose-300',
};

function Meta({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div>
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-sm text-foreground">{value}</p>
      </div>
    </div>
  );
}

export default function PartnerInquiries() {
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const rows = await base44.entities.PartnerInquiry.list('-created_date', 100);
        setInquiries(rows || []);
      } catch (err) {
        setError(err?.message || 'Could not load inquiries.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!inquiries.length) return <p className="text-sm text-muted-foreground">No partnership inquiries yet.</p>;

  return (
    <div className="space-y-4">
      {inquiries.map((inq) => (
        <div key={inq.id} className="rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-accent" />
                <h3 className="font-heading text-lg font-bold">{inq.company_name}</h3>
                {inq.industry && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{inq.industry}</span>}
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">{inq.contact_name} · {inq.contact_email}</p>
              {inq.contact_phone && <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><Phone className="h-3.5 w-3.5" /> {inq.contact_phone}</p>}
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[inq.status] || STATUS_STYLES.new}`}>{inq.status}</span>
          </div>

          <div className="mt-4 rounded-xl bg-background/50 p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Challenge</p>
            <p className="font-semibold text-foreground">{inq.challenge_title || '—'}</p>
            {inq.challenge_description && <p className="mt-1 text-sm text-foreground/90">{inq.challenge_description}</p>}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Meta icon={Sparkles} label="Challenge type" value={inq.challenge_type} />
            <Meta icon={Target} label="Goal" value={inq.challenge_goal} />
            <Meta icon={Users} label="Audience" value={inq.audience_description} />
            <Meta icon={Users} label="Audience size" value={inq.audience_size} />
            <Meta icon={MapPin} label="Scope" value={inq.geographic_scope} />
            <Meta icon={Calendar} label="Launch timing" value={inq.launch_timing} />
            <Meta icon={DollarSign} label="Budget" value={inq.estimated_budget} />
            <Meta icon={Award} label="Prize format" value={inq.prize_format} />
            <Meta icon={Globe} label="Website" value={inq.company_website} />
            <Meta icon={Megaphone} label="How heard" value={inq.how_heard} />
          </div>

          {inq.additional_notes && (
            <div className="mt-3 rounded-xl bg-background/50 p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Notes</p>
              <p className="text-sm text-foreground/90">{inq.additional_notes}</p>
            </div>
          )}

          <p className="mt-3 text-xs text-muted-foreground">Received {new Date(inq.created_date).toLocaleDateString('en-AU')}</p>
        </div>
      ))}
    </div>
  );
}