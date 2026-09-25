package com.fiftythree.challenges.judging;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiftythree.challenges.admin.JudgeRepo;
import com.fiftythree.challenges.entity.CalibrationScoreEntity;
import com.fiftythree.challenges.entity.CalibrationScoreRepository;
import com.fiftythree.challenges.entity.EntryJudgeAssignmentEntity;
import com.fiftythree.challenges.entity.JudgeProfileEntity;
import com.fiftythree.challenges.entity.JudgingAuditLogEntity;
import com.fiftythree.challenges.entity.JudgingAuditLogRepository;
import com.fiftythree.challenges.entity.JudgingPanelEntity;
import com.fiftythree.challenges.entity.JudgingPanelRepository;
import com.fiftythree.challenges.entity.ScoreEntity;
import com.fiftythree.challenges.security.CallerResolver;
import com.fiftythree.challenges.support.JsonColumn;
import java.time.Instant;
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
 * The Java replacement for {@code judgeScoring}: the protected judging surface.
 *
 * <p>Judge identity, panel membership and entry allocation are always derived
 * from the authenticated session. A client-supplied {@code judge_profile_id} is
 * never trusted — it would let anyone score as any judge.
 *
 * <p><b>Entries reach judges blinded.</b> The assignment record carries its own
 * copy of the work and an anonymous id; the creator's name and email are never
 * part of any response here, which is what makes the judging anonymous rather
 * than merely presented as anonymous.
 */
@RestController
public class JudgeScoringController {

  private static final Logger log = LoggerFactory.getLogger(JudgeScoringController.class);

  private final JudgeRepo judges;
  private final JudgingPanelRepository panels;
  private final ScoreQueryRepository scores;
  private final AssignmentQueryRepository assignments;
  private final CalibrationScoreRepository calibrations;
  private final JudgingAuditLogRepository auditLog;
  private final CallerResolver caller;
  private final JsonColumn json;
  private final ObjectMapper mapper;

  public JudgeScoringController(
      JudgeRepo judges,
      JudgingPanelRepository panels,
      ScoreQueryRepository scores,
      AssignmentQueryRepository assignments,
      CalibrationScoreRepository calibrations,
      JudgingAuditLogRepository auditLog,
      CallerResolver caller,
      JsonColumn json,
      ObjectMapper mapper) {
    this.judges = judges;
    this.panels = panels;
    this.scores = scores;
    this.assignments = assignments;
    this.calibrations = calibrations;
    this.auditLog = auditLog;
    this.caller = caller;
    this.json = json;
    this.mapper = mapper;
  }

