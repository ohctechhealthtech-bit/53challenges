package com.fiftythree.challenges.compliance;

import com.fiftythree.challenges.entity.ComplianceAssessmentFindingEntity;
import com.fiftythree.challenges.entity.GateCheckEntity;
import com.fiftythree.challenges.entity.ObligationEvidenceEntity;
import com.fiftythree.challenges.entity.PermitActionEntity;
import com.fiftythree.challenges.entity.PermitOrAuthorityEntity;
import com.fiftythree.challenges.lifecycle.GateCheckQueryRepository;
import com.fiftythree.challenges.support.JsonColumn;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Trade-promotion permits and the compliance findings they satisfy.
 *
 * <p>Running a prize competition without the right permit is unlawful in
 * several Australian jurisdictions, so the rules here are deliberately strict:
 * an expired instrument satisfies nothing, validity is re-checked at every gate
 * evaluation rather than only when a permit is linked, and an expiring permit
 * re-locks the gates on every challenge it covered.
 */
@Service
public class PermitService {

  private static final Logger log = LoggerFactory.getLogger(PermitService.class);

  /** How far ahead an expiry is flagged, so there is time to renew. */
  public static final int EXPIRY_LEAD_DAYS = 60;

  /** Business days before entry opens by which the regulator must be notified. */
  public static final int NOTIFICATION_LEAD_BUSINESS_DAYS = 10;

  /** Statuses in which an instrument is capable of being valid. */
  private static final Set<String> USABLE_STATUSES = Set.of("active", "issued");

  /** Finding states that still count as unresolved. */
  private static final Set<String> OPEN_FINDING_STATUSES = Set.of("open", "routed");

  private final PermitQueryRepository permits;
  private final PermitActionQueryRepository actions;
  private final ObligationEvidenceQueryRepository evidence;
  private final FindingQueryRepository findings;
  private final GateCheckQueryRepository gateChecks;
  private final ComplianceAuditService audit;
  private final JsonColumn json;

  public PermitService(
      PermitQueryRepository permits,
      PermitActionQueryRepository actions,
      ObligationEvidenceQueryRepository evidence,
      FindingQueryRepository findings,
      GateCheckQueryRepository gateChecks,
      ComplianceAuditService audit,
      JsonColumn json) {
    this.permits = permits;
    this.actions = actions;
    this.evidence = evidence;
    this.findings = findings;
    this.gateChecks = gateChecks;
    this.audit = audit;
    this.json = json;
  }

  /**
   * Whether an instrument actually authorises this challenge today.
   *
   * <p>Status, coverage and both dates all have to hold. A permit that has
   * expired, been refused or surrendered authorises nothing, and one that has
   * not yet taken effect does not authorise anything yet either.
   */
  public boolean isValid(PermitOrAuthorityEntity permit, String challengeId) {
    if (permit == null || !USABLE_STATUSES.contains(nz(permit.getStatus()))) {
      return false;
    }
    List<String> covered = json.stringList(permit.getCoveredChallenges());
    // An empty list means the instrument covers everything; a non-empty one
    // must name this challenge.
    if (!covered.isEmpty() && !covered.contains(challengeId)) {
      return false;
    }
    LocalDate today = LocalDate.now(ZoneOffset.UTC);
    LocalDate expiry = permit.getExpiryDate();
    if (expiry != null && expiry.isBefore(today)) {
      return false;
    }
    LocalDate effective = permit.getEffectiveDate();
    return effective == null || !effective.isAfter(today);
  }

  /**
   * An NT finding satisfied by a valid permit held in another jurisdiction.
   *
   * <p>The Northern Territory recognises interstate permits, so a finding there
   * can be met by an instrument issued elsewhere — recorded as evidence naming
   * which one, so the basis is auditable rather than implicit.
   */
  public Map<String, Object> checkCrossRecognition(String challengeId, String actorEmail) {
    List<ComplianceAssessmentFindingEntity> open =
        findings.findOpenPermitFindings(challengeId, "NT");

    int recognised = 0;
    for (ComplianceAssessmentFindingEntity f : open) {
      PermitOrAuthorityEntity covering = permits.findUsable().stream()
          .filter(p -> !"NT".equals(nz(p.getJurisdictionCode())))
          .filter(p -> isValid(p, challengeId))
          .findFirst()
          .orElse(null);
      if (covering == null) {
        continue;
      }

      recordEvidence(f.getId(), "authority_reference", covering.getId(),
          "NT cross-recognition: covered by " + nz(covering.getJurisdictionCode())
              + " permit " + nz(covering.getReferenceNumber()) + ".",
          actorEmail);

      f.setStatus("satisfied");
      f.setUpdatedDate(Instant.now());
      findings.save(f);
      recognised++;

      audit.event("evidence_linked", challengeId, "", actorEmail,
          "NT finding for " + nz(f.getRuleCode()) + " auto-satisfied via cross-recognition with "
              + nz(covering.getJurisdictionCode()) + " permit "
              + nz(covering.getReferenceNumber()) + ".");
    }
    return Map.of("recognized", recognised, "checked", open.size());
  }

