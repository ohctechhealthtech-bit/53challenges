package com.fiftythree.challenges.guardian;

import com.fiftythree.challenges.entity.GuardianApprovalRequestEntity;
import com.fiftythree.challenges.entity.GuardianChildEntity;
import com.fiftythree.challenges.compliance.ComplianceAuditService;
import com.fiftythree.challenges.engine.EntryQueryRepository;
import com.fiftythree.challenges.entity.GuardianEntity;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;

/**
 * Guardian records for an entrant under 18.
 *
 * <p>A minor's entry is gated by {@code guardian_approval_status} on the Entry:
 * {@code pending} until the guardian decides, then {@code approved} or
 * {@code declined}. Until it is approved the entry is not publicly listable and
 * not votable — enforced in ChallengeEngineController and LatestEntriesController,
 * not here.
 *
 * <p>The guardian's identity comes from the submitted details; the <em>child's</em>
 * is always the authenticated account. Nothing here accepts a client-supplied
 * child email.
 */
@Service
public class GuardianService {

  private final GuardianQueryRepository guardians;
  private final GuardianChildQueryRepository children;
  private final GuardianApprovalRequestQueryRepository approvals;
  private final GuardianConsentQueryRepository consents;
  private final EntryQueryRepository entries;
  private final ComplianceAuditService audit;

  public GuardianService(
      GuardianQueryRepository guardians,
      GuardianChildQueryRepository children,
      GuardianApprovalRequestQueryRepository approvals,
      GuardianConsentQueryRepository consents,
      EntryQueryRepository entries,
      ComplianceAuditService audit) {
    this.guardians = guardians;
    this.children = children;
    this.approvals = approvals;
    this.consents = consents;
    this.entries = entries;
    this.audit = audit;
  }

  /**
   * Finds or creates the guardian for an address, refreshing their contact
   * details.
   *
   * <p>Keyed on email because a guardian may have several children entering
   * different challenges and should remain one record.
   */
  public GuardianEntity upsert(GuardianDetails details) {
    String email = norm(details.email());
    if (email.isEmpty()) {
      throw new IllegalArgumentException("Guardian email required");
    }

    GuardianEntity existing = guardians.findLatestByEmail(email).stream().findFirst().orElse(null);
    if (existing != null) {
      // Blank incoming values keep what is already on record rather than
      // erasing it: a later entry form may carry less detail than the first.
      existing.setName(firstNonBlank(details.name(), existing.getName()));
      existing.setRelationship(firstNonBlank(details.relationship(), existing.getRelationship()));
      existing.setMobile(firstNonBlank(details.mobile(), existing.getMobile()));
      existing.setAddress(firstNonBlank(details.address(), existing.getAddress()));
      existing.setUpdatedDate(Instant.now());
      return guardians.save(existing);
    }

    GuardianEntity created = new GuardianEntity();
    created.setId(newId());
    created.setEmail(email);
    created.setName(nz(details.name()));
    created.setRelationship(nz(details.relationship()));
    created.setMobile(nz(details.mobile()));
    created.setAddress(nz(details.address()));
    created.setStatus("active");
    created.setCreatedDate(Instant.now());
    created.setUpdatedDate(Instant.now());
    created.setIsSample(false);
    return guardians.save(created);
  }

  /** Finds or creates the guardian-to-child link, reactivating a dormant one. */
  public GuardianChildEntity linkChild(GuardianEntity guardian, String childName, String childEmail) {
    String email = norm(childEmail);
    GuardianChildEntity existing =
        children.findLink(guardian.getId(), email).stream().findFirst().orElse(null);
    if (existing != null) {
      // A revoked link is re-raised as a claim, not restored: revoking and
      // re-adding must not be a way to skip confirmation.
      if ("revoked".equals(nz(existing.getStatus()))) {
        existing.setStatus("pending");
        existing.setUpdatedDate(Instant.now());
        return children.save(existing);
      }
      return existing;
    }

    GuardianChildEntity link = new GuardianChildEntity();
    link.setId(newId());
    link.setGuardianId(guardian.getId());
    link.setGuardianEmail(guardian.getEmail());
    link.setChildName(nz(childName));
    link.setChildEmail(email);
    // A claim, not a relationship: the email came from the guardian, so this
    // grants nothing until the child's own side confirms it. See
    // GuardianPortalController.activeChildren.
    link.setStatus("pending");
    link.setLinkedAt(Instant.now());
    link.setCreatedDate(Instant.now());
    link.setUpdatedDate(Instant.now());
    link.setIsSample(false);
    return children.save(link);
  }

