package com.fiftythree.challenges.vote;

import com.fiftythree.challenges.entity.VoteAuditLogEntity;
import com.fiftythree.challenges.entity.VoteAuditLogRepository;
import com.fiftythree.challenges.security.CallerResolver;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * The Java replacement for {@code detectVoteFraud}.
 *
 * <p>Flags votes as excluded, with a recorded justification, on two signals:
 * several accounts on one entry that normalise to the same inbox, and an hour
 * window holding an implausible share of an entry's votes.
 *
 * <p>Flagging is reversible — an admin can restore a false positive — and every
 * exclusion writes a VoteAuditLog row saying why. That matters because this
 * removes votes from a competition result, so "the system decided" is not an
 * acceptable answer to an entrant asking what happened.
 */
@RestController
public class VoteFraudController {

  private static final Logger log = LoggerFactory.getLogger(VoteFraudController.class);

  /**
   * Thresholds are fixed, never taken from the request. A caller who could
   * choose them could flag a rival's votes by passing a ratio of zero.
   */
  private static final int SPIKE_HOUR_THRESHOLD = 10;
  private static final double SPIKE_RATIO = 0.5;

  private static final DateTimeFormatter HOUR_KEY =
      DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH").withZone(ZoneOffset.UTC);

  private final VoteRepository votes;
  private final VoteAuditLogRepository auditLog;
  private final CallerResolver caller;

  public VoteFraudController(
      VoteRepository votes, VoteAuditLogRepository auditLog, CallerResolver caller) {
    this.votes = votes;
    this.auditLog = auditLog;
    this.caller = caller;
  }

  @PostMapping("/api/apps/{appId}/functions/detectVoteFraud")
  public ResponseEntity<?> handle(@RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> request = body == null ? Map.of() : body;
    if (!caller.isAdmin(str(request.get("session_token")))) {
      return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
    }

    String challengeId = str(request.get("challenge_id"));

    try {
      List<VoteEntity> scanned = challengeId.isEmpty()
          ? votes.findAll()
          : votes.findByChallengeId(challengeId);

      Map<String, List<VoteEntity>> byEntry = new LinkedHashMap<>();
      for (VoteEntity v : scanned) {
        byEntry.computeIfAbsent(nz(v.getEntryId()), k -> new ArrayList<>()).add(v);
      }

      Instant now = Instant.now();
      List<VoteAuditLogEntity> audits = new ArrayList<>();
      int duplicates = 0;
      int spikes = 0;

      for (Map.Entry<String, List<VoteEntity>> group : byEntry.entrySet()) {
        String entryId = group.getKey();
        List<VoteEntity> entryVotes = group.getValue();

        duplicates += flagDuplicateAccounts(entryId, entryVotes, challengeId, now, audits);
        spikes += flagSpikes(entryId, entryVotes, challengeId, now, audits);
      }

      if (!audits.isEmpty()) {
        auditLog.saveAll(audits);
      }

      return ResponseEntity.ok(Map.of(
          "success", true,
          "scanned", scanned.size(),
          "flagged", duplicates + spikes,
          "byReason", Map.of("duplicate_account", duplicates, "vote_spike", spikes)));
    } catch (Exception e) {
      log.error("detectVoteFraud failed for challenge {}", challengeId, e);
      return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
    }
  }

  /** Several accounts on one entry resolving to the same real inbox. */
  private int flagDuplicateAccounts(
      String entryId, List<VoteEntity> entryVotes, String challengeId,
      Instant now, List<VoteAuditLogEntity> audits) {

    Map<String, List<VoteEntity>> byInbox = new LinkedHashMap<>();
    for (VoteEntity v : entryVotes) {
      byInbox.computeIfAbsent(normaliseEmail(v.getUserEmail()), k -> new ArrayList<>()).add(v);
    }

    int flagged = 0;
    for (Map.Entry<String, List<VoteEntity>> group : byInbox.entrySet()) {
      if (group.getValue().size() <= 1) {
        continue;
      }
      // Every vote in the group is flagged, including the first: there is no
      // way to tell which account was the genuine one.
      for (VoteEntity v : group.getValue()) {
        if (Boolean.TRUE.equals(v.getExcluded())) {
          continue;
        }
        exclude(v, now, "duplicate_account", "Duplicate account: " + group.getValue().size()
            + " accounts on entry " + entryId + " share inbox " + group.getKey());
        audits.add(audit(v, challengeId, entryId, "duplicate_detected",
            "Inbox " + group.getKey() + " used by " + group.getValue().size()
                + " accounts on entry " + entryId, now));
        flagged++;
      }
    }
    return flagged;
  }

