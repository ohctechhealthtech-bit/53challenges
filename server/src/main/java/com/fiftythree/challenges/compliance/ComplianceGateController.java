package com.fiftythree.challenges.compliance;

import com.fiftythree.challenges.entity.ComplianceGateEntity;
import com.fiftythree.challenges.lifecycle.ComplianceGateQueryRepository;
import com.fiftythree.challenges.lifecycle.GateCheckQueryRepository;
import com.fiftythree.challenges.security.CallerResolver;
import com.fiftythree.challenges.support.ApiErrors;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * The Java replacement for {@code complianceGate}: the interim legal gate.
 *
 * <pre>
 *   statuses -> {statuses}  launch-blocked state for a set of ids  (any signed in)
 *   list     -> {gates}                                            (admin)
 *   get      -> {gate}                                             (admin)
 *   audit    -> {logs}                                             (admin)
 *   update   -> {gate}   enforced and audit-logged                 (admin)
 * </pre>
 *
 * <p>{@code sync} is not ported: it created gate records in bulk from the
 * upstream challenge list, and running it against a half-migrated system could
 * grandfather challenges past the gate. It stays on Base44 via the fallback
 * proxy until the rest of the compliance surface is across.
 */
@RestController
public class ComplianceGateController {

  private static final Logger log = LoggerFactory.getLogger(ComplianceGateController.class);

  private final ComplianceGateQueryRepository gates;
  private final ComplianceGateLogQueryRepository logs;
  private final GateCheckQueryRepository gateChecks;
  private final ComplianceGateService rules;
  private final ComplianceAuditService audit;
  private final CallerResolver caller;

  public ComplianceGateController(
      ComplianceGateQueryRepository gates,
      ComplianceGateLogQueryRepository logs,
      GateCheckQueryRepository gateChecks,
      ComplianceGateService rules,
      ComplianceAuditService audit,
      CallerResolver caller) {
    this.gates = gates;
    this.logs = logs;
    this.gateChecks = gateChecks;
    this.rules = rules;
    this.audit = audit;
    this.caller = caller;
  }

  @PostMapping("/api/apps/{appId}/functions/complianceGate")
  public ResponseEntity<?> handle(@RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> request = body == null ? Map.of() : body;
    String action = str(request.get("action"));
    String sessionToken = str(request.get("session_token"));
    String email = caller.email(sessionToken);

    // "statuses" answers before the session check, deliberately.
    //
    // It is what a challenge page asks to decide whether to show Enter and
    // Vote, and those pages are public — the whole point of a challenge
    // subdomain is that anyone can open it. This check sat above the try
    // block, so a logged-out visitor got 401, the client failed closed as it
    // is designed to, and every challenge rendered as "Entries & voting are
    // paused for this challenge pending review" no matter how open it was.
    //
    // What it returns is three fields the page then displays anyway:
    // whether entries are blocked, where legal review got to, and whether the
    // challenge predates the gate. The caller supplies the ids, so there is
    // nothing here to enumerate that the page does not already say out loud.
    if ("statuses".equals(action)) {
      try {
        return statuses(request);
      } catch (Exception e) {
        log.error("complianceGate statuses failed", e);
        return ApiErrors.internal(e);
      }
    }

    if (email == null) {
      return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
    }

    try {
      if (!caller.isAdmin(sessionToken)) {
        return ResponseEntity.status(403).body(Map.of("error", "Admin only"));
      }
      return switch (action) {
        case "list" -> ResponseEntity.ok(Map.of("gates", gates.findAll()));
        case "get" -> get(request);
        case "audit" -> auditLog(request);
        case "update" -> update(request, email);
        default -> ResponseEntity.badRequest().body(Map.of("error", "Unknown action"));
      };
    } catch (Exception e) {
      log.error("complianceGate action '{}' failed", action, e);
      return ApiErrors.internal(e);
    }
  }

