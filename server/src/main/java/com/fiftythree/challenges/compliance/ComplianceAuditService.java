package com.fiftythree.challenges.compliance;

import com.fiftythree.challenges.entity.ComplianceAuditEventEntity;
import com.fiftythree.challenges.entity.ComplianceAuditEventRepository;
import com.fiftythree.challenges.entity.ComplianceGateLogEntity;
import com.fiftythree.challenges.entity.ComplianceGateLogRepository;
import java.time.Instant;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * The compliance audit trail.
 *
 * <p>These records exist to show, after the fact, why a participation was
 * refused — which matters most for entries by children. Writing one must never
 * be able to change the outcome of the request that triggered it, so every
 * method here swallows its own failures and logs them instead. A refusal that
 * fails to record is a gap in the audit trail; a refusal that turns into a 500
 * because the audit write failed is a worse outcome for the person entering.
 */
@Service
public class ComplianceAuditService {

  private static final Logger log = LoggerFactory.getLogger(ComplianceAuditService.class);

  private final ComplianceAuditEventRepository events;
  private final ComplianceGateLogRepository gateLogs;

  public ComplianceAuditService(
      ComplianceAuditEventRepository events, ComplianceGateLogRepository gateLogs) {
    this.events = events;
    this.gateLogs = gateLogs;
  }

  /** Records that a participation was denied, and why. */
  public void participationDenied(
      String challengeId, String actorId, String actorEmail, String detail) {
    event("participation_denied", challengeId, actorId, actorEmail, detail);
  }

  public void event(
      String eventType, String challengeId, String actorId, String actorEmail, String detail) {
    findingEvent(eventType, challengeId, null, actorId, actorEmail, detail);
  }

  /**
   * An audit event tied to one compliance finding.
   *
   * <p>The finding id matters when the trail is read back: "a finding was
   * re-opened" is useless without knowing which, and these events are the
   * record of why a gate re-locked.
   */
  public void findingEvent(
      String eventType,
      String challengeId,
      String findingId,
      String actorId,
      String actorEmail,
      String detail) {
    fullEvent(eventType, challengeId, null, findingId, actorId, actorEmail, detail);
  }

  /** An audit event tied to one assessment run rather than to a single finding. */
  public void assessmentEvent(
      String eventType,
      String challengeId,
      String assessmentId,
      String actorId,
      String actorEmail,
      String detail) {
    fullEvent(eventType, challengeId, assessmentId, null, actorId, actorEmail, detail);
  }

  /**
   * The full form, naming both the assessment that produced a finding and the
   * finding itself. Reading the trail back, "which run created this
   * obligation" is the question that gets asked.
   */
  public void fullEvent(
      String eventType,
      String challengeId,
      String assessmentId,
      String findingId,
      String actorId,
      String actorEmail,
      String detail) {
    try {
      ComplianceAuditEventEntity row = new ComplianceAuditEventEntity();
      row.setId(newId());
      row.setEventType(eventType);
      row.setAssessmentId(nz(assessmentId));
      row.setFindingId(nz(findingId));
      row.setChallengeId(nz(challengeId));
      row.setActorId(nz(actorId));
      row.setActorEmail(nz(actorEmail));
      row.setDetail(nz(detail));
      row.setCreatedDate(Instant.now());
      row.setUpdatedDate(Instant.now());
      row.setIsSample(false);
      events.save(row);
    } catch (Exception e) {
      log.error("Could not write compliance audit event '{}' for challenge {}: {}",
          eventType, challengeId, e.toString());
    }
  }

  /**
   * Records a gate-level action against the gate log.
   *
   * <p>{@code actorEmail} is who did it. These two columns were written as
   * empty strings and the signature had nowhere to put anything else, so the
   * gate log recorded that a participation was refused without recording who
   * refused it or who tried. For a trail that exists to answer questions
   * about children's participation afterwards, that is most of the answer
   * missing.
   *
   * <p>Pass an empty string only where there genuinely is no actor.
   */
  public void gateLog(String gateId, String challengeId, String action, String fieldName,
      String note, String actorEmail) {
    try {
      ComplianceGateLogEntity row = new ComplianceGateLogEntity();
      row.setId(newId());
      row.setGateId(nz(gateId));
      row.setChallengeId(nz(challengeId));
      row.setAction(action == null || action.isBlank() ? "field_change" : action);
      row.setFieldName(nz(fieldName));
      row.setOldValue("");
      row.setNewValue("");
      row.setChangedById("");
      row.setChangedByEmail(nz(actorEmail));
      row.setNote(nz(note));
      row.setCreatedDate(Instant.now());
      row.setUpdatedDate(Instant.now());
      row.setIsSample(false);
      gateLogs.save(row);
    } catch (Exception e) {
      log.error("Could not write compliance gate log for challenge {}: {}", challengeId, e.toString());
    }
  }

  private static String nz(String v) {
    return v == null ? "" : v;
  }

  private static String newId() {
    return UUID.randomUUID().toString().replace("-", "").substring(0, 24);
  }
}
