package com.fiftythree.challenges.terms;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fiftythree.challenges.compliance.ComplianceAuditService;
import com.fiftythree.challenges.compliance.ConditionEvaluator;
import com.fiftythree.challenges.compliance.FindingQueryRepository;
import com.fiftythree.challenges.compliance.PermitQueryRepository;
import com.fiftythree.challenges.compliance.PromoterAppointmentQueryRepository;
import com.fiftythree.challenges.compliance.RightsConfigurationQueryRepository;
import com.fiftythree.challenges.compliance.VotingConfigurationQueryRepository;
import com.fiftythree.challenges.entity.ApprovedClauseEntity;
import com.fiftythree.challenges.entity.ChallengeComplianceAssessmentEntity;
import com.fiftythree.challenges.entity.ChallengeEntity;
import com.fiftythree.challenges.entity.ChallengeRepository;
import com.fiftythree.challenges.entity.ChallengeRightsConfigurationEntity;
import com.fiftythree.challenges.entity.ComplianceAssessmentFindingEntity;
import com.fiftythree.challenges.entity.PermitOrAuthorityEntity;
import com.fiftythree.challenges.entity.PromoterAppointmentEntity;
import com.fiftythree.challenges.entity.TermsDocumentEntity;
import com.fiftythree.challenges.entity.VotingConfigurationEntity;
import com.fiftythree.challenges.lifecycle.AssessmentQueryRepository;
import com.fiftythree.challenges.support.JsonColumn;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Assembles terms and conditions from lawyer-approved clauses. A port of
 * {@code base44/shared/termsAssembler.ts}.
 *
 * <p><b>This is an assembly engine, never a legal writer.</b> Every sentence it
 * emits came from a clause a lawyer signed off. When it cannot produce a
 * complete document from signed clauses alone it stops and says why, rather
 * than filling the gap — a plausible-looking paragraph nobody approved is the
 * one output that would be worse than no document.
 *
 * <p>The STOP conditions, each of which halts assembly and routes to legal:
 *
 * <ol>
 *   <li>a required category has no approved clause covering it
 *   <li>two selected clauses are prohibited in combination, or one requires
 *       another that is not selected
 *   <li>a clause needs a merge variable that cannot be resolved
 *   <li>a mandatory clause is unsigned or past its retirement date
 *   <li>the challenge configuration changed after a document was generated
 * </ol>
 */
@Service
public class TermsAssemblerService {

  private static final Logger log = LoggerFactory.getLogger(TermsAssemblerService.class);

  /** Categories every document must cover, whatever the challenge looks like. */
  private static final Set<String> ALWAYS_REQUIRED = Set.of(
      "promoter_identity", "eligibility", "entry_method",
      "prizes", "privacy", "liability", "disputes", "general");

  /** Obligation types whose findings depend on the published terms. */
  private static final List<String> TERMS_DEPENDENT_OBLIGATIONS =
      List.of("legal_review_required", "tandc_clause_required");

  private static final Pattern MERGE_FIELD = Pattern.compile("\\{\\{([a-zA-Z0-9_]+)}}");

  private final ApprovedClauseQueryRepository clauses;
  private final TermsDocumentsQueryRepository documents;
  private final AssessmentQueryRepository assessments;
  private final FindingQueryRepository findings;
  private final ChallengeRepository challenges;
  private final PromoterAppointmentQueryRepository promoters;
  private final PermitQueryRepository permits;
  private final VotingConfigurationQueryRepository votingConfigs;
  private final RightsConfigurationQueryRepository rights;
  private final ComplianceAuditService audit;
  private final ConditionEvaluator conditionEvaluator;
  private final JsonColumn json;
  private final ObjectMapper mapper;

