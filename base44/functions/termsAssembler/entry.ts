import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assembleFacts, logAudit } from "../../shared/complianceAssessmentEngine.ts";
import {
  assembleTerms, isClauseSigned, isClauseExpired,
} from "../../shared/termsAssembler.ts";

// Terms Assembler (Prompt 19) — backend function.
//
//   action: 'list_clauses'     → all ApprovedClauses                    (any authed)
//   action: 'create_clause'    → { identifier, title, body, category, ... } (admin)
//   action: 'sign_clause'      → { clause_id, reviewer, date, reference } (admin)
//   action: 'assemble'         → { challenge_id, facts_override? }      (admin)
//   action: 'list_documents'   → { challenge_id }                       (any authed)
//   action: 'get_document'     → { document_id }                       (any authed)
//   action: 'publish_document' → { document_id }                        (admin)
//   action: 'review_document'  → { document_id }                        (admin)

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const sr = base44.asServiceRole;
    const isAdmin = user.role === "admin" || user.is_admin === true;

    // ── list_clauses (any authed) ─────────────────────────────────────
    if (action === "list_clauses") {
      const clauses = await sr.entities.ApprovedClause.filter(
        { is_current: true }, "-created_date", 500
      ).catch(() => []);
      const annotated = (clauses || []).map((c) => ({
        ...c,
        signed: isClauseSigned(c),
        expired: isClauseExpired(c),
      }));
      return Response.json({ clauses: annotated });
    }

    // ── create_clause (admin) ─────────────────────────────────────────
    if (action === "create_clause") {
      if (!isAdmin) return Response.json({ error: "Admin only" }, { status: 403 });
      const { identifier, title, body: clauseBody, category } = body;
      if (!identifier || !title || !clauseBody || !category) {
        return Response.json({ error: "identifier, title, body, category required" }, { status: 400 });
      }
      // Check for duplicate identifier
      const dup = await sr.entities.ApprovedClause.filter(
        { identifier: String(identifier), is_current: true }, "-created_date", 1
      );
      if (dup && dup.length) {
        return Response.json({ error: "Clause identifier already exists" }, { status: 409 });
      }

      const clause = await sr.entities.ApprovedClause.create({
        identifier: String(identifier),
        title: String(title),
        body: String(clauseBody),
        category: String(category),
        applicable_jurisdictions: body.applicable_jurisdictions || [],
        inclusion_rule: body.inclusion_rule || {},
        required_combinations: body.required_combinations || [],
        prohibited_combinations: body.prohibited_combinations || [],
        mandatory: body.mandatory !== false,
        effective_from: body.effective_from || new Date().toISOString(),
        retirement_date: body.retirement_date || "",
        version: 1,
        required_variables: body.required_variables || [],
        modification_requires_reapproval: body.modification_requires_reapproval !== false,
        legal_signoff: {},
        is_current: true,
      });

      await logAudit(sr, {
        event_type: "rule_version_created",
        actor_id: user.id,
        actor_email: user.email,
        detail: `ApprovedClause '${identifier}' created (unsigned draft). Category: ${category}.`,
      });

      return Response.json({ clause });
    }

    // ── sign_clause (admin) ───────────────────────────────────────────
    if (action === "sign_clause") {
      if (!isAdmin) return Response.json({ error: "Admin only" }, { status: 403 });
      const clause_id = String(body.clause_id || "");
      const reviewer = String(body.reviewer || "").trim();
      const date = String(body.date || "").trim();
      const reference = String(body.reference || "").trim();
      if (!clause_id) return Response.json({ error: "clause_id required" }, { status: 400 });
      if (!reviewer || !date || !reference) {
        return Response.json({ error: "reviewer, date, reference all required" }, { status: 400 });
      }

      await sr.entities.ApprovedClause.update(clause_id, {
        legal_signoff: { reviewer, date, reference },
      });

      await logAudit(sr, {
        event_type: "rule_signed",
        actor_id: user.id,
        actor_email: user.email,
        detail: `ApprovedClause ${clause_id} signed by ${reviewer} (ref: ${reference}).`,
      });

      return Response.json({ ok: true, clause_id, signed: true });
    }

    // ── assemble (admin) ──────────────────────────────────────────────
    if (action === "assemble") {
      if (!isAdmin) return Response.json({ error: "Admin only" }, { status: 403 });
      const challenge_id = String(body.challenge_id || "");
      if (!challenge_id) return Response.json({ error: "challenge_id required" }, { status: 400 });

      // Assemble facts from existing records
      let factsOverride = {};
      if (body.facts_override && typeof body.facts_override === "object") {
        factsOverride = body.facts_override;
      }
      const facts = await assembleFacts(sr, challenge_id, factsOverride);

      const result = await assembleTerms(sr, challenge_id, facts, { id: user.id, email: user.email });

      if (result.errors?.length) {
        return Response.json({ errors: result.errors, warnings: result.warnings || [] }, { status: 422 });
      }

      return Response.json({ result });
    }

    // ── list_documents (any authed) ───────────────────────────────────
    if (action === "list_documents") {
      const challenge_id = String(body.challenge_id || "");
      if (!challenge_id) return Response.json({ error: "challenge_id required" }, { status: 400 });
      const docs = await sr.entities.TermsDocument.filter(
        { challenge_id }, "-created_date", 50
      ).catch(() => []);
      return Response.json({ documents: docs || [] });
    }

    // ── get_document (any authed) ─────────────────────────────────────
    if (action === "get_document") {
      const document_id = String(body.document_id || "");
      if (!document_id) return Response.json({ error: "document_id required" }, { status: 400 });
      const docs = await sr.entities.TermsDocument.filter(
        { id: document_id }, "-created_date", 1
      ).catch(() => []);
      if (!docs?.length) return Response.json({ error: "Document not found" }, { status: 404 });
      return Response.json({ document: docs[0] });
    }

    // ── review_document (admin) ───────────────────────────────────────
    if (action === "review_document") {
      if (!isAdmin) return Response.json({ error: "Admin only" }, { status: 403 });
      const document_id = String(body.document_id || "");
      if (!document_id) return Response.json({ error: "document_id required" }, { status: 400 });

      const docs = await sr.entities.TermsDocument.filter(
        { id: document_id }, "-created_date", 1
      ).catch(() => []);
      const doc = docs?.[0];
      if (!doc) return Response.json({ error: "Document not found" }, { status: 404 });
      if (doc.status !== "draft") {
        return Response.json({ error: `Document must be in draft status to review (current: ${doc.status})` }, { status: 409 });
      }

      await sr.entities.TermsDocument.update(document_id, { status: "reviewed" });

      await logAudit(sr, {
        event_type: "assessment_run",
        challenge_id: doc.challenge_id,
        actor_id: user.id,
        actor_email: user.email,
        detail: `TermsDocument ${document_id} marked as reviewed.`,
      });

      return Response.json({ ok: true, document_id, status: "reviewed" });
    }

    // ── publish_document (admin) ─────────────────────────────────────
    if (action === "publish_document") {
      if (!isAdmin) return Response.json({ error: "Admin only" }, { status: 403 });
      const document_id = String(body.document_id || "");
      if (!document_id) return Response.json({ error: "document_id required" }, { status: 400 });

      const docs = await sr.entities.TermsDocument.filter(
        { id: document_id }, "-created_date", 1
      ).catch(() => []);
      const doc = docs?.[0];
      if (!doc) return Response.json({ error: "Document not found" }, { status: 404 });

      // Rule 4: Published documents are immutable; can only publish draft/reviewed
      if (doc.status === "published") {
        return Response.json({ error: "Document is already published (immutable)" }, { status: 409 });
      }
      if (doc.status === "superseded") {
        return Response.json({ error: "Cannot publish a superseded document" }, { status: 409 });
      }
      if (!["draft", "reviewed"].includes(doc.status)) {
        return Response.json({ error: `Cannot publish document in status '${doc.status}'` }, { status: 409 });
      }

      // Supersede any previously published document for this challenge
      const prevPublished = await sr.entities.TermsDocument.filter(
        { challenge_id: doc.challenge_id, status: "published" },
        "-created_date", 10
      ).catch(() => []);
      for (const prev of prevPublished || []) {
        if (prev.id !== document_id) {
          await sr.entities.TermsDocument.update(prev.id, {
            status: "superseded",
            superseded_by: document_id,
            change_note: `Superseded by new publication (document ${document_id}).`,
          });
        }
      }

      await sr.entities.TermsDocument.update(document_id, {
        status: "published",
        published_at: new Date().toISOString(),
      });

      await logAudit(sr, {
        event_type: "assessment_run",
        challenge_id: doc.challenge_id,
        actor_id: user.id,
        actor_email: user.email,
        detail: `TermsDocument ${document_id} published. ${prevPublished?.length || 0} prior document(s) superseded.`,
      });

      return Response.json({ ok: true, document_id, status: "published" });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}