  /** Opens the approval request the guardian decides on, via the guardian portal. */
  public GuardianApprovalRequestEntity createApprovalRequest(
      GuardianEntity guardian, ApprovalEntry entry, String childName, String childEmail) {

    GuardianApprovalRequestEntity request = new GuardianApprovalRequestEntity();
    request.setId(newId());
    request.setGuardianId(guardian.getId());
    request.setGuardianEmail(guardian.getEmail());
    request.setGuardianName(nz(guardian.getName()));
    request.setChildName(nz(childName));
    request.setChildEmail(norm(childEmail));
    request.setEntryId(nz(entry.entryId()));
    request.setEntryTitle(nz(entry.title()));
    request.setChallengeId(nz(entry.challengeId()));
    request.setChallengeTitle(nz(entry.challengeTitle()));
    request.setDivision(nz(entry.division()));
    // Always pending: an approval request that started life approved would
    // defeat the point of asking.
    request.setStatus("pending");
    request.setCreatedDate(Instant.now());
    request.setUpdatedDate(Instant.now());
    request.setIsSample(false);
    return approvals.save(request);
  }

  public static String norm(String v) {
    return v == null ? "" : v.trim().toLowerCase();
  }

  private static String nz(String v) {
    return v == null ? "" : v;
  }

  private static String firstNonBlank(String preferred, String fallback) {
    return preferred != null && !preferred.isBlank() ? preferred : nz(fallback);
  }

  private static String newId() {
    return UUID.randomUUID().toString().replace("-", "").substring(0, 24);
  }


  /**
   * Applies a guardian's decision to the request and to the gated entry.
   *
   * <p><b>Approving requires a granted GuardianConsent for the entry.</b> A
   * guardian pressing "approve" is not by itself a consent record — the
   * consent carries the scopes, the wording hash and the verification method.
   * Without this check an entry could be published for a child with no consent
   * on file, which is the one outcome this whole mechanism exists to prevent.
   *
   * @throws IllegalStateException when approval is not permitted
   */
  public GuardianApprovalRequestEntity applyDecision(
      GuardianApprovalRequestEntity request, String decision, String reason) {

    Instant now = Instant.now();

    if ("approved".equals(decision)) {
      String entryId = nz(request.getEntryId());
      if (entryId.isEmpty()) {
        throw new IllegalStateException(
            "Cannot approve: no entry linked; GuardianConsent record required");
      }
      if (consents.findGrantedForEntry(entryId).isEmpty()) {
        throw new IllegalStateException(
            "Cannot approve: GuardianConsent record with status granted required before "
                + "guardian_approval_status can be approved");
      }
    }

    request.setStatus(decision);
    request.setDeclineReason("approved".equals(decision) ? "" : nz(reason));
    request.setDecidedAt(now);
    request.setUpdatedDate(now);
    approvals.save(request);

    if (!nz(request.getEntryId()).isEmpty()) {
      entries.findById(request.getEntryId()).ifPresent(entry -> {
        entry.setGuardianApprovalStatus(decision);
        if ("approved".equals(decision)) {
          entry.setApprovalTimestamp(now);
          entry.setDeclineReason("");
          entry.setConsentStatus("valid");
        } else {
          entry.setDeclineReason(nz(reason));
          entry.setConsentStatus("revoked".equals(decision) ? "withdrawn" : "pending_consent");
        }
        entry.setUpdatedDate(now);
        entries.save(entry);
      });
    }

    audit.event("finding_waived", nz(request.getChallengeId()), "",
        nz(request.getGuardianEmail()),
        "Guardian " + decision + " entry "
            + (nz(request.getEntryId()).isEmpty() ? "(unlinked)" : request.getEntryId())
            + " for " + nz(request.getChildName())
            + (nz(reason).isEmpty() ? "" : ": " + reason) + ".");

    return request;
  }

  /** Marks the guardian as a claimed, verified account. */
  public GuardianEntity claim(GuardianEntity guardian, String userId) {
    guardian.setUserId(nz(userId));
    guardian.setVerified(true);
    guardian.setUpdatedDate(Instant.now());
    return guardians.save(guardian);
  }

  /** Guardian contact details as submitted with an entry. */
  public record GuardianDetails(
      String email, String name, String relationship, String mobile, String address) {}

  /** The entry an approval request refers to. */
  public record ApprovalEntry(
      String entryId, String title, String challengeId, String challengeTitle, String division) {}
}
