package com.fiftythree.challenges.prize;

import com.fiftythree.challenges.engine.EntryQueryRepository;
import com.fiftythree.challenges.entity.AuditReviewEntity;
import com.fiftythree.challenges.entity.CompetitionAssignmentEntity;
import com.fiftythree.challenges.entity.PrizePayoutEntity;
import com.fiftythree.challenges.judging.CompetitionAssignmentQueryRepository;
import com.fiftythree.challenges.security.CallerResolver;
import com.fiftythree.challenges.support.ApiErrors;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * The Java replacement for {@code prizePayoutAction}: releasing prize money.
 *
 * <p>Four stages, each requiring the one before:
 * {@code pending → audited → approved → paid}. Two different people are
 * involved by design — an auditor signs off and a platform admin approves —
 * so no single account can take a payout from created to paid.
 *
 * <p>The ordering is enforced here rather than in the admin screen, because
 * these are the checks standing between a verified winner and money leaving
 * the business.
 */
@RestController
public class PrizePayoutActionController {

  private static final Logger log = LoggerFactory.getLogger(PrizePayoutActionController.class);

  private final PrizePayoutQueryRepository payouts;
  private final AuditReviewQueryRepository reviews;
  private final CompetitionAssignmentQueryRepository assignments;
  private final EntryQueryRepository entries;
  private final CallerResolver caller;

  public PrizePayoutActionController(
      PrizePayoutQueryRepository payouts,
      AuditReviewQueryRepository reviews,
      CompetitionAssignmentQueryRepository assignments,
      EntryQueryRepository entries,
      CallerResolver caller) {
    this.payouts = payouts;
    this.reviews = reviews;
    this.assignments = assignments;
    this.entries = entries;
    this.caller = caller;
  }

  @PostMapping("/api/apps/{appId}/functions/prizePayoutAction")
  public ResponseEntity<?> handle(@RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> request = body == null ? Map.of() : body;
    String action = str(request.get("action"));
    String payoutId = str(request.get("payout_id"));
    if (action.isEmpty() || payoutId.isEmpty()) {
      return ResponseEntity.badRequest().body(Map.of("error", "Missing action/payout_id"));
    }

    String sessionToken = str(request.get("session_token"));
    String email = caller.email(sessionToken);
    if (email == null) {
      return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
    }
    boolean isAdmin = caller.isAdmin(sessionToken);

    try {
      PrizePayoutEntity payout = payouts.findById(payoutId).orElse(null);
      if (payout == null) {
        return ResponseEntity.status(404).body(Map.of("error", "Payout not found"));
      }
      Map<String, Object> data = asMap(request.get("data"));

      return switch (action) {
        case "verify_identity" -> verifyIdentity(payout, data, email, isAdmin);
        case "auditor_signoff" -> auditorSignoff(payout, email, isAdmin);
        case "admin_approve" -> isAdmin ? adminApprove(payout, email) : adminOnly();
        case "mark_paid" -> isAdmin ? markPaid(payout, data) : adminOnly();
        default -> ResponseEntity.badRequest()
            .body(Map.of("error", "Unknown action: " + action));
      };
    } catch (Exception e) {
      log.error("prizePayoutAction '{}' failed for {}", action, payoutId, e);
      return ApiErrors.internal(e);
    }
  }

  private static ResponseEntity<?> adminOnly() {
    return ResponseEntity.status(403).body(Map.of("error", "Admin only"));
  }

  /** The winner confirms who they are and where the money should go. */
  private ResponseEntity<?> verifyIdentity(
      PrizePayoutEntity payout, Map<String, Object> data, String email, boolean isAdmin) {

    if (!canEditDetails(payout, email, isAdmin)) {
      return ResponseEntity.status(403)
          .body(Map.of("error", "You can only verify your own prize payout."));
    }

    payout.setIdentityVerified(true);
    payout.setPaymentDetailsVerified(truthy(data.get("payment_details_verified")));
    payout.setPaymentMethod(firstNonBlank(str(data.get("payment_method")), payout.getPaymentMethod()));
    payout.setPayeeName(firstNonBlank(str(data.get("payee_name")), payout.getPayeeName()));
    payout.setGuardianName(firstNonBlank(str(data.get("guardian_name")), payout.getGuardianName()));
    payout.setPayeeType(firstNonBlank(str(data.get("payee_type")), payout.getPayeeType()));
    payout.setNotes(firstNonBlank(str(data.get("notes")), payout.getNotes()));
    payout.setUpdatedDate(Instant.now());
    return ResponseEntity.ok(Map.of("success", true, "payout", payouts.save(payout)));
  }