  @PostMapping("/api/apps/{appId}/functions/judgeScoring")
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
        case "is_judge" -> isJudge(email);
        case "workspace" -> workspace(email);
        case "submit" -> submit(request, email);
        case "submit_calibration" -> submitCalibration(request, email);
        case "flag" -> flag(request, email);
        case "admin_overview" -> isAdmin ? adminOverview() : forbidden();
        case "resolve_flag" -> isAdmin ? resolveFlag(request, email) : forbidden();
        default -> ResponseEntity.badRequest().body(Map.of("error", "Unknown action"));
      };
    } catch (Exception e) {
      log.error("judgeScoring action '{}' failed", action, e);
      return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
    }
  }

  private static ResponseEntity<?> forbidden() {
    return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
  }

  private ResponseEntity<?> isJudge(String email) {
    JudgeProfileEntity judge = activeJudge(email);
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("is_judge", judge != null);
    out.put("judge_name", judge == null ? "" : nz(judge.getName()));
    return ResponseEntity.ok(out);
  }

  private ResponseEntity<?> workspace(String email) {
    JudgeProfileEntity judge = activeJudge(email);
    if (judge == null) {
      Map<String, Object> empty = new LinkedHashMap<>();
      empty.put("judge", null);
      empty.put("panels", List.of());
      empty.put("assignments", List.of());
      empty.put("scores", List.of());
      return ResponseEntity.ok(empty);
    }

    List<JudgingPanelEntity> mine = panels.findAll().stream()
        .filter(p -> json.stringList(p.getJudgeProfileIds()).contains(judge.getId()))
        .toList();
    List<String> panelIds = mine.stream().map(JudgingPanelEntity::getId).toList();

    List<Map<String, Object>> panelRows = new ArrayList<>();
    for (JudgingPanelEntity p : mine) {
      Map<String, Object> row = new LinkedHashMap<>();
      row.put("id", p.getId());
      row.put("competition_title", firstNonBlank(p.getCompetitionTitle(), p.getCompetitionId()));
      row.put("competition_id", p.getCompetitionId());
      row.put("status", p.getStatus());
      row.put("criteria", rawJson(p.getCriteria()));
      row.put("scale_max", p.getScaleMax() == null ? 10 : p.getScaleMax());
      row.put("calibration_entry_ids", json.stringList(p.getCalibrationEntryIds()));
      row.put("is_head_judge", judge.getId().equals(p.getHeadJudgeProfileId()));
      panelRows.add(row);
    }

    // Blinded projection: only the assignment's own copy of the work is sent,
    // never the entry record, so no creator identity can leave the server.
    List<Map<String, Object>> assignmentRows = new ArrayList<>();
    for (EntryJudgeAssignmentEntity a : assignments.findByJudge(judge.getId())) {
      if (!panelIds.contains(a.getPanelId())) {
        continue;
      }
      Map<String, Object> row = new LinkedHashMap<>();
      row.put("id", a.getId());
      row.put("panel_id", a.getPanelId());
      row.put("entry_id", a.getEntryId());
      row.put("anonymous_id", a.getAnonymousId());
      row.put("work_type", a.getBlindWorkType());
      row.put("work_text", a.getBlindWorkText());
      row.put("work_link", a.getBlindWorkLink());
      assignmentRows.add(row);
    }

    List<Map<String, Object>> scoreRows = new ArrayList<>();
    for (ScoreEntity s : scores.findByJudge(judge.getId())) {
      Map<String, Object> row = new LinkedHashMap<>();
      row.put("id", s.getId());
      row.put("panel_id", s.getPanelId());
      row.put("entry_id", s.getEntryId());
      row.put("status", s.getStatus());
      row.put("scores", rawJson(s.getScores()));
      row.put("comments", rawJson(s.getComments()));
      row.put("compliance_flagged", Boolean.TRUE.equals(s.getComplianceFlagged()));
      row.put("compliance_reason", nz(s.getComplianceReason()));
      row.put("compliance_note", nz(s.getComplianceNote()));
      row.put("compliance_status", firstNonBlank(s.getComplianceStatus(), "none"));
      scoreRows.add(row);
    }

    List<Map<String, Object>> calibrationRows = new ArrayList<>();
    for (CalibrationScoreEntity c : calibrations.findAll()) {
      if (!judge.getId().equals(c.getJudgeProfileId())) {
        continue;
      }
      calibrationRows.add(Map.of(
          "id", c.getId(), "panel_id", nz(c.getPanelId()), "entry_id", nz(c.getEntryId())));
    }

    return ResponseEntity.ok(Map.of(
        "judge", Map.of("id", judge.getId(), "name", nz(judge.getName()), "email", nz(judge.getEmail())),
        "panels", panelRows,
        "assignments", assignmentRows,
        "scores", scoreRows,
        "calibration", calibrationRows));
  }

  private ResponseEntity<?> submit(Map<String, Object> request, String email) {
    JudgeProfileEntity judge = activeJudge(email);
    if (judge == null) {
      return ResponseEntity.status(403)
          .body(Map.of("error", "No active judge profile for this account."));
    }

    String panelId = str(request.get("panel_id"));
    String entryId = str(request.get("entry_id"));
    if (panelId.isEmpty() || entryId.isEmpty()) {
      return ResponseEntity.badRequest().body(Map.of("error", "panel_id and entry_id required"));
    }

    JudgingPanelEntity panel = panels.findById(panelId).orElse(null);
    if (panel == null) {
      return ResponseEntity.status(404).body(Map.of("error", "Panel not found"));
    }
    if (!json.stringList(panel.getJudgeProfileIds()).contains(judge.getId())) {
      return ResponseEntity.status(403).body(Map.of("error", "You are not a member of this panel."));
    }
    if (!"scoring".equals(nz(panel.getStatus()))) {
      return ResponseEntity.status(403).body(Map.of("error", "This panel is not open for scoring."));
    }

    // The allocation is the authority: no allocation, no score. Panel
    // membership alone is not enough, or a judge could score entries
    // deliberately kept away from them.
    EntryJudgeAssignmentEntity allocation =
        assignments.findAllocation(panelId, entryId, judge.getId()).stream()
            .findFirst().orElse(null);
    if (allocation == null) {
      return ResponseEntity.status(403).body(Map.of("error", "This entry is not allocated to you."));
    }

    ScoreEntity prior = scores.findOwn(panelId, entryId, judge.getId()).stream()
        .findFirst().orElse(null);
    if (prior != null && "submitted".equals(nz(prior.getStatus()))) {
      return ResponseEntity.status(409).body(Map.of("error", "You have already scored this entry."));
    }
    if (prior != null && "locked".equals(nz(prior.getStatus()))) {
      return ResponseEntity.status(403)
          .body(Map.of("error", "This score is locked and cannot be changed."));
    }

    Instant now = Instant.now();
    ScoreEntity score = prior == null ? new ScoreEntity() : prior;
    if (score.getId() == null) {
      score.setId(newId());
      score.setCreatedDate(now);
    }
    score.setPanelId(panelId);
    score.setEntryId(entryId);
    score.setAnonymousId(allocation.getAnonymousId());
    score.setJudgeProfileId(judge.getId());
    score.setJudgeName(judge.getName());
    score.setScores(writeJson(request.get("scores")));
    score.setComments(writeJson(request.get("comments")));
    score.setStatus("submitted");
    score.setSubmittedAt(now);
    score.setUpdatedDate(now);
    score.setIsSample(false);

    boolean flagged = truthy(request.get("compliance_flagged"));
    if (flagged) {
      score.setComplianceFlagged(true);
      score.setComplianceReason(firstNonBlank(str(request.get("compliance_reason")), "other"));
      score.setComplianceNote(str(request.get("compliance_note")));
      score.setComplianceStatus("open");
    }
    scores.save(score);

    audit(panelId, email, prior == null ? "score_submitted" : "score_resubmitted",
        nz(allocation.getAnonymousId()));
    if (flagged) {
      audit(panelId, email, "compliance_flag_raised",
          nz(allocation.getAnonymousId()) + ": " + nz(score.getComplianceReason()));
    }
    return ResponseEntity.ok(Map.of("success", true, "score_id", score.getId()));
  }

  private ResponseEntity<?> submitCalibration(Map<String, Object> request, String email) {
    JudgeProfileEntity judge = activeJudge(email);
    if (judge == null) {
      return ResponseEntity.status(403)
          .body(Map.of("error", "No active judge profile for this account."));
    }

    String panelId = str(request.get("panel_id"));
    String entryId = str(request.get("entry_id"));
    JudgingPanelEntity panel = panels.findById(panelId).orElse(null);
    if (panel == null) {
      return ResponseEntity.status(404).body(Map.of("error", "Panel not found"));
    }
    if (!json.stringList(panel.getJudgeProfileIds()).contains(judge.getId())) {
      return ResponseEntity.status(403).body(Map.of("error", "You are not a member of this panel."));
    }
    // Calibration samples are chosen deliberately; scoring anything else as
    // calibration would distort the baseline the panel is measured against.
    if (!json.stringList(panel.getCalibrationEntryIds()).contains(entryId)) {
      return ResponseEntity.status(403)
          .body(Map.of("error", "That is not a calibration sample for this panel."));
    }

    Instant now = Instant.now();
    CalibrationScoreEntity c = new CalibrationScoreEntity();
    c.setId(newId());
    c.setPanelId(panelId);
    c.setJudgeProfileId(judge.getId());
    c.setJudgeName(judge.getName());
    c.setEntryId(entryId);
    c.setScores(writeJson(request.get("scores")));
    c.setComments("");
    c.setAt(now);
    c.setCreatedDate(now);
    c.setUpdatedDate(now);
    c.setIsSample(false);
    calibrations.save(c);

    audit(panelId, email, "calibration_score_submitted", entryId);
    return ResponseEntity.ok(Map.of("success", true));
  }

  private ResponseEntity<?> flag(Map<String, Object> request, String email) {
    JudgeProfileEntity judge = activeJudge(email);
    if (judge == null) {
      return ResponseEntity.status(403)
          .body(Map.of("error", "No active judge profile for this account."));
    }
    String panelId = str(request.get("panel_id"));
    String entryId = str(request.get("entry_id"));
    ScoreEntity score = scores.findOwn(panelId, entryId, judge.getId()).stream()
        .findFirst().orElse(null);
    if (score == null) {
      return ResponseEntity.status(404).body(Map.of("error", "Score this entry before flagging it."));
    }

    score.setComplianceFlagged(true);
    score.setComplianceReason(firstNonBlank(str(request.get("compliance_reason")), "other"));
    score.setComplianceNote(str(request.get("compliance_note")));
    score.setComplianceStatus("open");
    score.setUpdatedDate(Instant.now());
    scores.save(score);

    audit(panelId, email, "compliance_flag_raised",
        nz(score.getAnonymousId()) + ": " + nz(score.getComplianceReason()));
    return ResponseEntity.ok(Map.of("success", true));
  }

  private ResponseEntity<?> adminOverview() {
    List<ScoreEntity> allScores = scores.findAll();
    List<EntryJudgeAssignmentEntity> allAllocations = assignments.findAll();

    List<Map<String, Object>> progress = new ArrayList<>();
    for (JudgingPanelEntity p : panels.findAll()) {
      long allocated = allAllocations.stream()
          .filter(a -> p.getId().equals(a.getPanelId())).count();
      long done = allScores.stream()
          .filter(s -> p.getId().equals(s.getPanelId()) && "submitted".equals(nz(s.getStatus())))
          .count();
      Map<String, Object> row = new LinkedHashMap<>();
      row.put("id", p.getId());
      row.put("title", firstNonBlank(p.getCompetitionTitle(), p.getCompetitionId()));
      row.put("status", p.getStatus());
      row.put("judges", json.stringList(p.getJudgeProfileIds()).size());
      row.put("allocated", allocated);
      row.put("done", done);
      progress.add(row);
    }

    List<Map<String, Object>> flags = new ArrayList<>();
    for (ScoreEntity s : allScores) {
      if (!Boolean.TRUE.equals(s.getComplianceFlagged())
          || !"open".equals(nz(s.getComplianceStatus()))) {
        continue;
      }
      Map<String, Object> row = new LinkedHashMap<>();
      row.put("id", s.getId());
      row.put("panel_id", s.getPanelId());
      row.put("anonymous_id", s.getAnonymousId());
      row.put("judge_name", s.getJudgeName());
      row.put("reason", s.getComplianceReason());
      row.put("note", s.getComplianceNote());
      row.put("raised_at", s.getSubmittedAt() != null ? s.getSubmittedAt() : s.getCreatedDate());
      flags.add(row);
    }

    return ResponseEntity.ok(Map.of("progress", progress, "flags", flags));
  }

  private ResponseEntity<?> resolveFlag(Map<String, Object> request, String email) {
    String scoreId = str(request.get("score_id"));
    if (scoreId.isEmpty()) {
      return ResponseEntity.badRequest().body(Map.of("error", "score_id required"));
    }
    ScoreEntity score = scores.findById(scoreId).orElse(null);
    if (score == null) {
      return ResponseEntity.status(404).body(Map.of("error", "Score not found"));
    }
    // Anything that is not an explicit "upheld" is a dismissal — the original
    // defaulted the same way, so an unrecognised value cannot uphold a flag.
    String decision = "upheld".equals(str(request.get("decision"))) ? "upheld" : "dismissed";

    score.setComplianceStatus(decision);
    score.setComplianceResolvedBy(email);
    score.setComplianceResolvedAt(Instant.now());
    score.setUpdatedDate(Instant.now());
    scores.save(score);

    audit(nz(score.getPanelId()), email, "compliance_flag_resolved",
        nz(score.getAnonymousId()) + ": " + decision);
    return ResponseEntity.ok(Map.of("success", true));
  }

  /** The active judge profile for an address, or null. */
  private JudgeProfileEntity activeJudge(String email) {
    return judges.findByEmail(email, org.springframework.data.domain.Limit.of(5)).stream()
        .filter(p -> "active".equals(nz(p.getStatus())))
        .findFirst()
        .orElse(null);
  }

  private void audit(String panelId, String actor, String action, String detail) {
    try {
      Instant now = Instant.now();
      JudgingAuditLogEntity row = new JudgingAuditLogEntity();
      row.setId(newId());
      row.setPanelId(nz(panelId));
      row.setActor(firstNonBlank(actor, "system"));
      row.setAction(action);
      row.setDetail(nz(detail));
      row.setAt(now);
      row.setCreatedDate(now);
      row.setUpdatedDate(now);
      row.setIsSample(false);
      auditLog.save(row);
    } catch (Exception e) {
      // The audit trail matters, but losing a row must not lose the score the
      // judge just submitted.
      log.error("Could not write judging audit row for panel {}: {}", panelId, e.toString());
    }
  }

  /** A JSON column returned to the client as structure, not as a string. */
  private Object rawJson(String stored) {
    if (stored == null || stored.isBlank()) {
      return List.of();
    }
    try {
      return mapper.readTree(stored);
    } catch (Exception e) {
      return List.of();
    }
  }

  private String writeJson(Object value) {
    try {
      return value instanceof List<?> ? mapper.writeValueAsString(value) : "[]";
    } catch (Exception e) {
      return "[]";
    }
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

  private static String newId() {
    return UUID.randomUUID().toString().replace("-", "").substring(0, 24);
  }
}
