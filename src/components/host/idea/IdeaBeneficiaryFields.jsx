/**
 * Step 2 add-on — when the host is running the challenge for a business,
 * school or community group, we ask which organisation it's for.
 */
export default function IdeaBeneficiaryFields({ data, set }) {
  return (
    <div className="mt-6 space-y-5 border-t border-border pt-6">
      <div>
        <label htmlFor="beneficiary_name" className="mb-1 block text-sm font-semibold">
          Which organisation or group is this challenge for?{' '}
          <span className="font-bold text-destructive">(required)</span>
        </label>
        <p className="mb-2 text-xs text-muted-foreground">
          The brand, school, club or community this challenge is being run for. It can be
          different from your own organisation.
        </p>
        <input
          id="beneficiary_name"
          className="c53-input"
          value={data.beneficiary_name}
          onChange={(e) => set('beneficiary_name', e.target.value)}
          placeholder="Riverside Primary School"
        />
      </div>

      <div>
        <label htmlFor="beneficiary_notes" className="mb-1 block text-sm font-semibold">
          Anything we should know about them?{' '}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <p className="mb-2 text-xs text-muted-foreground">
          A sentence about who they are and why you're running this for them.
        </p>
        <textarea
          id="beneficiary_notes"
          rows={3}
          className="c53-input"
          value={data.beneficiary_notes}
          onChange={(e) => set('beneficiary_notes', e.target.value)}
          placeholder="Term-long art program for years 3–6."
        />
      </div>
    </div>
  );
}