  public TermsAssemblerService(
      ApprovedClauseQueryRepository clauses,
      TermsDocumentsQueryRepository documents,
      AssessmentQueryRepository assessments,
      FindingQueryRepository findings,
      ChallengeRepository challenges,
      PromoterAppointmentQueryRepository promoters,
      PermitQueryRepository permits,
      VotingConfigurationQueryRepository votingConfigs,
      RightsConfigurationQueryRepository rights,
      ComplianceAuditService audit,
      ConditionEvaluator conditions,
      JsonColumn json,
      ObjectMapper mapper) {
    this.clauses = clauses;
    this.documents = documents;
    this.assessments = assessments;
    this.findings = findings;
    this.challenges = challenges;
    this.promoters = promoters;
    this.permits = permits;
    this.votingConfigs = votingConfigs;
    this.rights = rights;
    this.audit = audit;
    this.conditionEvaluator = conditions;
    this.json = json;
    this.mapper = mapper;
  }

  /** One reason assembly stopped, with the machine-readable stop code. */
  public record Stop(String stop, String detail) {
    Map<String, Object> toMap() {
      return Map.of("stop", stop, "detail", detail);
    }
  }

  /** The outcome: either a document, or the reasons there is not one. */
  public record Result(
      TermsDocumentEntity document,
      List<ApprovedClauseEntity> clausesUsed,
      String classification,
      List<Stop> errors,
      List<String> warnings) {

    public boolean failed() {
      return !errors.isEmpty();
    }
  }

  // ------------------------------------------------------------ sign-off

  /** A clause is selectable only once a named reviewer signed it on a date. */
  public boolean isSigned(ApprovedClauseEntity clause) {
    JsonNode signoff = parse(clause == null ? null : clause.getLegalSignoff());
    return notBlank(signoff.path("reviewer").asText(""))
        && notBlank(signoff.path("date").asText(""))
        && notBlank(signoff.path("reference").asText(""));
  }

  /** A retired clause is out of the library, whatever its sign-off says. */
  public boolean isExpired(ApprovedClauseEntity clause) {
    Instant retirement = clause == null ? null : clause.getRetirementDate();
    return retirement != null && !retirement.isAfter(Instant.now());
  }

  // ------------------------------------------------------------ assembly

  /** Assembles a draft document, or returns the STOP conditions that prevent it. */
  public Result assemble(
      String challengeId, Map<String, Object> facts, String actorId, String actorEmail) {

    String cid = String.valueOf(challengeId);
    List<Stop> errors = new ArrayList<>();
    List<String> warnings = new ArrayList<>();

    String classification = assessments.findByChallenge(cid).stream()
        .findFirst()
        .map(ChallengeComplianceAssessmentEntity::getClassification)
        .filter(TermsAssemblerService::notBlank)
        .orElseGet(() -> str(facts.get("classification"), "game_of_skill"));

    // STOP 5 — the configuration moved since the last document was generated.
    Result stopped = checkConfigChange(cid, facts, classification, actorId, actorEmail, warnings);
    if (stopped != null) {
      return stopped;
    }

    // STOP 4 — unsigned or expired mandatory clauses.
    List<ApprovedClauseEntity> selected = new ArrayList<>();
    errors.addAll(selectClauses(facts, selected));

    // STOP 1 — a required category with nothing to cover it.
    Set<String> covered = new LinkedHashSet<>();
    for (ApprovedClauseEntity c : selected) {
      covered.add(c.getCategory());
    }
    List<String> missing = requiredCategories(facts, classification).stream()
        .filter(category -> !covered.contains(category))
        .toList();
    if (!missing.isEmpty()) {
      errors.add(new Stop("missing_required_clause",
          "No approved clause covers required category(ies): " + String.join(", ", missing)
              + ". Legal review required."));
    }

    // STOP 2 — combinations that must not, or must, appear together.
    errors.addAll(checkCombinations(selected));

    if (!errors.isEmpty()) {
      logStop(cid, actorId, actorEmail,
          "Terms assembly FAILED — " + errors.size() + " STOP condition(s): " + details(errors));
      return new Result(null, List.of(), classification, errors, warnings);
    }

    // STOP 3 — merge variables that cannot be resolved.
    Map<String, Object> variables = resolveVariables(cid, facts);
    errors.addAll(checkVariables(selected, variables, classification));
    if (!errors.isEmpty()) {
      logStop(cid, actorId, actorEmail,
          "Terms assembly FAILED — unresolved variables: " + details(errors));
      return new Result(null, List.of(), classification, errors, warnings);
    }

    TermsDocumentEntity doc = new TermsDocumentEntity();
    doc.setId(newId());
    doc.setChallengeId(cid);
    doc.setClauseVersionsUsed(write(selected.stream().map(ApprovedClauseEntity::getId).toList()));
    doc.setMergedOutput(merge(selected, variables));
    doc.setStatus("draft");
    doc.setConfigSnapshot(write(configSnapshot(facts, classification)));
    doc.setChangeNote("");
    doc.setCreatedDate(Instant.now());
    doc.setUpdatedDate(Instant.now());
    doc.setIsSample(false);
    documents.save(doc);

    audit.event("assessment_run", cid, actorId, actorEmail,
        "Terms document " + doc.getId() + " assembled (draft). " + selected.size()
            + " clauses. Classification: " + classification + ".");

    return new Result(doc, selected, classification, List.of(), warnings);
  }

