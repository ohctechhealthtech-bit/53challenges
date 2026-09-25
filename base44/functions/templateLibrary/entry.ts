import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  blankTemplate,
  validateTemplate,
  rankTemplates,
  mergeApprovedBrand,
  defaultLockMap,
} from '../../shared/templateLibrary.ts';
import { templatesApiGet, toWizardTemplate } from '../../shared/ideaTemplates.ts';

const TEMPLATE_FIELDS = [
  'template_name', 'primary_category_id', 'subcategory_id', 'service_tier', 'template_tags',
  'concept_pack', 'rules_pack', 'brand_pack', 'lock_map', 'template_recommendation_config',
];

function audit(record, action, user, extra = {}) {
  const log = Array.isArray(record.template_audit_log) ? record.template_audit_log.slice(-49) : [];
  log.push({
    action,
    actor: user?.email || user?.id || 'unknown',
    at: new Date().toISOString(),
    template_id: record.id || '',
    template_family_id: record.template_family_id || '',
    template_version: record.template_version || 1,
    ...extra,
  });
  return log;
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    // ---- Host-facing: the ready-to-run challenges hosts can start from.
    // Served by the external Challenge Idea Templates API (the master), never
    // from this app's database. Public — visitors browse the catalogue before
    // they sign in. ----
    if (action === 'recommend') {
      const res = await templatesApiGet({ action: 'templates', status: 'active' }).catch(() => ({}));
      const list = Array.isArray(res?.templates) ? res.templates.map(toWizardTemplate) : [];
      list.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      return Response.json({
        templates: list.slice(0, Number(body.limit) || 5).map((t, i) => ({ ...t, is_best_match: i === 0 })),
      });
    }

    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const svc = base44.asServiceRole.entities.ChallengeDraft;
    const isAdmin = user.role === 'admin';
    const adminOnly = () => Response.json({ error: 'Admin access required' }, { status: 403 });

    // ---- Host-facing: select a template → frozen snapshot on a new proposal ----
    if (action === 'selectTemplate') {
      const one = await templatesApiGet({ action: 'template', id: body.template_id }).catch(() => ({}));
      const t = one?.template ? toWizardTemplate(one.template) : null;
      if (!t) return Response.json({ error: 'Template is not available' }, { status: 404 });
      const snapshot = {
        template_id: t.id,
        template_name: t.template_name,
        template_status_at_selection: t.status,
        service_tier: 'standard',
        concept_pack: {
          package_name: t.template_name,
          challenge_description: t.summary,
          entry_type: t.entry_type,
          recommended_duration_weeks: t.recommended_duration_weeks,
          category: t.category,
          image_url: t.image_url,
        },
        rules_pack: {
          age_groups: t.age_groups,
          rules_expectations: t.rules_expectations,
          winner_selection_method: t.winner_selection_method,
          entry_limit_per_participant: t.entry_limit_per_participant,
        },
        brand_pack: {},
        lock_map: defaultLockMap(),
        snapshot_created_at: new Date().toISOString(),
      };
      const proposal = await base44.entities.ChallengeDraft.create({
        origin: 'host_apply',
        is_template: false,
        review_status: 'builder_started',
        challenge_title: t.template_name,
        challenge_description: t.summary || '',
        category: t.category || '',
        template_id: t.id,
        template_version_snapshot: snapshot,
        template_snapshot_created_at: snapshot.snapshot_created_at,
        host_brand_overrides: {},
      });
      // Only the host-facing summary goes back to the browser — the frozen
      // rules / operations / legal packs stay server-side.
      return Response.json({
        proposal: {
          id: proposal.id,
          challenge_title: proposal.challenge_title,
          challenge_description: proposal.challenge_description,
          category: proposal.category,
          review_status: proposal.review_status,
          template_version_snapshot: {
            template_name: snapshot.template_name,
            service_tier: snapshot.service_tier,
            brand_pack: snapshot.brand_pack,
            lock_map: snapshot.lock_map,
          },
          host_brand_overrides: {},
        },
      });
    }

    if (!isAdmin) return adminOnly();

    // ---- Admin: list templates ----
    if (action === 'list') {
      let list = await svc.filter({ is_template: true }, '-updated_date', 500);
      const { search, status, category, service_tier, sort } = body;
      if (search) {
        const q = String(search).toLowerCase();
        list = list.filter((t) => String(t.template_name || '').toLowerCase().includes(q));
      }
      if (status) list = list.filter((t) => t.template_status === status);
      if (category) list = list.filter((t) => t.primary_category_id === category);
      if (service_tier) list = list.filter((t) => t.service_tier === service_tier);
      if (sort === 'name') list.sort((a, b) => String(a.template_name).localeCompare(String(b.template_name)));
      if (sort === 'version') list.sort((a, b) => (b.template_version || 0) - (a.template_version || 0));
      return Response.json({ templates: list });
    }

    if (action === 'versions') {
      const list = await svc.filter({ is_template: true, template_family_id: body.template_family_id }, 'template_version', 100);
      return Response.json({ versions: list });
    }

    if (action === 'create') {
      const draft = blankTemplate();
      const created = await svc.create(draft);
      await svc.update(created.id, { template_audit_log: audit(created, 'template_created', user) });
      return Response.json({ template: { ...created } });
    }

    // ---- Admin: bulk import records as DRAFT templates (never published) ----
    if (action === 'importDrafts') {
      const rows = Array.isArray(body.records) ? body.records : [];
      if (!rows.length) return Response.json({ error: 'No records supplied' }, { status: 400 });
      const pick = (r: any, ...keys: string[]) => {
        for (const k of keys) if (r[k] !== undefined && r[k] !== null && r[k] !== '') return r[k];
        return undefined;
      };
      const created: any[] = [];
      const skipped: any[] = [];
      for (const r of rows) {
        const code = pick(r, 'templatecode', 'template_code', 'template_name');
        const familyId = pick(r, 'templatefamilyid', 'template_family_id') || code;
        const version = Number(pick(r, 'templateversion', 'template_version')) || 1;
        if (!code || !familyId) { skipped.push({ record: r, reason: 'Missing template code or family id' }); continue; }

        const existing = await svc.filter({ is_template: true, template_family_id: String(familyId), template_version: version });
        if (existing.length) { skipped.push({ template_code: code, reason: 'This version already exists' }); continue; }

        const base = blankTemplate();
        const rec = await svc.create({
          ...base,
          origin: 'admin_created',
          is_template: true,
          template_status: 'draft',
          template_name: String(code),
          template_family_id: String(familyId),
          template_version: version,
          concept_pack: pick(r, 'conceptpack', 'concept_pack') || base.concept_pack || {},
          rules_pack: pick(r, 'rulespack', 'rules_pack') || base.rules_pack || {},
          brand_pack: pick(r, 'brandpack', 'brand_pack') || base.brand_pack || {},
          lock_map: Object.keys(base.lock_map || {}).length ? base.lock_map : defaultLockMap(),
        });
        await svc.update(rec.id, { template_audit_log: audit(rec, 'draft_imported', user, { template_code: code }) });
        created.push({ id: rec.id, template_name: rec.template_name, template_version: rec.template_version });
      }
      return Response.json({ imported: created.length, created, skipped });
    }

    if (action === 'save') {
      const current = await svc.get(body.id);
      if (!current?.is_template) return Response.json({ error: 'Not a template record' }, { status: 400 });
      if (current.template_status !== 'draft') {
        return Response.json({ error: 'Only draft templates can be edited. Create a new version instead.' }, { status: 409 });
      }
      const patch = {};
      for (const f of TEMPLATE_FIELDS) if (body.patch?.[f] !== undefined) patch[f] = body.patch[f];
      patch.template_audit_log = audit(current, 'draft_edited', user);
      const updated = await svc.update(body.id, patch);
      return Response.json({ template: updated });
    }

    if (action === 'validate') {
      const current = await svc.get(body.id);
      return Response.json({ errors: validateTemplate(current) });
    }

    if (action === 'publish') {
      const current = await svc.get(body.id);
      if (!current?.is_template) return Response.json({ error: 'Not a template record' }, { status: 400 });
      if (current.template_status !== 'draft') return Response.json({ error: 'Only draft templates can be published.' }, { status: 409 });
      const errors = validateTemplate(current);
      if (errors.length) return Response.json({ errors }, { status: 400 });

      const family = await svc.filter({ is_template: true, template_family_id: current.template_family_id });
      const previousActive = family.filter((t) => t.template_status === 'active' && t.id !== current.id);
      if (family.some((t) => t.template_status === 'active' && (t.template_version || 0) > (current.template_version || 0))) {
        return Response.json({ error: 'A newer version of this template is already active.' }, { status: 409 });
      }

      const now = new Date().toISOString();
      const published = await svc.update(current.id, {
        template_status: 'active',
        published_at: now,
        published_by: user.email || user.id,
        template_audit_log: audit(current, 'template_published', user, { old_status: 'draft', new_status: 'active' }),
      });
      for (const old of previousActive) {
        await svc.update(old.id, {
          template_status: 'superseded',
          superseded_by_id: current.id,
          superseded_at: now,
          superseded_by_user: user.email || user.id,
          template_audit_log: audit(old, 'version_superseded', user, { old_status: 'active', new_status: 'superseded', superseded_by_version: current.template_version }),
        });
      }
      const verify = await svc.filter({ is_template: true, template_family_id: current.template_family_id, template_status: 'active' });
      if (verify.length !== 1) {
        return Response.json({ template: published, repair_warning: `Expected exactly one active version, found ${verify.length}. Review this template family.` });
      }
      return Response.json({ template: published });
    }

    if (action === 'newVersion') {
      const current = await svc.get(body.id);
      if (!current?.is_template) return Response.json({ error: 'Not a template record' }, { status: 400 });
      const family = await svc.filter({ is_template: true, template_family_id: current.template_family_id });
      if (family.some((t) => t.template_status === 'draft')) {
        return Response.json({ error: 'A draft version of this template already exists.' }, { status: 409 });
      }
      const nextVersion = Math.max(...family.map((t) => Number(t.template_version) || 1)) + 1;
      const clone = await svc.create({
        origin: 'admin_created',
        is_template: true,
        template_name: current.template_name,
        template_family_id: current.template_family_id,
        template_version: nextVersion,
        template_status: 'draft',
        previous_version_id: current.id,
        primary_category_id: current.primary_category_id,
        subcategory_id: current.subcategory_id,
        service_tier: current.service_tier,
        template_tags: current.template_tags || [],
        concept_pack: current.concept_pack || {},
        rules_pack: current.rules_pack || {},
        brand_pack: current.brand_pack || {},
        participation_pack: current.participation_pack || {},
        operations_pack: current.operations_pack || {},
        legal_pack: current.legal_pack || {},
        lock_map: Object.keys(current.lock_map || {}).length ? current.lock_map : defaultLockMap(),
        template_recommendation_config: current.template_recommendation_config || {},
      });
      await svc.update(clone.id, { template_audit_log: audit(clone, 'new_version_created', user, { from_version: current.template_version }) });
      return Response.json({ template: clone });
    }

    if (action === 'archive') {
      if (!body.reason) return Response.json({ error: 'An archive reason is required.' }, { status: 400 });
      const current = await svc.get(body.id);
      const updated = await svc.update(body.id, {
        template_status: 'archived',
        archived_at: new Date().toISOString(),
        archived_by: user.email || user.id,
        archive_reason: body.reason,
        template_audit_log: audit(current, 'template_archived', user, { old_status: current.template_status, new_status: 'archived', reason: body.reason }),
      });
      return Response.json({ template: updated });
    }

    // ---- Admin: review + lock/approve a template-based proposal ----
    if (action === 'approveProposal') {
      const proposal = await svc.get(body.proposal_id);
      if (!proposal) return Response.json({ error: 'Proposal not found' }, { status: 404 });
      if (proposal.approval_locked) return Response.json({ error: 'This proposal is already locked and approved.' }, { status: 409 });
      const snap = proposal.template_version_snapshot || {};
      const approvedBrand = mergeApprovedBrand(
        snap.brand_pack,
        proposal.host_brand_overrides,
        body.admin_brand_adjustments || proposal.admin_brand_adjustments,
        snap.lock_map,
      );
      const updated = await svc.update(proposal.id, {
        admin_brand_adjustments: body.admin_brand_adjustments || proposal.admin_brand_adjustments || {},
        approved_brand_pack: approvedBrand,
        approved_by: user.email || user.id,
        approved_at: new Date().toISOString(),
        approval_locked: true,
        review_status: 'approved',
      });
      return Response.json({ proposal: updated });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}