  /**
   * Launch-blocked state for a set of challenges, for annotating the UI.
   *
   * <p>Every id starts blocked. A challenge with no gate on record is treated
   * as blocked, not permitted — missing is not the same as cleared, and a
   * catalogue that showed unassessed challenges as open would invite exactly
   * the entries the gate exists to prevent.
   */
  private ResponseEntity<?> statuses(Map<String, Object> request) {
    List<?> raw = request.get("challenge_ids") instanceof List<?> l ? l : List.of();
    LinkedHashSet<String> ids = new LinkedHashSet<>();
    for (Object o : raw) {
      String id = str(o);
      if (!id.isEmpty()) {
        ids.add(id);
      }
    }

    Map<String, Object> out = new LinkedHashMap<>();
    for (String id : ids) {
      out.put(id, Map.of(
          "launch_blocked", true,
          "legal_review_status", "not_started",
          "grandfathered_live", false));
    }

    if (!ids.isEmpty()) {
      // One batched query rather than a lookup per id: a per-id loop hit the
      // entity API's rate limit on catalogue loads.
      LinkedHashSet<String> resolved = new LinkedHashSet<>();
      for (ComplianceGateEntity g : gates.findByChallengeIds(ids)) {
        String id = nz(g.getChallengeId());
        // Rows arrive newest-first, so the first gate seen for an id is the
        // current one and any later row for it is superseded.
        if (!out.containsKey(id) || resolved.contains(id)) {
          continue;
        }
        resolved.add(id);
        out.put(id, Map.of(
            "launch_blocked", Boolean.TRUE.equals(g.getLaunchBlocked()),
            "legal_review_status", firstNonBlank(g.getLegalReviewStatus(), "not_started"),
            "grandfathered_live", Boolean.TRUE.equals(g.getGrandfatheredLive())));
      }
    }
    return ResponseEntity.ok(Map.of("statuses", out));
  }

  private ResponseEntity<?> get(Map<String, Object> request) {
    String challengeId = str(request.get("challenge_id"));
    if (challengeId.isEmpty()) {
      return ResponseEntity.badRequest().body(Map.of("error", "challenge_id required"));
    }
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("gate", gates.findLatestFor(challengeId).stream().findFirst().orElse(null));
    return ResponseEntity.ok(out);
  }

  private ResponseEntity<?> auditLog(Map<String, Object> request) {
    String gateId = str(request.get("gate_id"));
    if (gateId.isEmpty()) {
      return ResponseEntity.badRequest().body(Map.of("error", "gate_id required"));
    }
    return ResponseEntity.ok(Map.of("logs", logs.findByGate(gateId)));
  }

  private ResponseEntity<?> update(Map<String, Object> request, String email) {
    String gateId = str(request.get("gate_id"));
    if (gateId.isEmpty()) {
      return ResponseEntity.badRequest().body(Map.of("error", "gate_id required"));
    }
    ComplianceGateEntity gate = gates.findById(gateId).orElse(null);
    if (gate == null) {
      return ResponseEntity.status(404).body(Map.of("error", "Gate not found"));
    }

    Map<String, Object> incoming = asMap(request.get("fields"));
    Map<String, Object> updates = new LinkedHashMap<>();
    for (String field : ComplianceGateService.UPDATABLE_FIELDS) {
      if (incoming.containsKey(field)) {
        updates.put(field, incoming.get(field));
      }
    }

    if (updates.containsKey("launch_blocked")) {
      // Once the review_to_approved lifecycle gate has passed, this interim
      // field is historical — the lifecycle system governs the challenge now,
      // and letting someone edit the old flag would suggest a control that no
      // longer does anything.
      boolean reviewPassed = gateChecks.findLatest(nz(gate.getChallengeId()), "review_to_approved")
          .stream().findFirst()
          .map(c -> "passed".equals(c.getStatus()))
          .orElse(false);
      if (reviewPassed) {
        return ResponseEntity.status(409).body(Map.of("error",
            "launch_blocked is read-only/historical: the review_to_approved lifecycle gate "
                + "has passed, so the interim gate no longer governs this challenge."));
      }
    }

    boolean clearing = Boolean.FALSE.equals(toBoolean(updates.get("launch_blocked")))
        && Boolean.TRUE.equals(gate.getLaunchBlocked());
    if (clearing) {
      ComplianceGateEntity merged = withUpdates(gate, updates);
      ComplianceGateService.Clearance clearance = rules.evaluate(merged);
      if (!clearance.canClear()) {
        return ResponseEntity.status(409).body(Map.of(
            "error", "Cannot clear launch_blocked: gate conditions not met.",
            "missing", clearance.missing()));
      }
    }

    // Every changed field is logged before the write, with its old and new
    // value — this log is the record of who cleared a legal gate and when.
    for (Map.Entry<String, Object> change : updates.entrySet()) {
      Object oldValue = valueOf(gate, change.getKey());
      if (Objects.equals(String.valueOf(oldValue), String.valueOf(change.getValue()))) {
        continue;
      }
      String logAction = "launch_blocked".equals(change.getKey())
          ? (truthy(change.getValue()) ? "launch_blocked" : "launch_unblocked")
          : "field_change";
      audit.gateLog(gateId, nz(gate.getChallengeId()), logAction, change.getKey(),
          "launch_blocked".equals(change.getKey()) && !truthy(change.getValue())
              ? "Cleared after all conditions met." : "",
          email);
    }

    applyUpdates(gate, updates);
    gate.setUpdatedDate(Instant.now());
    return ResponseEntity.ok(Map.of("gate", gates.save(gate)));
  }