  /**
   * Selects every signed, current, in-jurisdiction clause that applies.
   *
   * <p>Mandatory clauses come in unconditionally; the rest only when their
   * stored inclusion conditions match the facts. An unsigned or expired
   * <em>mandatory</em> clause is a STOP — a document missing a clause the
   * library says is compulsory is not a document.
   */
  private List<Stop> selectClauses(
      Map<String, Object> facts, List<ApprovedClauseEntity> selected) {

    List<Stop> errors = new ArrayList<>();
    String jurisdiction = str(facts.get("jurisdiction_code"),
        str(facts.get("geography"), ""));

    for (ApprovedClauseEntity c : clauses.findCurrent()) {
      boolean mandatory = !Boolean.FALSE.equals(c.getMandatory());

      if (!isSigned(c)) {
        if (mandatory) {
          errors.add(new Stop("clause_unsigned", "Mandatory clause '" + c.getIdentifier()
              + "' is unsigned and cannot be selected."));
        }
        continue;
      }
      if (isExpired(c)) {
        if (mandatory) {
          errors.add(new Stop("clause_expired", "Mandatory clause '" + c.getIdentifier()
              + "' is expired (retirement_date: " + c.getRetirementDate() + ")."));
        }
        continue;
      }

      List<String> applicable = json.stringList(c.getApplicableJurisdictions());
      if (!applicable.isEmpty() && notBlank(jurisdiction) && !applicable.contains(jurisdiction)) {
        continue;
      }

      if (mandatory || matches(parse(c.getInclusionRule()).path("conditions"), facts)) {
        selected.add(c);
      }
    }
    return errors;
  }

  /** Prohibited pairs and required companions, both of which route to legal. */
  private List<Stop> checkCombinations(List<ApprovedClauseEntity> selected) {
    List<Stop> errors = new ArrayList<>();
    Set<String> identifiers = new LinkedHashSet<>();
    for (ApprovedClauseEntity c : selected) {
      identifiers.add(c.getIdentifier());
    }

    for (ApprovedClauseEntity c : selected) {
      for (String prohibited : json.stringList(c.getProhibitedCombinations())) {
        if (identifiers.contains(prohibited)) {
          errors.add(new Stop("prohibited_combination", "Clause '" + c.getIdentifier()
              + "' is prohibited in combination with '" + prohibited
              + "'. Legal review required."));
        }
      }
      for (String required : json.stringList(c.getRequiredCombinations())) {
        if (!identifiers.contains(required)) {
          errors.add(new Stop("missing_required_combination", "Clause '" + c.getIdentifier()
              + "' requires clause '" + required
              + "' which is not selected. Legal review required."));
        }
      }
    }
    return errors;
  }

  private List<Stop> checkVariables(
      List<ApprovedClauseEntity> selected, Map<String, Object> variables, String classification) {

    List<Stop> errors = new ArrayList<>();
    for (ApprovedClauseEntity c : selected) {
      for (String name : json.stringList(c.getRequiredVariables())) {
        Object value = variables.get(name);
        if (value != null && !String.valueOf(value).trim().isEmpty()) {
          continue;
        }
        // A chance-classified competition without a permit number cannot
        // lawfully run, so that gap is called out as itself.
        if ("permit_numbers".equals(name) && "permit_statements".equals(c.getCategory())) {
          errors.add(new Stop("unresolved_variable", "Required variable '" + name
              + "' is unresolved for clause '" + c.getIdentifier()
              + "'. Permit number is required for " + classification + " challenges."));
        } else {
          errors.add(new Stop("unresolved_variable", "Required variable '" + name
              + "' is unresolved for clause '" + c.getIdentifier() + "'."));
        }
      }
    }
    return errors;
  }