  /**
   * Marks expired and soon-to-expire instruments, and overdue actions.
   *
   * <p>Expiry is not passive: it re-opens the findings the instrument was
   * satisfying and returns the affected challenges so their gates can be
   * re-locked. A permit lapsing quietly while a competition keeps running is
   * exactly the failure this prevents.
   */
  public Map<String, Object> checkExpiring(String actorEmail) {
    LocalDate today = LocalDate.now(ZoneOffset.UTC);
    LocalDate leadDate = today.plusDays(EXPIRY_LEAD_DAYS);

    List<String> expired = new ArrayList<>();
    List<String> expiringSoon = new ArrayList<>();
    Set<String> affected = new LinkedHashSet<>();

    for (PermitOrAuthorityEntity permit : permits.findUsable()) {
      LocalDate expiry = permit.getExpiryDate();
      if (expiry == null) {
        continue;
      }
      if (expiry.isBefore(today)) {
        permit.setStatus("expired");
        permit.setUpdatedDate(Instant.now());
        permits.save(permit);
        expired.add(permit.getId());
        affected.addAll(json.stringList(permit.getCoveredChallenges()));
        reopenFindingsFor(permit, actorEmail);
      } else if (!expiry.isAfter(leadDate)) {
        permit.setStatus("expiring_soon");
        permit.setUpdatedDate(Instant.now());
        permits.save(permit);
        expiringSoon.add(permit.getId());
      }
    }

    List<String> overdue = new ArrayList<>();
    for (PermitActionEntity action : actions.findPending()) {
      LocalDate due = action.getDueDate();
      // An action with no due date is never overdue — there is nothing to be
      // late against, and defaulting it to "today" would mark every undated
      // action overdue the moment this runs.
      if (due != null && due.isBefore(today)) {
        action.setStatus("overdue");
        action.setUpdatedDate(Instant.now());
        actions.save(action);
        overdue.add(action.getId());
        if (!nz(action.getChallengeId()).isEmpty()) {
          affected.add(action.getChallengeId());
        }
      }
    }

    for (String challengeId : affected) {
      relockGatesWithOpenFindings(challengeId, actorEmail);
    }

    return Map.of(
        "expired", expired.size(),
        "expiring_soon", expiringSoon.size(),
        "overdue_actions", overdue.size(),
        "affected_challenges", new ArrayList<>(affected));
  }

  /**
   * Queues the regulator notifications a NSW multi-year authority requires.
   *
   * <p>A multi-year authority covers a competition without a per-competition
   * permit, but the regulator still has to be told before entries open. That
   * notice is a task with a deadline, not a state, so it becomes a
   * {@code PermitAction} the entry gate then refuses to open around.
   *
   * @return how many actions were created
   */
  public int createNotificationActions(String challengeId, Instant entryOpenDate, String actorEmail) {
    if (findings.findPermitFindingsForJurisdiction(challengeId, "NSW").isEmpty()) {
      return 0;
    }

    LocalDate dueDate = entryOpenDate == null
        ? null
        : businessDaysBefore(entryOpenDate.atZone(ZoneOffset.UTC).toLocalDate(),
            NOTIFICATION_LEAD_BUSINESS_DAYS);

    int created = 0;
    for (PermitOrAuthorityEntity permit : permits.findMultiYearAuthorities("NSW")) {
      List<String> covered = json.stringList(permit.getCoveredChallenges());
      // An empty list means the authority covers everything, which is how a
      // blanket authority is recorded — not that it covers nothing.
      if (!covered.isEmpty() && !covered.contains(challengeId)) {
        continue;
      }
      if (!actions.findNotification(permit.getId(), challengeId).isEmpty()) {
        continue;
      }

      Instant now = Instant.now();
      PermitActionEntity action = new PermitActionEntity();
      action.setId(newId());
      action.setInstrumentId(permit.getId());
      action.setChallengeId(challengeId);
      action.setActionType("notify_regulator");
      action.setDueDate(dueDate);
      action.setStatus("pending");
      action.setNotes("Auto-created: NSW multi-year authority "
          + nz(permit.getReferenceNumber()) + " covers this challenge.");
      action.setCreatedDate(now);
      action.setUpdatedDate(now);
      action.setIsSample(false);
      actions.save(action);
      created++;
    }
    return created;
  }

  /**
   * Counts back whole business days from a date, skipping weekends.
   *
   * <p>Public holidays are not excluded — the original did not either, and
   * guessing at eight jurisdictions' holiday calendars would produce a deadline
   * that looks authoritative and is wrong. The lead time has slack for it.
   */
  static LocalDate businessDaysBefore(LocalDate target, int businessDays) {
    LocalDate date = target;
    int counted = 0;
    while (counted < businessDays) {
      date = date.minusDays(1);
      DayOfWeek day = date.getDayOfWeek();
      if (day != DayOfWeek.SATURDAY && day != DayOfWeek.SUNDAY) {
        counted++;
      }
    }
    return date;
  }