  /** An hour holding an implausible share of an entry's votes. */
  private int flagSpikes(
      String entryId, List<VoteEntity> entryVotes, String challengeId,
      Instant now, List<VoteAuditLogEntity> audits) {

    if (entryVotes.size() < SPIKE_HOUR_THRESHOLD) {
      return 0;
    }

    Map<String, List<VoteEntity>> byHour = new LinkedHashMap<>();
    for (VoteEntity v : entryVotes) {
      if (v.getCreatedDate() == null) {
        continue;
      }
      byHour.computeIfAbsent(HOUR_KEY.format(v.getCreatedDate()), k -> new ArrayList<>()).add(v);
    }

    int flagged = 0;
    for (Map.Entry<String, List<VoteEntity>> hour : byHour.entrySet()) {
      double ratio = hour.getValue().size() / (double) entryVotes.size();
      if (hour.getValue().size() < SPIKE_HOUR_THRESHOLD || ratio <= SPIKE_RATIO) {
        continue;
      }
      long percent = Math.round(ratio * 100);
      for (VoteEntity v : hour.getValue()) {
        if (Boolean.TRUE.equals(v.getExcluded())) {
          continue;
        }
        exclude(v, now, "vote_spike", "Vote spike: " + hour.getValue().size()
            + " votes in hour " + hour.getKey() + " (" + percent + "% of entry total)");
        audits.add(audit(v, challengeId, entryId, "spike_detected",
            hour.getValue().size() + " votes in hour " + hour.getKey()
                + " on entry " + entryId + " (" + percent + "% of total)", now));
        flagged++;
      }
    }
    return flagged;
  }

  private void exclude(VoteEntity v, Instant now, String flagType, String reason) {
    v.setExcluded(true);
    v.setExcludedReason(reason);
    v.setExcludedAt(now);
    v.setExcludedBy("system");
    v.setFlagType(flagType);
    v.setUpdatedDate(now);
    votes.save(v);
  }

  private static VoteAuditLogEntity audit(
      VoteEntity v, String challengeId, String entryId,
      String action, String reason, Instant now) {
    VoteAuditLogEntity row = new VoteAuditLogEntity();
    row.setId(UUID.randomUUID().toString().replace("-", "").substring(0, 24));
    row.setVoteId(v.getId());
    row.setChallengeId(firstNonBlank(v.getChallengeId(), challengeId));
    row.setEntryId(entryId);
    row.setActor("system");
    row.setAction(action);
    row.setReason(reason);
    row.setAt(now);
    row.setCreatedDate(now);
    row.setUpdatedDate(now);
    row.setIsSample(false);
    return row;
  }

  /**
   * The real inbox an address delivers to.
   *
   * <p>Gmail ignores dots and everything after a plus, so
   * {@code a.b+vote2@gmail.com} and {@code ab@gmail.com} are one mailbox. Other
   * providers commonly honour plus-addressing but not dots, so only the plus
   * part is stripped for them — treating dots as insignificant elsewhere would
   * merge genuinely different people.
   */
  static String normaliseEmail(String email) {
    String e = email == null ? "" : email.trim().toLowerCase();
    int at = e.indexOf('@');
    if (at < 0) {
      return e;
    }
    String local = e.substring(0, at);
    String domain = e.substring(at + 1);
    if ("gmail.com".equals(domain) || "googlemail.com".equals(domain)) {
      local = local.replace(".", "");
    }
    int plus = local.indexOf('+');
    if (plus >= 0) {
      local = local.substring(0, plus);
    }
    return local + "@" + domain;
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