  /** The categories this particular challenge must cover. */
  private Set<String> requiredCategories(Map<String, Object> facts, String classification) {
    Set<String> required = new LinkedHashSet<>(ALWAYS_REQUIRED);

    boolean judged = number(facts.get("scoring_judge_weight")) > 0;
    boolean voted = notBlank(str(facts.get("voting_purpose"), ""));

    if (judged) {
      required.add("judging");
    }
    if (voted) {
      required.add("voting");
    }
    if ("game_of_chance".equals(classification) || "mixed".equals(classification)) {
      required.add("permit_statements");
      required.add("draw_procedure");
      required.add("free_entry_route");
    }
    String audience = str(facts.get("audience_slug"), "");
    if ("minors".equals(audience) || "all_ages".equals(audience)) {
      required.add("minors");
    }
    if (voted || judged) {
      required.add("rights_grants");
    }
    return required;
  }

  // ------------------------------------------------------------ variables

  /**
   * Fills the merge variables a clause body can reference.
   *
   * <p>Facts come first and are never overwritten — a value an admin supplied
   * explicitly beats one looked up here. Everything below only fills a gap.
   */
  public Map<String, Object> resolveVariables(String cid, Map<String, Object> facts) {
    Map<String, Object> vars = new LinkedHashMap<>(facts);

    Optional<ChallengeEntity> challenge = challenges.findById(cid);
    challenge.ifPresent(c -> {
      fill(vars, "challenge_name", nz(c.getTitle()));
      fill(vars, "entry_open", iso(c.getStartsAt()));
      fill(vars, "entry_close", iso(c.getSubmissionEndsAt()));
      fill(vars, "draw_date_time", iso(c.getVotingEndsAt()));
    });

    if (isEmpty(vars.get("promoter_entity"))) {
      for (PromoterAppointmentEntity pa : promoters.findLatestFor(cid)) {
        vars.put("promoter_entity", nz(pa.getPromoterEntityName()));
        break;
      }
    }
    fill(vars, "host_name", str(vars.get("promoter_entity"), ""));

    if (isEmpty(vars.get("permit_numbers"))) {
      vars.put("permit_numbers", permitNumbers(cid));
    }

    if (isEmpty(vars.get("eligible_states")) || isEmpty(vars.get("voting_rules_summary"))) {
      for (VotingConfigurationEntity vc : votingConfigs.findLatestFor(cid)) {
        fill(vars, "eligible_states",
            String.join(", ", json.stringList(vc.getGeographicRestrictions())));
        fill(vars, "voting_rules_summary",
            "Voting purpose: " + nz(vc.getVotingPurpose()) + ". "
                + "Votes per person: " + plain(vc.getVotesPerPersonPerAccount()) + ". "
                + "Identity verification: " + nz(vc.getIdentityVerification()) + ".");
        break;
      }
    }

    if (isEmpty(vars.get("rights_summary"))) {
      rightsSummary(cid).ifPresent(summary -> vars.put("rights_summary", summary));
    }

    // Last-resort defaults, so a document is not blocked on wording that is the
    // same for every competition.
    fill(vars, "winner_notification_method", "Email and phone");
    fill(vars, "results_publication", "Published on the 53 Challenges website");
    fill(vars, "rights_summary", "As specified in the competition rules");
    fill(vars, "min_age", "18");
    fill(vars, "judging_criteria", "As specified in the scoring model");
    double pool = number(vars.get("total_prize_pool"));
    fill(vars, "prize_descriptions", pool > 0
        ? "Total prize pool: $" + plain(pool)
        : "As specified in the competition brief");

    return vars;
  }

