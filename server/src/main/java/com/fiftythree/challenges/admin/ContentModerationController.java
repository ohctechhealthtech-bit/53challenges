package com.fiftythree.challenges.admin;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiftythree.challenges.compliance.ComplianceAuditService;
import com.fiftythree.challenges.engine.EntryQueryRepository;
import com.fiftythree.challenges.entity.ChallengeEntity;
import com.fiftythree.challenges.entity.ChallengeRepository;
import com.fiftythree.challenges.entity.EntryEntity;
import com.fiftythree.challenges.host.HostAccessService;
import com.fiftythree.challenges.security.CallerResolver;
import com.fiftythree.challenges.support.ApiErrors;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * The Java replacement for {@code contentModeration}: per-entry approval.
 *
 * <p>Permissions are decided here, never in the UI:
 * <ul>
 *   <li>admins review every entry
 *   <li>a host reviews only entries on challenges their organisation owns,
 *       and only where that challenge is host-managed
 *   <li>nobody else can read the queue or decide anything
 * </ul>
 */
@RestController
public class ContentModerationController {

  private static final Logger log = LoggerFactory.getLogger(ContentModerationController.class);

  private static final Set<String> REVIEW_STATUSES = Set.of("approved", "rejected");

  private final EntryQueryRepository entries;
  private final ChallengeRepository challenges;
  private final HostChallengeQueryRepository hostChallenges;
  private final HostAccessService hostAccess;
  private final ComplianceAuditService audit;
  private final CallerResolver caller;
  private final ObjectMapper mapper;

  public ContentModerationController(
      EntryQueryRepository entries,
      ChallengeRepository challenges,
      HostChallengeQueryRepository hostChallenges,
      HostAccessService hostAccess,
      ComplianceAuditService audit,
      CallerResolver caller,
      ObjectMapper mapper) {
    this.entries = entries;
    this.challenges = challenges;
    this.hostChallenges = hostChallenges;
    this.hostAccess = hostAccess;
    this.audit = audit;
    this.caller = caller;
    this.mapper = mapper;
  }

  @PostMapping("/api/apps/{appId}/functions/contentModeration")
  public ResponseEntity<?> handle(@RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> request = body == null ? Map.of() : body;
    String sessionToken = str(request.get("session_token"));
    String email = caller.email(sessionToken);
    if (email == null) {
      return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
    }
    boolean isAdmin = caller.isAdmin(sessionToken);
    String action = str(request.get("action"));

    try {
      return switch (action) {
        case "queue" -> queue(request, email, isAdmin);
        case "decide" -> decide(request, email, isAdmin);
        default -> ResponseEntity.badRequest().body(Map.of("error", "Unknown action"));
      };
    } catch (Exception e) {
      log.error("contentModeration action '{}' failed", action, e);
      return ApiErrors.internal(e);
    }
  }

  private ResponseEntity<?> queue(Map<String, Object> request, String email, boolean isAdmin) {
    boolean hostScope = "host".equals(str(request.get("scope")));
    if (!hostScope && !isAdmin) {
      return ResponseEntity.status(403).body(Map.of("error", "Admin only"));
    }

    List<EntryEntity> pending;
    if (hostScope) {
      List<String> ids = hostManagedChallengeIds(email);
      pending = ids.isEmpty() ? List.of() : entries.findPendingForChallenges(ids);
    } else {
      pending = entries.findByStatus("pending");
    }

    // Challenge titles are resolved once each, not per entry.
    Map<String, String> titles = new HashMap<>();
    List<Map<String, Object>> items = new ArrayList<>();
    for (EntryEntity e : pending) {
      String cid = nz(e.getChallengeId());
      String title = titles.computeIfAbsent(cid, id -> challenges.findById(id)
          .map(ChallengeEntity::getTitle).orElse(""));

      Map<String, Object> item = new LinkedHashMap<>();
      item.put("id", e.getId());
      item.put("challenge_id", cid);
      item.put("challenge_title", firstNonBlank(e.getChallengeTitle(), title, "Challenge"));
      item.put("participant", nz(e.getCreatorName()));
      item.put("submitted_at", e.getSubmittedAt() != null ? e.getSubmittedAt() : e.getCreatedDate());
      item.put("title", e.getTitle());
      item.put("description", nz(e.getDescription()));
      item.put("work_text", nz(e.getWorkText()));
      item.put("work_link", nz(e.getWorkLink()));
      item.put("division", nz(e.getDivision()));
      item.put("state", nz(e.getState()));
      // Built field by field: the entry also carries the entrant's email and
      // their guardian's contact details, none of which a reviewer needs.
      items.add(item);
    }
    return ResponseEntity.ok(Map.of("entries", items, "count", items.size()));
  }

  private ResponseEntity<?> decide(Map<String, Object> request, String email, boolean isAdmin) {
    String entryId = str(request.get("entry_id"));
    String decision = str(request.get("decision"));
    String note = str(request.get("note")).trim();

    if (entryId.isEmpty() || !REVIEW_STATUSES.contains(decision)) {
      return ResponseEntity.badRequest()
          .body(Map.of("error", "entry_id and a valid decision are required"));
    }
    // A rejection with no reason leaves the participant nothing to act on.
    if ("rejected".equals(decision) && note.isEmpty()) {
      return ResponseEntity.badRequest()
          .body(Map.of("error", "Please give the participant a reason for the rejection."));
    }

    EntryEntity entry = entries.findById(entryId).orElse(null);
    if (entry == null) {
      return ResponseEntity.status(404).body(Map.of("error", "Entry not found"));
    }

    if (!isAdmin && !hostManagedChallengeIds(email).contains(nz(entry.getChallengeId()))) {
      return ResponseEntity.status(403).body(Map.of(
          "error", "You can only review content on your own host-managed challenges."));
    }

    Instant now = Instant.now();
    entry.setStatus(decision);
    entry.setReviewNote(note);
    entry.setReviewerId("");
    entry.setReviewerEmail(email);
    entry.setReviewedAt(now);
    entry.setModeratedAt(now);
    entry.setUpdatedDate(now);
    entries.save(entry);

    audit.event("content_reviewed", nz(entry.getChallengeId()), "", email,
        "Entry " + entryId + " " + decision + (note.isEmpty() ? "" : ": " + note)
            + " by " + (isAdmin ? "admin" : "host") + ".");

    Map<String, Object> safe = mapper.convertValue(
        entry, new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {});
    safe.remove("creator_email");
    return ResponseEntity.ok(Map.of("ok", true, "entry", safe));
  }

  /**
   * Challenges this host's organisation owns AND manages the content of.
   *
   * <p>Both conditions matter: owning a challenge whose content the 53 team
   * manages does not confer review rights over its entries.
   */
  private List<String> hostManagedChallengeIds(String email) {
    String organisationId = hostAccess.organisationIdFor(email);
    if (organisationId.isEmpty()) {
      return List.of();
    }
    return hostChallenges.findHostManagedIds(organisationId);
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