  /** A detached copy with the updates applied, for evaluating the rules. */
  private static ComplianceGateEntity withUpdates(
      ComplianceGateEntity gate, Map<String, Object> updates) {
    ComplianceGateEntity copy = new ComplianceGateEntity();
    copy.setId(gate.getId());
    copy.setChallengeId(gate.getChallengeId());
    copy.setLegalReviewStatus(gate.getLegalReviewStatus());
    copy.setPromoterConfirmed(gate.getPromoterConfirmed());
    copy.setTermsApproved(gate.getTermsApproved());
    copy.setMinorParticipationReviewed(gate.getMinorParticipationReviewed());
    copy.setVotingReviewed(gate.getVotingReviewed());
    copy.setPermitPositionRecorded(gate.getPermitPositionRecorded());
    copy.setPrizeFundingConfirmed(gate.getPrizeFundingConfirmed());
    copy.setLaunchBlocked(gate.getLaunchBlocked());
    copy.setLegalReviewReference(gate.getLegalReviewReference());
    copy.setGateNotes(gate.getGateNotes());
    applyUpdates(copy, updates);
    return copy;
  }

  private static void applyUpdates(ComplianceGateEntity gate, Map<String, Object> updates) {
    updates.forEach((field, value) -> {
      switch (field) {
        case "legal_review_status" -> gate.setLegalReviewStatus(str(value));
        case "promoter_confirmed" -> gate.setPromoterConfirmed(truthy(value));
        case "terms_approved" -> gate.setTermsApproved(truthy(value));
        case "minor_participation_reviewed" -> gate.setMinorParticipationReviewed(truthy(value));
        case "voting_reviewed" -> gate.setVotingReviewed(truthy(value));
        case "permit_position_recorded" -> gate.setPermitPositionRecorded(truthy(value));
        case "prize_funding_confirmed" -> gate.setPrizeFundingConfirmed(truthy(value));
        case "launch_blocked" -> gate.setLaunchBlocked(truthy(value));
        case "legal_review_reference" -> gate.setLegalReviewReference(str(value));
        case "gate_notes" -> gate.setGateNotes(str(value));
        default -> { /* unreachable: the field list is fixed */ }
      }
    });
  }

  private static Object valueOf(ComplianceGateEntity gate, String field) {
    return switch (field) {
      case "legal_review_status" -> gate.getLegalReviewStatus();
      case "promoter_confirmed" -> gate.getPromoterConfirmed();
      case "terms_approved" -> gate.getTermsApproved();
      case "minor_participation_reviewed" -> gate.getMinorParticipationReviewed();
      case "voting_reviewed" -> gate.getVotingReviewed();
      case "permit_position_recorded" -> gate.getPermitPositionRecorded();
      case "prize_funding_confirmed" -> gate.getPrizeFundingConfirmed();
      case "launch_blocked" -> gate.getLaunchBlocked();
      case "legal_review_reference" -> gate.getLegalReviewReference();
      case "gate_notes" -> gate.getGateNotes();
      default -> null;
    };
  }

  private static Boolean toBoolean(Object v) {
    return v == null ? null : truthy(v);
  }

  private static boolean truthy(Object v) {
    return Boolean.TRUE.equals(v) || "true".equalsIgnoreCase(String.valueOf(v));
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> asMap(Object v) {
    return v instanceof Map<?, ?> m ? (Map<String, Object>) m : Map.of();
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