  /**
   * The reference numbers of permits that cover this challenge.
   *
   * <p>A permit with no {@code covered_challenges} covers everything — that is
   * how a platform-wide authority is recorded — so an empty list means "all",
   * not "none".
   */
  private String permitNumbers(String cid) {
    List<String> numbers = new ArrayList<>();
    for (PermitOrAuthorityEntity p : permits.findUsable()) {
      List<String> covered = json.stringList(p.getCoveredChallenges());
      if (!covered.isEmpty() && !covered.contains(cid)) {
        continue;
      }
      if (notBlank(p.getReferenceNumber())) {
        numbers.add(p.getReferenceNumber());
      }
    }
    return String.join(", ", numbers);
  }

  private Optional<String> rightsSummary(String cid) {
    List<ChallengeRightsConfigurationEntity> found = rights.findByChallengeId(cid);
    if (found.isEmpty()) {
      return Optional.empty();
    }
    ChallengeRightsConfigurationEntity cfg = found.get(0);

    Map<String, List<String>> byTier = new LinkedHashMap<>();
    for (JsonNode scope : json.nodes(cfg.getIncludedScopeVersions())) {
      String tier = scope.path("tier").asText("");
      if (tier.isEmpty()) {
        tier = "tier1_mandatory";
      }
      byTier.computeIfAbsent(tier, t -> new ArrayList<>())
          .add(scope.path("scope_code").asText(""));
    }

    List<String> parts = new ArrayList<>();
    appendTier(parts, byTier.get("tier1_mandatory"), "Mandatory: ");
    appendTier(parts, byTier.get("tier2_standard"), "Standard (declinable): ");
    appendTier(parts, byTier.get("tier3_extended"), "Extended (opt-in): ");
    parts.add("Music: " + (notBlank(cfg.getMusicPolicy())
        ? cfg.getMusicPolicy() : "original_or_licensed_only"));
    parts.add("Third parties: " + (notBlank(cfg.getThirdPartyPolicy())
        ? cfg.getThirdPartyPolicy() : "none_permitted"));

    return Optional.of(String.join(". ", parts));
  }

  private static void appendTier(List<String> parts, List<String> codes, String label) {
    if (codes != null && !codes.isEmpty()) {
      parts.add(label + String.join(", ", codes));
    }
  }

  /** Substitutes {@code {{variable}}} placeholders and joins the clause bodies. */
  private String merge(List<ApprovedClauseEntity> selected, Map<String, Object> variables) {
    List<String> sections = new ArrayList<>();
    for (ApprovedClauseEntity c : selected) {
      sections.add("### " + nz(c.getTitle()) + "\n\n" + substitute(nz(c.getBody()), variables));
    }
    return String.join("\n\n---\n\n", sections);
  }

  /**
   * Replaces every {@code {{name}}} the variables know about.
   *
   * <p>Done in a single pass over the body rather than one pass per variable.
   * A per-variable loop would re-scan text it had already substituted, so a
   * value that itself contained {@code {{...}}} — a clause body quoted into a
   * prize description, say — would be expanded again.
   */
  private static String substitute(String body, Map<String, Object> variables) {
    Matcher matcher = MERGE_FIELD.matcher(body);
    StringBuilder out = new StringBuilder();
    while (matcher.find()) {
      String name = matcher.group(1);
      Object value = variables.get(name);
      // A key that is present but null substitutes to empty, as it did in
      // JavaScript. A key that is absent altogether is left as the literal
      // placeholder, so an unresolved variable is visible rather than silently
      // deleted from the terms.
      String replacement = value != null ? plainOf(value)
          : variables.containsKey(name) ? "" : matcher.group(0);
      matcher.appendReplacement(out, Matcher.quoteReplacement(replacement));
    }
    matcher.appendTail(out);
    return out.toString();
  }

  // ------------------------------------------------------- config changes

