package com.fiftythree.challenges.lifecycle;

import com.fasterxml.jackson.databind.JsonNode;
import com.fiftythree.challenges.compliance.PermitService;
import com.fiftythree.challenges.entity.ComplianceGateEntity;
import com.fiftythree.challenges.entity.GateCheckEntity;
import com.fiftythree.challenges.entity.LifecycleGateEntity;
import com.fiftythree.challenges.security.CallerResolver;
import com.fiftythree.challenges.upstream.ChallengeApiClient;
import com.fiftythree.challenges.user.UserRepository;
import com.fiftythree.challenges.support.ApiErrors;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
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
 * The Java replacement for {@code lifecycleGate}: the admin screen that drives
 * a challenge through its stage gates.
 *
 * <ul>
 *   <li>{@code list_gates} — the gate reference data (any signed-in caller)
 *   <li>{@code gate_status} — every gate for one challenge, with a live
 *       evaluation of each (any signed-in caller)
 *   <li>{@code check_gate} — evaluate one gate and audit-log it (any caller)
 *   <li>{@code pass_gate} — pass a gate (admin)
 *   <li>{@code evaluate_all} — evaluate every upstream challenge against the
 *       gates and grandfather the ones already live (admin)
 * </ul>
 *
 * <p>Reading a gate is not a neutral act here: every action re-checks permit
 * findings first, so a permit that lapsed since the last assessment re-opens
 * its finding and re-locks the gate before anything is reported as passable.
 * Skipping that would let an admin pass a gate against stale evidence.
 */
@RestController
public class LifecycleGateController {

  private static final Logger log = LoggerFactory.getLogger(LifecycleGateController.class);

  private final GateEvaluator gates;
  private final LifecycleGateQueryRepository gateDefinitions;
  private final GateCheckQueryRepository gateChecks;
  private final ComplianceGateQueryRepository complianceGates;
  private final PermitService permits;
  private final ChallengeApiClient upstream;
  private final CallerResolver caller;
  private final UserRepository users;

  public LifecycleGateController(
      GateEvaluator gates,
      LifecycleGateQueryRepository gateDefinitions,
      GateCheckQueryRepository gateChecks,
      ComplianceGateQueryRepository complianceGates,
      PermitService permits,
      ChallengeApiClient upstream,
      CallerResolver caller,
      UserRepository users) {
    this.gates = gates;
    this.gateDefinitions = gateDefinitions;
    this.gateChecks = gateChecks;
    this.complianceGates = complianceGates;
    this.permits = permits;
    this.upstream = upstream;
    this.caller = caller;
    this.users = users;
  }

  @PostMapping("/api/apps/{appId}/functions/lifecycleGate")
  public ResponseEntity<?> handle(@RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> request = body == null ? Map.of() : body;
    String sessionToken = str(request.get("session_token"));
    String email = caller.email(sessionToken);
    if (email == null) {
      return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
    }
    boolean isAdmin = caller.isAdmin(sessionToken);
    String actorId = users.findIdByEmail(email).orElse("");
    String action = str(request.get("action"));

    try {
      return switch (action == null ? "" : action) {
        case "list_gates" -> ResponseEntity.ok(Map.of("gates", definitions()));
        case "gate_status" -> gateStatus(request, actorId, email);
        case "check_gate" -> checkGate(request, actorId, email);
        case "pass_gate" -> isAdmin
            ? passGate(request, actorId, email)
            : ResponseEntity.status(403).body(Map.of("error", "Admin only"));
        case "evaluate_all" -> isAdmin
            ? evaluateAll(actorId, email)
            : ResponseEntity.status(403).body(Map.of("error", "Admin only"));
        default -> ResponseEntity.status(400).body(Map.of("error", "Unknown action"));
      };
    } catch (Exception e) {
      log.error("lifecycleGate action '{}' failed", action, e);
      return ApiErrors.internal(e);
    }
  }

  private ResponseEntity<?> gateStatus(Map<String, Object> request, String actorId, String email) {
    String challengeId = str(request.get("challenge_id"));
    if (challengeId == null) {
      return ResponseEntity.status(400).body(Map.of("error", "challenge_id required"));
    }
    permits.recheckPermitFindings(challengeId, actorId, email);

    Map<String, GateCheckEntity> checksByCode = new HashMap<>();
    for (GateCheckEntity check : gateChecks.findAnyFor(challengeId)) {
      // findAnyFor is newest first, so the first entry per code is the current
      // one and later duplicates must not overwrite it.
      checksByCode.putIfAbsent(check.getGateCode(), check);
    }

    GateEvaluator.ChallengeData data = challengeData(request.get("challenge_data"));
    List<Map<String, Object>> out = new ArrayList<>();
    for (LifecycleGateEntity def : gateDefinitions.findAllInOrder()) {
      Map<String, Object> row = new LinkedHashMap<>(definition(def));
      row.put("check", checkJson(checksByCode.get(def.getCode())));
      row.put("evaluation", gates.evaluate(challengeId, def.getCode(), data).toMap());
      out.add(row);
    }
    return ResponseEntity.ok(Map.of("gates", out));
  }