  /**
   * Re-checks permit findings that were marked satisfied, and re-opens any
   * whose permit no longer holds up.
   *
   * <p>"Satisfied" is a snapshot, not a guarantee: the permit behind it can
   * expire, be withdrawn, or be re-scoped to other challenges. Every gate
   * screen calls this before it evaluates, so a lapsed permit re-locks the
   * gate rather than sitting in the database looking settled.
   *
   * @return the ids of the findings re-opened
   */
  public List<String> recheckPermitFindings(String challengeId, String actorId, String actorEmail) {
    List<String> reopened = new ArrayList<>();

    for (ComplianceAssessmentFindingEntity finding
        : findings.findSatisfiedPermitFindings(challengeId)) {

      boolean hasValidPermit = false;
      for (ObligationEvidenceEntity ev : evidence.findByFinding(finding.getId())) {
        String permitId = nz(ev.getFileRecord());
        if (permitId.isEmpty()) {
          continue;
        }
        if (permits.findById(permitId).map(p -> isValid(p, challengeId)).orElse(false)) {
          hasValidPermit = true;
          break;
        }
      }
      if (hasValidPermit) {
        continue;
      }

      finding.setStatus("open");
      finding.setUpdatedDate(Instant.now());
      findings.save(finding);
      reopened.add(finding.getId());

      audit.findingEvent("finding_updated", challengeId, finding.getId(), actorId, actorEmail,
          "Permit-required finding for " + nz(finding.getRuleCode())
              + " re-opened: linked permit is no longer valid.");
    }

    return reopened;
  }

  /**
   * Re-locks the gates on a challenge that has open blocking findings.
   *
   * <p>Any open blocking finding re-locks {@code review_to_approved} and so
   * every later stage that depends on it; findings tied to a specific
   * obligation gate also re-lock that stage directly.
   */
  public List<String> relockGatesWithOpenFindings(String challengeId, String actorEmail) {
    List<ComplianceAssessmentFindingEntity> open =
        findings.findOpenBlockingFor(challengeId, OPEN_FINDING_STATUSES);
    if (open.isEmpty()) {
      return List.of();
    }

    Set<String> toRelock = new LinkedHashSet<>();
    toRelock.add("review_to_approved");
    for (ComplianceAssessmentFindingEntity f : open) {
      if ("open_entry".equals(nz(f.getGate()))) {
        toRelock.add("entry_open");
      }
      if ("open_voting".equals(nz(f.getGate()))) {
        toRelock.add("voting_open");
      }
    }

    List<String> relocked = new ArrayList<>();
    for (String gateCode : toRelock) {
      GateCheckEntity check = gateChecks.findLatest(challengeId, gateCode)
          .stream().findFirst().orElse(null);
      if (check == null || !"passed".equals(nz(check.getStatus()))) {
        continue;
      }
      check.setStatus("blocked");
      check.setRelockedReason(
          "Open blocking finding detected during assessment re-evaluation.");
      check.setUpdatedDate(Instant.now());
      gateChecks.save(check);
      relocked.add(gateCode);

      audit.event("finding_updated", challengeId, "", actorEmail,
          "Gate " + gateCode + " re-locked: an open blocking finding exists.");
    }
    return relocked;
  }

  /** Re-opens findings that an expired instrument was satisfying. */
  private void reopenFindingsFor(PermitOrAuthorityEntity permit, String actorEmail) {
    for (ObligationEvidenceEntity ev : evidence.findByFileRecord(permit.getId())) {
      ComplianceAssessmentFindingEntity finding =
          findings.findById(nz(ev.getFindingId())).orElse(null);
      if (finding == null || !"satisfied".equals(nz(finding.getStatus()))) {
        continue;
      }
      finding.setStatus("open");
      finding.setUpdatedDate(Instant.now());
      findings.save(finding);

      audit.event("finding_updated", nz(finding.getChallengeId()), "", actorEmail,
          "Finding for " + nz(finding.getRuleCode()) + " re-opened: permit "
              + nz(permit.getReferenceNumber()) + " has expired.");
    }
  }

  /** Records a piece of evidence against a finding. */
  public ObligationEvidenceEntity recordEvidence(
      String findingId, String type, String fileRecord, String description, String actorEmail) {
    Instant now = Instant.now();
    ObligationEvidenceEntity ev = new ObligationEvidenceEntity();
    ev.setId(newId());
    ev.setFindingId(findingId);
    ev.setEvidenceType(type);
    ev.setFileRecord(fileRecord);
    ev.setDescription(description);
    ev.setRecordedBy(actorEmail);
    ev.setRecordedAt(now);
    ev.setCreatedDate(now);
    ev.setUpdatedDate(now);
    ev.setIsSample(false);
    return evidence.save(ev);
  }

  /** A 24-character hex id, the shape Base44 gave every record. */
  private static String newId() {
    return UUID.randomUUID().toString().replace("-", "").substring(0, 24);
  }

  private static String nz(String v) {
    return v == null ? "" : v;
  }
}