  /**
   * Detects a configuration change since the last document and acts on it.
   *
   * <p>A superseded <em>published</em> document is a full stop: people have
   * already entered under terms that no longer describe the competition, and
   * only a lawyer can decide what happens next. A superseded draft is just a
   * warning — nobody relied on it.
   */
  private Result checkConfigChange(
      String cid,
      Map<String, Object> facts,
      String classification,
      String actorId,
      String actorEmail,
      List<String> warnings) {

    List<TermsDocumentEntity> live = documents.findLive(cid);
    if (live.isEmpty()) {
      return null;
    }
    TermsDocumentEntity latest = live.get(0);
    JsonNode snapshot = parse(latest.getConfigSnapshot());
    if (snapshot.isEmpty()) {
      return null;
    }

    List<String> changed = changedFields(snapshot, facts, classification);
    if (changed.isEmpty()) {
      return null;
    }

    // Read the status before superseding: supersede() overwrites it, and
    // whether the prior document was published is the whole question. Getting
    // this the wrong way round makes the stop unreachable, so a published
    // document would be retired and assembly would carry on regardless.
    String priorStatus = latest.getStatus();

    String reason = "Config changed: " + String.join(", ", changed);
    supersede(latest, "", reason, actorId, actorEmail);
    int reopened = reopenTermsFindings(cid, actorId, actorEmail);

    if ("published".equals(priorStatus)) {
      Stop stop = new Stop("config_changed",
          "Challenge configuration changed after generation (" + String.join(", ", changed)
              + "). Prior published TermsDocument superseded. " + reopened
              + " finding(s) reopened. Legal review required before re-assembly.");
      logStop(cid, actorId, actorEmail,
          "Terms assembly STOPPED — config changed (" + String.join(", ", changed)
              + "). Published doc " + latest.getId() + " superseded.");
      return new Result(null, List.of(), classification, List.of(stop), warnings);
    }

    warnings.add("Prior " + priorStatus + " TermsDocument superseded due to config change ("
        + String.join(", ", changed) + ").");
    return null;
  }

  private static List<String> changedFields(
      JsonNode snapshot, Map<String, Object> facts, String classification) {

    List<String> fields = new ArrayList<>();
    compareText(fields, snapshot, "classification", classification);
    // voting_purpose is compared even when it was empty in the snapshot:
    // turning voting on is exactly the change that matters most.
    if (snapshot.has("voting_purpose")
        && !snapshot.path("voting_purpose").asText("")
            .equals(str(facts.get("voting_purpose"), ""))) {
      fields.add("voting_purpose");
    }
    if (snapshot.has("total_prize_pool")
        && snapshot.path("total_prize_pool").asDouble(0) != number(facts.get("total_prize_pool"))) {
      fields.add("total_prize_pool");
    }
    compareText(fields, snapshot, "promoter_type", str(facts.get("promoter_type"), ""));
    compareText(fields, snapshot, "scoring_model_slug", str(facts.get("scoring_model_slug"), ""));
    compareText(fields, snapshot, "audience_slug", str(facts.get("audience_slug"), ""));
    compareText(fields, snapshot, "mechanic_slug", str(facts.get("mechanic_slug"), ""));
    return fields;
  }

  /** Compares one snapshot field, ignoring it when the snapshot never set it. */
  private static void compareText(
      List<String> fields, JsonNode snapshot, String field, String current) {
    String was = snapshot.path(field).asText("");
    if (notBlank(was) && !was.equals(current)) {
      fields.add(field);
    }
  }

  private ObjectNode configSnapshot(Map<String, Object> facts, String classification) {
    ObjectNode snapshot = mapper.createObjectNode();
    snapshot.put("classification", classification);
    snapshot.put("voting_purpose", str(facts.get("voting_purpose"), ""));
    snapshot.put("total_prize_pool", number(facts.get("total_prize_pool")));
    snapshot.put("promoter_type", str(facts.get("promoter_type"), ""));
    snapshot.put("scoring_model_slug", str(facts.get("scoring_model_slug"), ""));
    snapshot.put("audience_slug", str(facts.get("audience_slug"), ""));
    snapshot.put("mechanic_slug", str(facts.get("mechanic_slug"), ""));
    return snapshot;
  }

  /** Marks a document superseded, recording what replaced it and why. */
  public void supersede(
      TermsDocumentEntity doc, String newDocId, String reason, String actorId, String actorEmail) {

    doc.setStatus("superseded");
    doc.setSupersededBy(nz(newDocId));
    doc.setChangeNote(reason);
    doc.setUpdatedDate(Instant.now());
    documents.save(doc);

    audit.event("assessment_run", "", actorId, actorEmail,
        "TermsDocument " + doc.getId() + " superseded. Reason: " + reason);
  }

