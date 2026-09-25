package com.fiftythree.challenges.guardian;

import com.fiftythree.challenges.engine.EntryQueryRepository;
import com.fiftythree.challenges.entity.EntryEntity;
import com.fiftythree.challenges.entity.GuardianApprovalRequestEntity;
import com.fiftythree.challenges.entity.GuardianChildEntity;
import com.fiftythree.challenges.entity.GuardianEntity;
import com.fiftythree.challenges.security.CallerResolver;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * The Java replacement for {@code guardianPortal} — the guardian-facing side of
 * parental consent, and the other half of what submitChallengeEntry creates.
 *
 * <p><b>A guardian can only ever see and decide requests addressed to their own
 * verified email.</b> Every lookup is scoped to the session address, and a
 * request belonging to someone else returns "not found" rather than
 * "forbidden", so the portal cannot be used to discover which addresses have
 * children with pending entries.
 *
 * <pre>
 *   register / me / link_child / unlink_child
 *   list_requests / activity
 *   approve / decline / revoke
 * </pre>
 */
@RestController
public class GuardianPortalController {

  private static final Logger log = LoggerFactory.getLogger(GuardianPortalController.class);

  private final GuardianService guardians;
  private final GuardianQueryRepository guardianRepo;
  private final GuardianChildQueryRepository children;
  private final GuardianApprovalRequestQueryRepository approvals;
  private final EntryQueryRepository entries;
  private final CallerResolver caller;

  public GuardianPortalController(
      GuardianService guardians,
      GuardianQueryRepository guardianRepo,
      GuardianChildQueryRepository children,
      GuardianApprovalRequestQueryRepository approvals,
      EntryQueryRepository entries,
      CallerResolver caller) {
    this.guardians = guardians;
    this.guardianRepo = guardianRepo;
    this.children = children;
    this.approvals = approvals;
    this.entries = entries;
    this.caller = caller;
  }

  @PostMapping("/api/apps/{appId}/functions/guardianPortal")
  public ResponseEntity<?> handle(@RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> request = body == null ? Map.of() : body;
    String email = caller.email(str(request.get("session_token")));
    if (email == null) {
      return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
    }
    String action = str(request.get("action"));

    try {
      return switch (action) {
        case "register" -> register(request, email);
        case "me" -> me(email);
        case "link_child" -> linkChild(request, email);
        case "unlink_child" -> unlinkChild(request, email);
        case "list_requests" -> ResponseEntity.ok(
            Map.of("requests", approvals.findAll().stream()
                .filter(r -> email.equals(norm(r.getGuardianEmail())))
                .sorted(Comparator.comparing(
                    (GuardianApprovalRequestEntity r) -> nz(r.getCreatedDate() == null
                        ? "" : r.getCreatedDate().toString())).reversed())
                .toList()));
        case "activity" -> activity(email);
        case "approve", "decline", "revoke" -> decide(request, email, action);
        default -> ResponseEntity.badRequest().body(Map.of("error", "Unknown action"));
      };
    } catch (IllegalStateException | IllegalArgumentException e) {
      // These carry a message written for the guardian reading it.
      return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
    } catch (Exception e) {
      log.error("guardianPortal action '{}' failed", action, e);
      return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
    }
  }

  private ResponseEntity<?> register(Map<String, Object> request, String email) {
    GuardianEntity guardian = guardians.upsert(new GuardianService.GuardianDetails(
        email,
        str(request.get("name")),
        str(request.get("relationship")),
        str(request.get("mobile")),
        str(request.get("address"))));
    return ResponseEntity.ok(Map.of("ok", true, "guardian", guardians.claim(guardian, "")));
  }

  private ResponseEntity<?> me(String email) {
    GuardianEntity guardian = findGuardian(email);
    if (guardian == null) {
      Map<String, Object> empty = new LinkedHashMap<>();
      empty.put("guardian", null);
      empty.put("children", List.of());
      empty.put("pending_count", 0);
      return ResponseEntity.ok(empty);
    }
    long pending = approvals.findAll().stream()
        .filter(r -> email.equals(norm(r.getGuardianEmail())))
        .filter(r -> "pending".equals(nz(r.getStatus())))
        .count();
    return ResponseEntity.ok(Map.of(
        "guardian", guardian,
        "children", activeChildren(guardian),
        "pending_count", pending));
  }

  private ResponseEntity<?> linkChild(Map<String, Object> request, String email) {
    GuardianEntity guardian = findGuardian(email);
    if (guardian == null) {
      return ResponseEntity.badRequest().body(Map.of("error", "Register as a guardian first"));
    }
    String childEmail = norm(str(request.get("child_email")));
    String childName = str(request.get("child_name")).trim();
    if (childEmail.isEmpty() || childName.isEmpty()) {
      return ResponseEntity.badRequest()
          .body(Map.of("error", "child_name and child_email required"));
    }
    // A guardian cannot be their own child: that would let one account both
    // submit and approve a minor's entry.
    if (childEmail.equals(email)) {
      return ResponseEntity.badRequest()
          .body(Map.of("error", "A child email must be different from your own"));
    }
    return ResponseEntity.ok(Map.of(
        "ok", true, "child", guardians.linkChild(guardian, childName, childEmail)));
  }

