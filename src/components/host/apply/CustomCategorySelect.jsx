/**
 * Category picker shown alongside the custom challenge fields, so hosts can
 * change the category without stepping back through the wizard.
 */
import { CATEGORY_OPTIONS } from '@/components/host/applySteps';

export default function CustomCategorySelect({ value, onChange }) {
  const options = CATEGORY_OPTIONS;

  return (
    <div>
      <label htmlFor="custom-category" className="mb-1 block text-sm font-semibold">
        Challenge category <span className="text-primary">(required)</span>
      </label>
      <p className="mb-2 text-sm text-muted-foreground">
        Which area does your challenge belong to?
      </p>
      <select
        id="custom-category"
        className="c53-input"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Choose a category…</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}