  private ResponseEntity<?> checkGate(Map<String, Object> request, String actorId, String email) {
    String challengeId = str(request.get("challenge_id"));
    String gateCode = str(request.get("gate_code"));
    if (challengeId == null || gateCode == null) {
      return ResponseEntity.status(400).body(
          Map.of("error", "challenge_id and gate_code required"));
    }
    if (!GateEvaluator.GATE_CODES.contains(gateCode)) {
      return ResponseEntity.status(400).body(Map.of("error", "Invalid gate_code"));
    }
    permits.recheckPermitFindings(challengeId, actorId, email);

    GateEvaluator.Evaluation evaluation =
        gates.evaluate(challengeId, gateCode, challengeData(request.get("challenge_data")));
    gates.logEvaluation(challengeId, gateCode, evaluation, actorId, email);
    return ResponseEntity.ok(Map.of("evaluation", evaluation.toMap()));
  }

  private ResponseEntity<?> passGate(Map<String, Object> request, String actorId, String email) {
    String challengeId = str(request.get("challenge_id"));
    String gateCode = str(request.get("gate_code"));
    if (challengeId == null || gateCode == null) {
      return ResponseEntity.status(400).body(
          Map.of("error", "challenge_id and gate_code required"));
    }
    if (!GateEvaluator.GATE_CODES.contains(gateCode)) {
      return ResponseEntity.status(400).body(Map.of("error", "Invalid gate_code"));
    }
    permits.recheckPermitFindings(challengeId, actorId, email);

    GateEvaluator.PassResult result = gates.pass(
        challengeId, gateCode, actorId, email,
        challengeData(request.get("challenge_data")), false);

    if (!result.passed()) {
      Map<String, Object> refusal = new LinkedHashMap<>();
      refusal.put("error", "Gate cannot be passed: conditions not met.");
      refusal.put("passed", false);
      refusal.put("missing", result.missing());
      refusal.put("blocking_findings", result.blockingFindingIds());
      return ResponseEntity.status(409).body(refusal);
    }
    return ResponseEntity.ok(Map.of("ok", true, "passed", true));
  }

  /**
   * Evaluates every upstream challenge against the gates.
   *
   * <p>This labels; it does not republish. A challenge that was live before the
   * gate system existed is auto-passed up to its current phase so it stays
   * live — the alternative is taking running competitions offline the moment
   * an admin opens this screen.
   */
  private ResponseEntity<?> evaluateAll(String actorId, String email) {
    List<JsonNode> challenges = upstream.challenges(Map.of("limit", "500"));

    Map<String, ComplianceGateEntity> interimByChallenge = new HashMap<>();
    for (ComplianceGateEntity gate : complianceGates.findAll()) {
      interimByChallenge.putIfAbsent(String.valueOf(gate.getChallengeId()), gate);
    }

    List<Map<String, Object>> results = new ArrayList<>();
    int grandfatheredCount = 0;

    for (JsonNode c : challenges) {
      String cid = firstNonBlank(text(c, "id"), text(c, "_id"));
      if (cid == null) {
        continue;
      }
      GateEvaluator.ChallengeData data = new GateEvaluator.ChallengeData(
          cid,
          firstNonBlank(text(c, "theme"), text(c, "title")),
          firstNonBlank(text(c, "title"), text(c, "theme")),
          orEmpty(text(c, "category")),
          orEmpty(firstNonBlank(text(c, "brief"), text(c, "description"))),
          instant(text(c, "starts_at")),
          instant(firstNonBlank(text(c, "submission_ends_at"), text(c, "end_date"))),
          instant(firstNonBlank(text(c, "voting_ends_at"), text(c, "voting_end_date"))),
          null);

      permits.recheckPermitFindings(cid, actorId, email);

      Map<String, Object> gateResults = new LinkedHashMap<>();
      for (String gateCode : GateEvaluator.GATE_CODES) {
        GateEvaluator.Evaluation evaluation = gates.evaluate(cid, gateCode, data);
        gates.logEvaluation(cid, gateCode, evaluation, actorId, email);
        gateResults.put(gateCode, Map.of(
            "can_pass", evaluation.canPass(), "missing", evaluation.missing()));
      }

      ComplianceGateEntity interim = interimByChallenge.get(cid);
      boolean grandfatheredLive =
          interim != null && Boolean.TRUE.equals(interim.getGrandfatheredLive());
      List<String> grandfatheredGates = List.of();
      String phase = gates.phase(data);
      if (grandfatheredLive) {
        grandfatheredGates = gates.grandfatheredGatesForPhase(phase);
        for (String gateCode : grandfatheredGates) {
          gates.pass(cid, gateCode, actorId, email, data, true);
        }
        if (!grandfatheredGates.isEmpty()) {
          grandfatheredCount++;
        }
      }

      Map<String, Object> row = new LinkedHashMap<>();
      row.put("challenge_id", cid);
      row.put("challenge_title", firstNonBlank(
          data.theme(), interim == null ? null : interim.getChallengeTitle()) == null
          ? "" : firstNonBlank(data.theme(),
              interim == null ? null : interim.getChallengeTitle()));
      row.put("phase", phase);
      row.put("grandfathered_live", grandfatheredLive);
      row.put("grandfathered_gates", grandfatheredGates);
      row.put("gates", gateResults);
      results.add(row);
    }

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("total", challenges.size());
    out.put("evaluated", results.size());
    out.put("grandfathered", grandfatheredCount);
    out.put("results", results);
    return ResponseEntity.ok(out);
  }

