/**
 * Surfaces every detail the host entered on their application so admins
 * can see exactly what the client decided and wants — not just the short
 * description. Read-only; rendered inside ProposalReviewCard's accordion.
 */
import React from 'react';

const humanize = (v) =>
  String(v || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

const fmtDate = (v) => (v ? String(v).slice(0, 10) : '—');
const fmtMoney = (v) => (v != null && v !== '' ? `$${Number(v).toLocaleString()}` : '—');

function Row({ label, value }) {
  if (value == null || value === '' || (Array.isArray(value) && !value.length)) return null;
  const display = Array.isArray(value) ? value.map(humanize).join(', ') : String(value);
  return (
    <div className="flex flex-col gap-0.5 py-1.5 border-b border-stone-100 last:border-0 sm:flex-row sm:gap-3 sm:py-1.5">
      <dt className="w-44 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-stone-400">{label}</dt>
      <dd className="text-sm text-stone-700 sm:flex-1">{display}</dd>
    </div>
  );
}

function Group({ title, children }) {
  return (
    <section className="rounded-xl border border-stone-200 bg-stone-50/60 p-3">
      <p className="mb-1 text-xs font-bold uppercase tracking-wider text-stone-500">{title}</p>
      <dl>{children}</dl>
    </section>
  );
}

export default function ProposalDetailsPanel({ proposal: p, org }) {
  if (!p) return null;

  const beneficiaryContact = [
    p.beneficiary_contact_name,
    p.beneficiary_contact_role,
    p.beneficiary_contact_email,
    p.beneficiary_phone,
    p.beneficiary_website,
  ].filter(Boolean).join(' · ');

  return (
    <div className="space-y-2.5">
      <Group title="Who it's for">
        <Row label="Host type" value={humanize(p.host_type)} />
        <Row label="Content managed by" value={p.content_type === 'host_managed' ? 'Host' : p.content_type === 'admin_managed' ? '53 Challenges admin' : humanize(p.content_type)} />
        <Row label="Organised for" value={p.beneficiary_for === 'my_org' ? 'Their own organisation' : humanize(p.beneficiary_for)} />
        <Row label="Beneficiary" value={p.beneficiary_name} />
        <Row label="About the beneficiary" value={p.beneficiary_notes} />
        <Row label="Beneficiary contact" value={beneficiaryContact} />
      </Group>

      <Group title="The challenge">
        <Row label="Theme" value={p.theme} />
        <Row label="Category" value={humanize(p.category)} />
        <Row label="Title" value={p.title} />
        <Row label="Description" value={p.description} />
        <Row label="Accepted entries" value={p.accepted_entry_types} />
        <Row label="Age divisions" value={p.age_divisions} />
        <Row label="State" value={p.state} />
        <Row label="Season" value={p.season} />
      </Group>

      <Group title="Schedule">
        <Row label="Start date" value={fmtDate(p.start_date)} />
        <Row label="End date" value={fmtDate(p.end_date)} />
        <Row label="Voting closes" value={fmtDate(p.voting_end_date)} />
      </Group>

      <Group title="Prizes & entries">
        <Row label="Entry fee" value={fmtMoney(p.entry_fee)} />
        <Row label="Prize budget" value={fmtMoney(p.prize_budget)} />
        <Row label="Expected entries" value={p.expected_entries} />
      </Group>

      <Group title="Package & add-ons">
        <Row label="Service package" value={humanize(p.service_package)} />
        <Row label="Program scope" value={humanize(p.program_scope)} />
        {p.program_scope !== 'single' && p.program_scope !== 'one_off' && (
          <>
            <Row label="Series count" value={p.series_count} />
            <Row label="Series cadence" value={humanize(p.series_cadence)} />
          </>
        )}
        <Row label="Started from template" value={humanize(p.template_key)} />
        <Row label="Add-ons" value={p.addon_keys} />
      </Group>

      <Group title="Pricing">
        <Row label="Base price" value={fmtMoney(p.base_price)} />
        <Row label="Add-ons price" value={fmtMoney(p.addons_price)} />
        <Row label="Total quote" value={fmtMoney(p.total_price)} />
        <Row label="Amount paid" value={fmtMoney(p.amount_paid)} />
        <Row label="Payment status" value={humanize(p.payment_status)} />
        <Row label="Invoice" value={p.application_invoice_id} />
      </Group>

      {p.cover_image ? (
        <div className="rounded-xl border border-stone-200 p-3">
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-stone-500">Cover image</p>
          <img src={p.cover_image} alt="Challenge cover" className="max-h-40 rounded-lg border border-stone-200 object-cover" />
        </div>
      ) : null}

      {p.quotation_text ? (
        <div className="rounded-xl border border-stone-200 bg-white p-3">
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-stone-500">Quotation / agreement</p>
          <p className="whitespace-pre-wrap text-sm text-stone-700">{p.quotation_text}</p>
        </div>
      ) : null}
    </div>
  );
}