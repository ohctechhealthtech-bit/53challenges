import { shortDate, titleCase } from './sponsorsMeta';

const Field = ({ label, value }) => (
  value ? (
    <p><span className="text-muted-foreground">{label}:</span> <span className="font-medium">{value}</span></p>
  ) : null
);

// Everything the applicant told us, as returned by the main site.
export default function EnquiryDetails({ a = {} }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <Field label="Organisation type" value={a.organisation_type} />
        <Field label="Website" value={a.website} />
        <Field label="Phone" value={a.phone || a.contact_phone} />
        <Field label="Reach" value={a.geographic_scope} />
        <Field label="Audience" value={a.audience} />
        <Field label="Audience size" value={a.audience_size} />
        <Field label="Budget" value={a.estimated_budget} />
        <Field label="Timing" value={a.launch_timing} />
        <Field label="Suggested tier" value={a.suggested_tier ? titleCase(a.suggested_tier) : ''} />
        <Field label="Received" value={shortDate(a.submitted_at || a.created_date)} />
      </div>

      {(a.challenge_title || a.challenge_description) && (
        <div className="rounded-xl border border-border bg-card/40 p-4 text-sm">
          {a.challenge_title && <p className="font-semibold">{a.challenge_title}</p>}
          {a.challenge_description && <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{a.challenge_description}</p>}
        </div>
      )}

      {a.decision_reason && (
        <p className="text-sm text-muted-foreground">Decision note: {a.decision_reason}</p>
      )}
    </div>
  );
}