  /** The auditor confirms the payout matches a verified, signed-off result. */
  private ResponseEntity<?> auditorSignoff(
      PrizePayoutEntity payout, String email, boolean isAdmin) {

    if (!canAudit(nz(payout.getCompetitionId()), email, isAdmin)) {
      return ResponseEntity.status(403).body(Map.of("error",
          "Only the assigned auditor (or admin) can sign off a payout, and not for a "
              + "competition they judge or manage."));
    }
    if (!Boolean.TRUE.equals(payout.getIdentityVerified())
        || !Boolean.TRUE.equals(payout.getPaymentDetailsVerified())) {
      return ResponseEntity.status(409).body(Map.of("error",
          "Winner must verify identity and payment details before auditor sign-off."));
    }

    // The competition's own audit must be signed off too — a payout cannot be
    // audited against a result nobody has verified.
    AuditReviewEntity review = reviews.findLatestFor(nz(payout.getCompetitionId()))
        .stream().findFirst().orElse(null);
    if (review == null || !"signed_off".equals(nz(review.getStatus()))) {
      return ResponseEntity.status(409).body(Map.of(
          "error", "Audit must be signed off before prizes can be released."));
    }

    Instant now = Instant.now();
    payout.setStatus("audited");
    payout.setAuditorSignoffBy(email);
    payout.setAuditorSignoffName(email);
    payout.setAuditorSignoffAt(now);
    payout.setUpdatedDate(now);
    return ResponseEntity.ok(Map.of("success", true, "payout", payouts.save(payout)));
  }

  private ResponseEntity<?> adminApprove(PrizePayoutEntity payout, String email) {
    if (!"audited".equals(nz(payout.getStatus()))) {
      return ResponseEntity.status(409).body(Map.of(
          "error", "Payout must be audited (auditor sign-off) before admin approval."));
    }
    Instant now = Instant.now();
    payout.setStatus("approved");
    payout.setAdminApprovalBy(email);
    payout.setAdminApprovalName(email);
    payout.setAdminApprovalAt(now);
    payout.setUpdatedDate(now);
    return ResponseEntity.ok(Map.of("success", true, "payout", payouts.save(payout)));
  }

  private ResponseEntity<?> markPaid(PrizePayoutEntity payout, Map<String, Object> data) {
    if (!"approved".equals(nz(payout.getStatus()))) {
      return ResponseEntity.status(409).body(Map.of(
          "error", "Payout must be approved before it can be marked paid."));
    }
    Instant now = Instant.now();
    payout.setStatus("paid");
    payout.setPaidAt(now);
    payout.setPaymentRef(str(data.get("payment_ref")));
    payout.setUpdatedDate(now);
    return ResponseEntity.ok(Map.of("success", true, "payout", payouts.save(payout)));
  }

  /** The winner themselves, or an admin recording it on their behalf. */
  private boolean canEditDetails(PrizePayoutEntity payout, String email, boolean isAdmin) {
    if (isAdmin) {
      return true;
    }
    if (nz(payout.getEntryId()).isEmpty()) {
      return false;
    }
    return entries.findById(payout.getEntryId())
        .map(e -> email.equals(nz(e.getCreatorEmail()).toLowerCase()))
        .orElse(false);
  }

  /**
   * An assigned auditor who is not also a judge or manager on the same
   * competition.
   *
   * <p>The judge/manager check runs first and rejects outright: someone
   * holding both roles is disqualified from auditing even if the auditor role
   * is also present, which is the whole point of role separation.
   */
  private boolean canAudit(String competitionId, String email, boolean isAdmin) {
    if (isAdmin) {
      return true;
    }
    List<CompetitionAssignmentEntity> mine =
        assignments.findActiveFor(competitionId, email);
    boolean judgeOrManager = mine.stream()
        .anyMatch(a -> "judge".equals(nz(a.getRole())) || "manager".equals(nz(a.getRole())));
    if (judgeOrManager) {
      return false;
    }
    return mine.stream().anyMatch(a -> "auditor".equals(nz(a.getRole())));
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> asMap(Object v) {
    return v instanceof Map<?, ?> m ? (Map<String, Object>) m : Map.of();
  }

  private static boolean truthy(Object v) {
    return Boolean.TRUE.equals(v) || "true".equalsIgnoreCase(String.valueOf(v));
  }

  private static String firstNonBlank(String... values) {
    for (String v : values) {
      if (v != null && !v.isBlank()) {
        return v;
      }
    }
    return "";
  }

  private static String nz(String v) {
    return v == null ? "" : v;
  }

  private static String str(Object v) {
    return v == null ? "" : String.valueOf(v);
  }
}