  private ResponseEntity<?> unlinkChild(Map<String, Object> request, String email) {
    GuardianChildEntity link = children.findById(str(request.get("child_id"))).orElse(null);
    // Same answer whether the link is missing or belongs to another guardian.
    if (link == null || !email.equals(norm(link.getGuardianEmail()))) {
      return ResponseEntity.status(404).body(Map.of("error", "Child link not found"));
    }
    link.setStatus("revoked");
    link.setUpdatedDate(Instant.now());
    children.save(link);
    return ResponseEntity.ok(Map.of("ok", true));
  }

  /** Linked children's entries — title, challenge and status only. */
  private ResponseEntity<?> activity(String email) {
    GuardianEntity guardian = findGuardian(email);
    if (guardian == null) {
      return ResponseEntity.ok(Map.of("entries", List.of()));
    }

    List<Map<String, Object>> out = new ArrayList<>();
    for (GuardianChildEntity child : activeChildren(guardian)) {
      String childEmail = norm(child.getChildEmail());
      for (EntryEntity e : entries.findByCreatorEmail(childEmail)) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", e.getId());
        row.put("child_email", childEmail);
        row.put("title", e.getTitle());
        row.put("challenge_title", e.getChallengeTitle());
        row.put("status", e.getStatus());
        row.put("guardian_approval_status",
            nz(e.getGuardianApprovalStatus()).isEmpty() ? "not_required" : e.getGuardianApprovalStatus());
        row.put("submitted_at", e.getSubmittedAt() != null ? e.getSubmittedAt() : e.getCreatedDate());
        row.put("vote_count", e.getVoteCount() == null ? 0 : e.getVoteCount());
        out.add(row);
      }
    }
    out.sort(Comparator.comparing(
        (Map<String, Object> r) -> String.valueOf(r.get("submitted_at"))).reversed());
    return ResponseEntity.ok(Map.of("entries", out));
  }

  private ResponseEntity<?> decide(Map<String, Object> request, String email, String action) {
    GuardianApprovalRequestEntity approval =
        approvals.findById(str(request.get("request_id"))).orElse(null);
    if (approval == null || !email.equals(norm(approval.getGuardianEmail()))) {
      return ResponseEntity.status(404).body(Map.of("error", "Approval request not found"));
    }

    String reason = str(request.get("reason")).trim();
    if ("decline".equals(action) && reason.isEmpty()) {
      // A decline without a reason leaves the entrant with no idea what to fix.
      return ResponseEntity.badRequest().body(Map.of("error", "A reason is required to decline"));
    }
    if ("approve".equals(action) && !"pending".equals(nz(approval.getStatus()))) {
      return ResponseEntity.status(409).body(Map.of("error", "This request has already been decided"));
    }
    if ("revoke".equals(action) && !"approved".equals(nz(approval.getStatus()))) {
      return ResponseEntity.status(409).body(Map.of("error", "Only an approved request can be revoked"));
    }

    // Register on first decision: a guardian who arrives straight from the
    // notification link has no record yet.
    GuardianEntity guardian = findGuardian(email);
    if (guardian == null) {
      guardian = guardians.upsert(new GuardianService.GuardianDetails(
          email, nz(approval.getGuardianName()), "", "", ""));
      guardians.claim(guardian, "");
    }
    if (!nz(approval.getChildEmail()).isEmpty()) {
      try {
        guardians.linkChild(guardian, approval.getChildName(), approval.getChildEmail());
      } catch (Exception e) {
        // The link is for the dashboard; failing it must not block the decision.
        log.warn("Could not link child during decision on {}: {}", approval.getId(), e.toString());
      }
    }

    String decision = switch (action) {
      case "approve" -> "approved";
      case "decline" -> "declined";
      default -> "revoked";
    };
    return ResponseEntity.ok(Map.of(
        "ok", true, "request", guardians.applyDecision(approval, decision, reason)));
  }

  private GuardianEntity findGuardian(String email) {
    return guardianRepo.findLatestByEmail(email).stream().findFirst().orElse(null);
  }

  private List<GuardianChildEntity> activeChildren(GuardianEntity guardian) {
    return children.findAll().stream()
        .filter(c -> guardian.getId().equals(c.getGuardianId()))
        .filter(c -> "active".equals(nz(c.getStatus())))
        .toList();
  }

  private static String norm(String v) {
    return v == null ? "" : v.trim().toLowerCase();
  }

  private static String nz(String v) {
    return v == null ? "" : v;
  }

  private static String str(Object v) {
    return v == null ? "" : String.valueOf(v);
  }
}