  /**
   * Re-opens findings that were satisfied by terms which no longer stand.
   *
   * <p>A finding closed because "the terms cover it" is only closed while those
   * terms are the live ones. Superseding the document without re-opening them
   * would leave the challenge looking compliant on the strength of a document
   * that has been withdrawn.
   */
  private int reopenTermsFindings(String cid, String actorId, String actorEmail) {
    int reopened = 0;
    for (ComplianceAssessmentFindingEntity f
        : findings.findByObligationTypes(cid, TERMS_DEPENDENT_OBLIGATIONS)) {

      if (!"satisfied".equals(f.getStatus()) && !"waived".equals(f.getStatus())) {
        continue;
      }
      f.setStatus("open");
      f.setUpdatedDate(Instant.now());
      findings.save(f);
      reopened++;

      audit.findingEvent("finding_updated", cid, f.getId(), actorId, actorEmail,
          "Finding for rule " + nz(f.getRuleCode()) + " reopened — terms document superseded.");
    }
    return reopened;
  }

  /**
   * Whether a clause's stored inclusion conditions match the facts. Delegates
   * to the shared {@link ConditionEvaluator}: the assessment engine evaluates
   * the identical format, and two implementations would eventually disagree.
   */
  boolean matches(JsonNode conditions, Map<String, Object> facts) {
    return conditionEvaluator.matches(conditions, facts);
  }

  // ------------------------------------------------------------- helpers

  private void logStop(String cid, String actorId, String actorEmail, String detail) {
    audit.event("assessment_run", cid, actorId, actorEmail, detail);
  }

  private static String details(List<Stop> errors) {
    List<String> out = new ArrayList<>();
    for (Stop stop : errors) {
      out.add(stop.detail());
    }
    return String.join("; ", out);
  }

  /** Maps STOP records for a JSON response. */
  public static List<Map<String, Object>> toMaps(List<Stop> errors) {
    return errors.stream().map(Stop::toMap).toList();
  }

  private JsonNode parse(String raw) {
    if (raw == null || raw.isBlank()) {
      return mapper.createObjectNode();
    }
    try {
      return mapper.readTree(raw);
    } catch (Exception e) {
      log.warn("Ignoring malformed JSON column while assembling terms: {}", e.toString());
      return mapper.createObjectNode();
    }
  }

  private String write(Object value) {
    try {
      return mapper.writeValueAsString(value);
    } catch (Exception e) {
      throw new IllegalStateException("Could not serialise a terms column", e);
    }
  }

  private static void fill(Map<String, Object> vars, String key, String value) {
    if (isEmpty(vars.get(key)) && notBlank(value)) {
      vars.put(key, value);
    }
  }

  private static boolean isEmpty(Object value) {
    return value == null || String.valueOf(value).isEmpty();
  }

  /** Renders a number without a trailing ".0", which reads wrong in prose. */
  private static String plain(Double value) {
    return value == null ? "" : plain(value.doubleValue());
  }

  private static String plain(double value) {
    return value == Math.rint(value) && !Double.isInfinite(value)
        ? String.valueOf((long) value)
        : String.valueOf(value);
  }

  private static String plainOf(Object value) {
    return value instanceof Number n ? plain(n.doubleValue()) : String.valueOf(value);
  }

  private static double number(Object value) {
    if (value instanceof Number n) {
      return n.doubleValue();
    }
    try {
      return value == null ? 0 : Double.parseDouble(String.valueOf(value));
    } catch (NumberFormatException e) {
      return 0;
    }
  }

  private static String str(Object value, String fallback) {
    return value == null || String.valueOf(value).isEmpty() ? fallback : String.valueOf(value);
  }

  private static String iso(Instant value) {
    return value == null ? "" : value.toString();
  }

  private static boolean notBlank(String value) {
    return value != null && !value.trim().isEmpty();
  }

  private static String nz(String value) {
    return value == null ? "" : value;
  }

  private static String newId() {
    return UUID.randomUUID().toString().replace("-", "").substring(0, 24);
  }
}