  // ------------------------------------------------------------------ shapes

  private List<Map<String, Object>> definitions() {
    return gateDefinitions.findAllInOrder().stream().map(LifecycleGateController::definition)
        .toList();
  }

  private static Map<String, Object> definition(LifecycleGateEntity def) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", def.getId());
    out.put("code", def.getCode());
    out.put("name", def.getName());
    out.put("description", def.getDescription());
    out.put("sort_order", def.getSortOrder());
    out.put("is_active", def.getIsActive());
    return out;
  }

  private static Map<String, Object> checkJson(GateCheckEntity check) {
    if (check == null) {
      return null;
    }
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", check.getId());
    out.put("challenge_id", check.getChallengeId());
    out.put("gate_code", check.getGateCode());
    out.put("status", check.getStatus());
    out.put("passed_at", iso(check.getPassedAt()));
    out.put("passed_by_id", check.getPassedById());
    out.put("passed_by_email", check.getPassedByEmail());
    out.put("grandfathered", check.getGrandfathered());
    out.put("relocked_reason", check.getRelockedReason());
    out.put("notes", check.getNotes());
    return out;
  }

  /**
   * The caller's view of a challenge the gates should evaluate against.
   * Returns null when nothing was supplied, which the evaluator reads as
   * "unknown" and skips the data-dependent conditions.
   */
  private GateEvaluator.ChallengeData challengeData(Object raw) {
    if (!(raw instanceof Map<?, ?> m)) {
      return null;
    }
    List<String> divisions = null;
    if (m.get("divisions") instanceof List<?> supplied) {
      divisions = supplied.stream().map(String::valueOf).toList();
    }
    return new GateEvaluator.ChallengeData(
        str(m.get("id")),
        orEmpty(firstNonBlank(str(m.get("theme")), str(m.get("title")))),
        orEmpty(firstNonBlank(str(m.get("title")), str(m.get("theme")))),
        orEmpty(str(m.get("category"))),
        orEmpty(firstNonBlank(str(m.get("brief")), str(m.get("description")))),
        instant(str(m.get("starts_at"))),
        instant(str(m.get("submission_ends_at"))),
        instant(str(m.get("voting_ends_at"))),
        divisions);
  }

  /**
   * Parses an upstream timestamp. An unparseable value reads as absent, which
   * fails the "window is set" conditions — the gate refuses rather than
   * treating a malformed date as a satisfied schedule.
   */
  private static Instant instant(String value) {
    if (value == null || value.isBlank()) {
      return null;
    }
    try {
      return Instant.parse(value);
    } catch (DateTimeParseException e) {
      try {
        return Instant.parse(value + "Z");
      } catch (DateTimeParseException retry) {
        log.warn("Ignoring unparseable challenge timestamp '{}'", value);
        return null;
      }
    }
  }

  private static String text(JsonNode node, String field) {
    JsonNode value = node == null ? null : node.get(field);
    if (value == null || value.isNull()) {
      return null;
    }
    String out = value.asText("").trim();
    return out.isEmpty() ? null : out;
  }

  private static String iso(Instant value) {
    return value == null ? null : value.toString();
  }

  private static String firstNonBlank(String a, String b) {
    if (a != null && !a.isBlank()) {
      return a;
    }
    return b == null || b.isBlank() ? null : b;
  }

  private static String orEmpty(String value) {
    return value == null ? "" : value;
  }

  private static String str(Object value) {
    if (value == null) {
      return null;
    }
    String text = String.valueOf(value).trim();
    return text.isEmpty() ? null : text;
  }
}
