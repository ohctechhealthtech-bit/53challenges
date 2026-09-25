// Guardian Verification & Parental Consent — shared helper.
//
// A minor's entry is gated by guardian_approval_status on the Entry:
//   pending  → not votable, awaiting the guardian's decision via guardianPortal
//   approved → gate open (approval_timestamp recorded)
//   declined → gate closed (decline_reason recorded)
//   revoked  → gate closed, consent withdrawn
// Guardian identity is always the authenticated account email — never a
// client-supplied value.

export function normEmail(v) {
  return String(v || "").trim().toLowerCase();
}

// Find-or-create a Guardian record keyed by email, refreshing contact details.
export async function upsertGuardian(sr, details) {
  const email = normEmail(details.email);
  if (!email) throw new Error("Guardian email required");
  const existing = await sr.entities.Guardian.filter({ email }, "-created_date", 1).catch(() => []);
  const patch = {
    name: details.name || existing?.[0]?.name || "",
    relationship: details.relationship ?? existing?.[0]?.relationship ?? "",
    mobile: details.mobile ?? existing?.[0]?.mobile ?? "",
    address: details.address ?? existing?.[0]?.address ?? "",
  };
  if (existing && existing.length) {
    await sr.entities.Guardian.update(existing[0].id, patch);
    return { ...existing[0], ...patch };
  }
  return await sr.entities.Guardian.create({ email, status: "active", ...patch });
}

// Find-or-create the guardian↔child link.
export async function linkChild(sr, guardian, childName, childEmail) {
  const child_email = normEmail(childEmail);
  const existing = await sr.entities.GuardianChild.filter(
    { guardian_id: guardian.id, child_email }, "-created_date", 1
  ).catch(() => []);
  if (existing && existing.length) {
    if (existing[0].status !== "active") {
      await sr.entities.GuardianChild.update(existing[0].id, { status: "active" });
    }
    return existing[0];
  }
  return await sr.entities.GuardianChild.create({
    guardian_id: guardian.id,
    guardian_email: guardian.email,
    child_name: childName || "",
    child_email,
    status: "active",
    linked_at: new Date().toISOString(),
  });
}

// Create the approval request that the guardian decides on.
export async function createApprovalRequest(sr, { guardian, entry, child }) {
  return await sr.entities.GuardianApprovalRequest.create({
    guardian_id: guardian.id,
    guardian_email: guardian.email,
    guardian_name: guardian.name || "",
    child_name: child.name || "",
    child_email: normEmail(child.email),
    entry_id: String(entry.id || ""),
    entry_title: entry.title || "",
    challenge_id: String(entry.challenge_id || ""),
    challenge_title: entry.challenge_title || "",
    division: entry.division || "",
    status: "pending",
  });
}

// Apply a guardian decision to the request AND the gated entry.
export async function applyGuardianDecision(sr, request, decision, reason) {
  const now = new Date().toISOString();

  // Fail-closed: approve requires a granted GuardianConsent for the entry.
  if (decision === "approved") {
    const entryId = String(request.entry_id || "");
    if (!entryId) {
      throw new Error("Cannot approve: no entry linked; GuardianConsent record required");
    }
    const consents = await sr.entities.GuardianConsent.filter(
      { entry_id: entryId }, "-created_date", 20
    ).catch(() => []);
    const granted = (consents || []).find((c) => c.status === "granted");
    if (!granted) {
      throw new Error("Cannot approve: GuardianConsent record with status granted required before guardian_approval_status can be approved");
    }
  }

  await sr.entities.GuardianApprovalRequest.update(request.id, {
    status: decision,
    decline_reason: decision === "approved" ? "" : (reason || ""),
    decided_at: now,
  });
  if (request.entry_id) {
    const entryPatch: any = { guardian_approval_status: decision };
    if (decision === "approved") {
      entryPatch.approval_timestamp = now;
      entryPatch.decline_reason = "";
      entryPatch.consent_status = "valid";
    } else {
      entryPatch.decline_reason = reason || "";
      entryPatch.consent_status = decision === "revoked" ? "withdrawn" : "pending_consent";
    }
    await sr.entities.Entry.update(request.entry_id, entryPatch).catch(() => {});
  }
  // Audit trail — reuses the compliance audit log.
  try {
    await sr.entities.ComplianceAuditEvent.create({
      event_type: "finding_waived",
      challenge_id: request.challenge_id || "",
      actor_email: request.guardian_email || "",
      detail: `Guardian ${decision} entry ${request.entry_id || "(unlinked)"} for ${request.child_name}${reason ? `: ${reason}` : ""}.`,
    });
  } catch {}
  return { ...request, status: decision, decided_at: now };
}