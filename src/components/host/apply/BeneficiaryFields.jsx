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