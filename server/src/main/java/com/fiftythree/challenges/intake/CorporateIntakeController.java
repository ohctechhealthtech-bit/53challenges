package com.fiftythree.challenges.intake;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiftythree.challenges.admin.DraftRepo;
import com.fiftythree.challenges.entity.CampaignScaleBandEntity;
import com.fiftythree.challenges.entity.ChallengeDraftEntity;
import com.fiftythree.challenges.entity.ChallengeRecommendationEntity;
import com.fiftythree.challenges.entity.EnterpriseQuoteEntity;
import com.fiftythree.challenges.entity.HostOrganisationEntity;
import com.fiftythree.challenges.entity.HostOrganisationRepository;
import com.fiftythree.challenges.entity.IntakeAnswerOptionEntity;
import com.fiftythree.challenges.entity.IntakeQuestionEntity;
import com.fiftythree.challenges.entity.IntakeQuestionnaireEntity;
import com.fiftythree.challenges.entity.IntakeResponseEntity;
import com.fiftythree.challenges.entity.ResourceAllocationEntity;
import com.fiftythree.challenges.entity.ResourceTypeEntity;
import com.fiftythree.challenges.entity.ServiceTierEntity;
import com.fiftythree.challenges.security.CallerResolver;
import com.fiftythree.challenges.support.JsonColumn;
import com.fiftythree.challenges.upstream.ChallengeApiClient;
import com.fiftythree.challenges.user.UserRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * The Java replacement for {@code corporateIntake}: the questionnaire a
 * corporate host fills in, the recommendation it produces, and the enterprise
 * quoting that follows.
 *
 * <p>Submitting an intake writes four linked records in one go — the host
 * organisation, the response, the recommendation, and a pre-created
 * {@code ChallengeDraft} carrying the compliance flags the answers raised. The
 * draft exists from the first submission so the assessment engine surfaces
 * obligations immediately rather than at approval time, and it cannot go live
 * except through the lifecycle gates.
 *
 * <p>Two rules worth naming:
 *
 * <ul>
 *   <li><b>The packaged floor is a floor, never a ceiling.</b> A quote totals
 *       {@code max(floor, sum of lines)}, so adding resourcing raises the
 *       price and never lowers it below what was packaged.
 *   <li><b>A by-proposal scale band cannot be approved without an accepted
 *       quote.</b> Those programmes are priced individually; approving one
 *       without a signed-off number is agreeing to deliver at an unknown cost.
 * </ul>
 */
@RestController
public class CorporateIntakeController {

  private static final Logger log = LoggerFactory.getLogger(CorporateIntakeController.class);

  /** Readable before signing in: the wizard shows the questionnaire to visitors. */
  private static final Set<String> PUBLIC_ACTIONS = Set.of(
      "get_questionnaire", "list_account_types", "list_service_tiers",
      "list_scale_bands", "list_deliverables");

  private final RecommendationEngine engine;
  private final QuestionnaireQueryRepository questionnaires;
  private final QuestionQueryRepository questions;
  private final AnswerOptionQueryRepository options;
  private final IntakeResponseQueryRepository responses;
  private final RecommendationQueryRepository recommendations;
  private final HostOrganisationRepository hosts;
  private final HostAccountTypeQueryRepository accountTypes;
  private final ServiceTierQueryRepository serviceTiers;
  private final ScaleBandQueryRepository scaleBands;
  private final DeliverableQueryRepository deliverables;
  private final ResourceTypeQueryRepository resourceTypes;
  private final EnterpriseQuoteQueryRepository quotes;
  private final ResourceAllocationQueryRepository allocations;
  private final DraftRepo drafts;
  private final ChallengeApiClient upstream;
  private final CallerResolver caller;
  private final UserRepository users;
  private final JsonColumn json;
  private final ObjectMapper mapper;

  public CorporateIntakeController(
      RecommendationEngine engine,
      QuestionnaireQueryRepository questionnaires,
      QuestionQueryRepository questions,
      AnswerOptionQueryRepository options,
      IntakeResponseQueryRepository responses,
      RecommendationQueryRepository recommendations,
      HostOrganisationRepository hosts,
      HostAccountTypeQueryRepository accountTypes,
      ServiceTierQueryRepository serviceTiers,
      ScaleBandQueryRepository scaleBands,
      DeliverableQueryRepository deliverables,
      ResourceTypeQueryRepository resourceTypes,
      EnterpriseQuoteQueryRepository quotes,
      ResourceAllocationQueryRepository allocations,
      DraftRepo drafts,
      ChallengeApiClient upstream,
      CallerResolver caller,
      UserRepository users,
      JsonColumn json,
      ObjectMapper mapper) {
    this.engine = engine;
    this.questionnaires = questionnaires;
    this.questions = questions;
    this.options = options;
    this.responses = responses;
    this.recommendations = recommendations;
    this.hosts = hosts;
    this.accountTypes = accountTypes;
    this.serviceTiers = serviceTiers;
    this.scaleBands = scaleBands;
    this.deliverables = deliverables;
    this.resourceTypes = resourceTypes;
    this.quotes = quotes;
    this.allocations = allocations;
    this.drafts = drafts;
    this.upstream = upstream;
    this.caller = caller;
    this.users = users;
    this.json = json;
    this.mapper = mapper;
  }

  @PostMapping("/api/apps/{appId}/functions/corporateIntake")
  public ResponseEntity<?> handle(@RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> request = body == null ? Map.of() : body;
    String sessionToken = str(request.get("session_token"));
    String email = caller.email(sessionToken);
    String action = str(request.get("action"));
    boolean isAdmin = email != null && caller.isAdmin(sessionToken);

    if (email == null && !PUBLIC_ACTIONS.contains(action)) {
      return ResponseEntity.status(401).body(Map.of("error", "Please sign in to continue."));
    }

    try {
      return switch (action == null ? "" : action) {
        case "get_questionnaire" -> getQuestionnaire();
        case "list_account_types" -> ResponseEntity.ok(Map.of("account_types",
            accountTypes.findInOrder().stream().map(this::accountTypeJson).toList()));
        case "list_service_tiers" -> ResponseEntity.ok(Map.of("service_tiers",
            serviceTiers.findInOrder().stream().map(this::tierJson).toList()));
        case "list_scale_bands" -> ResponseEntity.ok(Map.of("scale_bands",
            scaleBands.findInOrder().stream().map(this::bandJson).toList()));
        case "list_deliverables" -> ResponseEntity.ok(Map.of("deliverables",
            deliverables.findInOrder().stream().map(this::deliverableJson).toList()));
        case "list_resource_types" -> ResponseEntity.ok(Map.of("resource_types",
            resourceTypes.findInOrder().stream().map(this::resourceTypeJson).toList()));

        case "submit_intake" -> submitIntake(request);
        case "get_recommendation" -> getRecommendation(request);

        case "list_responses" -> admin(isAdmin, () -> listResponses(request));
        case "get_response_detail" -> admin(isAdmin, () -> responseDetail(request));
        case "list_questionnaires" -> admin(isAdmin, () -> ResponseEntity.ok(
            Map.of("questionnaires", questionnaires.findAllByVersion().stream()
                .map(this::questionnaireJson).toList())));
        case "create_questionnaire_version" -> admin(isAdmin, () -> newVersion(request));
        case "get_service_delivery" -> admin(isAdmin, () -> serviceDelivery(request));
        case "update_draft_deliverables" -> admin(isAdmin, () -> updateDeliverables(request));
        case "update_draft_scale_band" -> admin(isAdmin, () -> updateScaleBand(request));
        case "compute_quote" -> admin(isAdmin, () -> computeQuote(request));
        case "save_quote" -> admin(isAdmin, () -> saveQuote(request));
        case "accept_quote" -> admin(isAdmin, () -> setQuoteStatus(request, "accepted"));
        case "decline_quote" -> admin(isAdmin, () -> setQuoteStatus(request, "declined"));
        case "set_draft_status" -> admin(isAdmin, () -> setDraftStatus(request));
        case "publish_to_main" -> admin(isAdmin, () -> publishToMain(request));

        default -> ResponseEntity.status(400).body(Map.of("error", "Unknown action"));
      };
    } catch (Exception e) {
      log.error("corporateIntake action '{}' failed", action, e);
      return ResponseEntity.status(500).body(Map.of(
          "error", e.getMessage() == null ? "Corporate intake request failed" : e.getMessage()));
    }
  }

  private ResponseEntity<?> admin(boolean isAdmin, Supplier<ResponseEntity<?>> handler) {
    return isAdmin ? handler.get() : ResponseEntity.status(403).body(Map.of("error", "Admin only"));
  }

  // ------------------------------------------------------- questionnaire

  private ResponseEntity<?> getQuestionnaire() {
    Optional<IntakeQuestionnaireEntity> active = questionnaires.findActive().stream().findFirst();
    if (active.isEmpty()) {
      Map<String, Object> empty = new LinkedHashMap<>();
      empty.put("questionnaire", null);
      empty.put("questions", List.of());
      return ResponseEntity.ok(empty);
    }

    List<IntakeQuestionEntity> rows = questions.findByQuestionnaire(active.get().getId());
    List<String> questionIds = rows.stream().map(IntakeQuestionEntity::getId).toList();

    Map<String, List<Map<String, Object>>> byQuestion = new LinkedHashMap<>();
    if (!questionIds.isEmpty()) {
      for (IntakeAnswerOptionEntity option : options.findByQuestions(questionIds)) {
        byQuestion.computeIfAbsent(option.getQuestionId(), q -> new ArrayList<>())
            .add(publicOptionJson(option));
      }
    }

    List<Map<String, Object>> out = new ArrayList<>();
    for (IntakeQuestionEntity q : rows) {
      Map<String, Object> row = questionJson(q);
      row.put("options", byQuestion.getOrDefault(q.getId(), List.of()));
      out.add(row);
    }

    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("questionnaire", questionnaireJson(active.get()));
    payload.put("questions", out);
    return ResponseEntity.ok(payload);
  }

  private ResponseEntity<?> newVersion(Map<String, Object> request) {
    String sourceId = str(request.get("source_questionnaire_id"));
    if (sourceId == null) {
      return ResponseEntity.status(400).body(
          Map.of("error", "source_questionnaire_id required"));
    }
    Optional<IntakeQuestionnaireEntity> found = questionnaires.findById(sourceId);
    if (found.isEmpty()) {
      return ResponseEntity.status(404).body(Map.of("error", "Source questionnaire not found"));
    }
    IntakeQuestionnaireEntity source = found.get();
    Instant now = Instant.now();

    // Exactly one version is active at a time, so the wizard never has to
    // choose between two.
    for (IntakeQuestionnaireEntity previous : questionnaires.findActive()) {
      previous.setIsActive(false);
      previous.setUpdatedDate(now);
      questionnaires.save(previous);
    }

    IntakeQuestionnaireEntity clone = new IntakeQuestionnaireEntity();
    clone.setId(newId());
    clone.setName(source.getName());
    clone.setVersion((source.getVersion() == null ? 1 : source.getVersion()) + 1);
    clone.setIsActive(true);
    clone.setSupersededById("");
    clone.setChangeNote(orEmpty(str(request.get("change_note"))));
    clone.setCreatedDate(now);
    clone.setUpdatedDate(now);
    clone.setIsSample(false);
    questionnaires.save(clone);

    source.setSupersededById(clone.getId());
    source.setUpdatedDate(now);
    questionnaires.save(source);

    // Questions and options are copied, not shared. Historical responses point
    // at the old ids, so the exact wording someone answered survives editing.
    List<IntakeQuestionEntity> sourceQuestions = questions.findByQuestionnaire(sourceId);
    for (IntakeQuestionEntity q : sourceQuestions) {
      IntakeQuestionEntity copy = new IntakeQuestionEntity();
      copy.setId(newId());
      copy.setQuestionnaireId(clone.getId());
      copy.setPrompt(q.getPrompt());
      copy.setType(q.getType());
      copy.setSortOrder(q.getSortOrder());
      copy.setIsRequired(q.getIsRequired());
      copy.setCreatedDate(now);
      copy.setUpdatedDate(now);
      copy.setIsSample(false);
      questions.save(copy);

      List<IntakeAnswerOptionEntity> clones = new ArrayList<>();
      for (IntakeAnswerOptionEntity o : options.findByQuestion(q.getId())) {
        IntakeAnswerOptionEntity optionCopy = new IntakeAnswerOptionEntity();
        optionCopy.setId(newId());
        optionCopy.setQuestionId(copy.getId());
        optionCopy.setLabel(o.getLabel());
        optionCopy.setWeight(o.getWeight());
        optionCopy.setSortOrder(o.getSortOrder());
        optionCopy.setMechanicIds(o.getMechanicIds());
        optionCopy.setCategoryIds(o.getCategoryIds());
        optionCopy.setModeIds(o.getModeIds());
        optionCopy.setAudienceIds(o.getAudienceIds());
        optionCopy.setScoringIds(o.getScoringIds());
        optionCopy.setEvidenceIds(o.getEvidenceIds());
        optionCopy.setPathwayIds(o.getPathwayIds());
        optionCopy.setServiceTierId(o.getServiceTierId());
        optionCopy.setScaleBandId(o.getScaleBandId());
        optionCopy.setProgramScope(o.getProgramScope());
        optionCopy.setComplianceFlags(o.getComplianceFlags());
        optionCopy.setCreatedDate(now);
        optionCopy.setUpdatedDate(now);
        optionCopy.setIsSample(false);
        clones.add(optionCopy);
      }
      if (!clones.isEmpty()) {
        options.saveAll(clones);
      }
    }

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("questionnaire", questionnaireJson(clone));
    out.put("cloned_questions", sourceQuestions.size());
    return ResponseEntity.ok(out);
  }

  // -------------------------------------------------------------- intake

  private ResponseEntity<?> submitIntake(Map<String, Object> request) {
    String questionnaireId = str(request.get("questionnaire_id"));
    if (questionnaireId == null) {
      return ResponseEntity.status(400).body(Map.of("error", "questionnaire_id required"));
    }
    List<String> selectedIds = stringList(request.get("selected_option_ids"));
    if (selectedIds.isEmpty()) {
      return ResponseEntity.status(400).body(Map.of("error", "No answers selected"));
    }

    Instant now = Instant.now();
    Map<String, Object> hostOrg = request.get("host_org") instanceof Map<?, ?> m
        ? castMap(m) : Map.of();

    String hostId = orEmpty(str(request.get("host_organisation_id")));
    if (hostId.isEmpty() && !hostOrg.isEmpty()) {
      HostOrganisationEntity host = new HostOrganisationEntity();
      host.setId(newId());
      host.setName(orEmpty(str(hostOrg.get("name"))));
      host.setAccountTypeId(orEmpty(str(hostOrg.get("account_type_id"))));
      host.setAbn(orEmpty(str(hostOrg.get("abn"))));
      host.setContacts(orEmpty(str(hostOrg.get("contacts"))));
      host.setState(orEmpty(str(hostOrg.get("state"))));
      host.setBillingStatus("none");
      host.setInternalNotes("");
      host.setCreatedDate(now);
      host.setUpdatedDate(now);
      host.setIsSample(false);
      hosts.save(host);
      hostId = host.getId();
    }
    if (hostId.isEmpty()) {
      return ResponseEntity.status(400).body(Map.of("error", "Host organisation required"));
    }

    double questionnaireVersion = questionnaires.findById(questionnaireId)
        .map(q -> q.getVersion() == null ? 1 : q.getVersion())
        .orElse(1d);

    // Fetched by id rather than trusting the ids to be options of this
    // questionnaire — an unknown id simply contributes nothing.
    List<IntakeAnswerOptionEntity> selected = options.findByIds(selectedIds);
    RecommendationEngine.Recommendation recommendation = engine.recommend(selected);

    String scaleBandId = selected.stream()
        .map(IntakeAnswerOptionEntity::getScaleBandId)
        .filter(CorporateIntakeController::notBlank)
        .findFirst()
        .orElse("");

    String tierId = recommendation.serviceTierId();
    String tierDeliverables = tierId.isEmpty() ? null : serviceTiers.findById(tierId)
        .map(ServiceTierEntity::getDeliverables)
        .orElse(null);

    IntakeResponseEntity response = new IntakeResponseEntity();
    response.setId(newId());
    response.setHostOrganisationId(hostId);
    response.setQuestionnaireId(questionnaireId);
    response.setQuestionnaireVersion(questionnaireVersion);
    response.setSelectedOptionIds(write(selectedIds));
    response.setFreeTextAnswers(writeObject(request.get("free_text_answers")));
    response.setSubmittedAt(now);
    response.setCreatedDate(now);
    response.setUpdatedDate(now);
    response.setIsSample(false);

    ChallengeRecommendationEntity rec = new ChallengeRecommendationEntity();
    rec.setId(newId());
    rec.setResponseId(response.getId());
    rec.setHostOrganisationId(hostId);
    rec.setTopMechanics(writeScored(recommendation.get("mechanic")));
    rec.setTopCategories(writeScored(recommendation.get("category")));
    rec.setTopModes(writeScored(recommendation.get("mode")));
    rec.setTopAudiences(writeScored(recommendation.get("audience")));
    rec.setTopScoring(writeScored(recommendation.get("scoring")));
    rec.setTopEvidence(writeScored(recommendation.get("evidence")));
    rec.setTopPathways(writeScored(recommendation.get("pathway")));
    rec.setComplianceFlags(write(recommendation.complianceFlags()));
    rec.setRationaleSummary(recommendation.rationaleSummary());
    rec.setServiceTierId(tierId);
    rec.setCreatedDate(now);
    rec.setUpdatedDate(now);
    rec.setIsSample(false);
    recommendations.save(rec);

    // Written after the recommendation so the link is never dangling.
    response.setRecommendationId(rec.getId());
    responses.save(response);

    Map<String, Object> snapshot = new LinkedHashMap<>();
    snapshot.put("mechanics", scoredMaps(recommendation.get("mechanic")));
    snapshot.put("categories", scoredMaps(recommendation.get("category")));
    snapshot.put("modes", scoredMaps(recommendation.get("mode")));
    snapshot.put("audiences", scoredMaps(recommendation.get("audience")));
    snapshot.put("scoring", scoredMaps(recommendation.get("scoring")));
    snapshot.put("evidence", scoredMaps(recommendation.get("evidence")));
    snapshot.put("pathways", scoredMaps(recommendation.get("pathway")));

    ChallengeDraftEntity draft = new ChallengeDraftEntity();
    draft.setId(newId());
    draft.setOrigin("corporate_intake");
    draft.setHostOrganisationId(hostId);
    draft.setRecommendationId(rec.getId());
    draft.setServiceTierId(tierId);
    draft.setScaleBand(scaleBandId);
    draft.setProgramScope(strOr(request.get("program_scope"), "single"));
    draft.setReviewStatus("intake_received");
    draft.setChallengeTitle(orEmpty(str(hostOrg.get("name"))) + " Challenge");
    draft.setDeliverables(tierDeliverables == null ? write(List.of()) : tierDeliverables);
    draft.setRecommendedSnapshot(write(snapshot));
    // Pre-fired so the assessment engine raises obligations from the first
    // save rather than waiting until someone tries to approve it.
    draft.setComplianceFlags(write(recommendation.complianceFlags()));
    draft.setIsTemplate(false);
    draft.setCreatedDate(now);
    draft.setUpdatedDate(now);
    draft.setIsSample(false);
    drafts.save(draft);

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("response_id", response.getId());
    out.put("recommendation_id", rec.getId());
    out.put("draft_id", draft.getId());
    out.put("recommendation", recommendationJson(rec));
    out.put("draft", draftJson(draft));
    return ResponseEntity.ok(out);
  }

  private ResponseEntity<?> getRecommendation(Map<String, Object> request) {
    String responseId = str(request.get("response_id"));
    if (responseId == null) {
      return ResponseEntity.status(400).body(Map.of("error", "response_id required"));
    }
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("recommendation", recommendations.findByResponse(responseId).stream()
        .findFirst().map(this::recommendationJson).orElse(null));
    return ResponseEntity.ok(out);
  }

  // -------------------------------------------------------- admin review

  private ResponseEntity<?> listResponses(Map<String, Object> request) {
    Map<String, ChallengeDraftEntity> draftByHost = new LinkedHashMap<>();
    for (ChallengeDraftEntity d : drafts.findAll()) {
      if (notBlank(d.getHostOrganisationId())) {
        draftByHost.putIfAbsent(d.getHostOrganisationId(), d);
      }
    }
    Map<String, HostOrganisationEntity> hostById = new LinkedHashMap<>();
    for (HostOrganisationEntity h : hosts.findAll()) {
      hostById.putIfAbsent(h.getId(), h);
    }
    Map<String, ChallengeRecommendationEntity> recByResponse = new LinkedHashMap<>();
    for (ChallengeRecommendationEntity r : recommendations.findAllNewestFirst()) {
      recByResponse.putIfAbsent(r.getResponseId(), r);
    }

    Map<String, Object> filter = request.get("filter") instanceof Map<?, ?> m
        ? castMap(m) : Map.of();
    String reviewStatus = str(filter.get("review_status"));
    String tierId = str(filter.get("service_tier_id"));
    String accountTypeId = str(filter.get("account_type_id"));
    String programScope = str(filter.get("program_scope"));
    String complianceFlag = str(filter.get("compliance_flag"));

    List<Map<String, Object>> out = new ArrayList<>();
    for (IntakeResponseEntity r : responses.findAllNewestFirst()) {
      ChallengeDraftEntity draft = draftByHost.get(r.getHostOrganisationId());
      HostOrganisationEntity host = hostById.get(r.getHostOrganisationId());

      if (reviewStatus != null
          && (draft == null || !reviewStatus.equals(draft.getReviewStatus()))) {
        continue;
      }
      if (tierId != null && (draft == null || !tierId.equals(draft.getServiceTierId()))) {
        continue;
      }
      if (accountTypeId != null
          && (host == null || !accountTypeId.equals(host.getAccountTypeId()))) {
        continue;
      }
      if (programScope != null
          && (draft == null || !programScope.equals(draft.getProgramScope()))) {
        continue;
      }
      if (complianceFlag != null
          && (draft == null || !json.stringList(draft.getComplianceFlags())
              .contains(complianceFlag))) {
        continue;
      }

      Map<String, Object> row = new LinkedHashMap<>();
      row.put("response_id", r.getId());
      row.put("submitted_at", iso(r.getSubmittedAt()));
      row.put("host", host == null ? null : hostJson(host));
      row.put("recommendation", recByResponse.get(r.getId()) == null
          ? null : recommendationJson(recByResponse.get(r.getId())));
      row.put("draft", draft == null ? null : draftJson(draft));
      out.add(row);
    }
    return ResponseEntity.ok(Map.of("responses", out));
  }

  private ResponseEntity<?> responseDetail(Map<String, Object> request) {
    String responseId = str(request.get("response_id"));
    if (responseId == null) {
      return ResponseEntity.status(400).body(Map.of("error", "response_id required"));
    }
    Optional<IntakeResponseEntity> found = responses.findById(responseId);
    if (found.isEmpty()) {
      return ResponseEntity.status(404).body(Map.of("error", "Response not found"));
    }
    IntakeResponseEntity response = found.get();

    List<String> selectedIds = json.stringList(response.getSelectedOptionIds());
    List<Map<String, Object>> selectedOptions = new ArrayList<>();
    if (!selectedIds.isEmpty()) {
      Map<String, IntakeAnswerOptionEntity> byId = new LinkedHashMap<>();
      for (IntakeAnswerOptionEntity o : options.findByIds(selectedIds)) {
        byId.put(o.getId(), o);
      }
      // Kept in the order the host answered, not the order the database
      // returned them.
      for (String id : selectedIds) {
        IntakeAnswerOptionEntity option = byId.get(id);
        if (option == null) {
          continue;
        }
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", id);
        row.put("label", option.getLabel());
        row.put("compliance_flags", json.stringList(option.getComplianceFlags()));
        selectedOptions.add(row);
      }
    }

    ChallengeDraftEntity draft = drafts.findAll().stream()
        .filter(d -> response.getHostOrganisationId() != null
            && response.getHostOrganisationId().equals(d.getHostOrganisationId()))
        .findFirst()
        .orElse(null);

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("response", responseJson(response));
    out.put("recommendation", recommendations.findByResponse(responseId).stream()
        .findFirst().map(this::recommendationJson).orElse(null));
    out.put("draft", draft == null ? null : draftJson(draft));
    out.put("host", hosts.findById(orEmpty(response.getHostOrganisationId()))
        .map(this::hostJson).orElse(null));
    out.put("selected_options", selectedOptions);
    return ResponseEntity.ok(out);
  }

  // --------------------------------------------------- service delivery

  private ResponseEntity<?> serviceDelivery(Map<String, Object> request) {
    String draftId = str(request.get("draft_id"));
    if (draftId == null) {
      return ResponseEntity.status(400).body(Map.of("error", "draft_id required"));
    }
    Optional<ChallengeDraftEntity> found = drafts.findById(draftId);
    if (found.isEmpty()) {
      return ResponseEntity.status(404).body(Map.of("error", "Draft not found"));
    }
    ChallengeDraftEntity draft = found.get();

    List<CampaignScaleBandEntity> bands = scaleBands.findInOrder();
    CampaignScaleBandEntity band = bands.stream()
        .filter(b -> b.getId().equals(draft.getScaleBand()))
        .findFirst().orElse(null);
    ServiceTierEntity tier = serviceTiers.findInOrder().stream()
        .filter(t -> t.getId().equals(draft.getServiceTierId()))
        .findFirst().orElse(null);

    EnterpriseQuoteEntity quote = quotes.findByDraft(draftId).stream().findFirst().orElse(null);

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("draft", draftJson(draft));
    out.put("band", band == null ? null : bandJson(band));
    out.put("tier", tier == null ? null : tierJson(tier));
    out.put("deliverables", deliverables.findInOrder().stream()
        .map(this::deliverableJson).toList());
    out.put("resource_types", resourceTypes.findInOrder().stream()
        .map(this::resourceTypeJson).toList());
    out.put("scale_bands", bands.stream().map(this::bandJson).toList());
    out.put("draft_deliverables", json.stringList(draft.getDeliverables()));
    out.put("quote", quote == null ? null : quoteJson(quote));
    // Allocations are only meaningful alongside a quote, matching the original.
    out.put("allocations", quote == null ? List.of()
        : allocations.findByDraft(draftId).stream().map(this::allocationJson).toList());
    return ResponseEntity.ok(out);
  }

  private ResponseEntity<?> updateDeliverables(Map<String, Object> request) {
    String draftId = str(request.get("draft_id"));
    if (draftId == null) {
      return ResponseEntity.status(400).body(Map.of("error", "draft_id required"));
    }
    Optional<ChallengeDraftEntity> found = drafts.findById(draftId);
    if (found.isEmpty()) {
      return ResponseEntity.status(404).body(Map.of("error", "Draft not found"));
    }
    List<String> supplied = stringList(request.get("deliverables"));
    ChallengeDraftEntity draft = found.get();
    draft.setDeliverables(write(supplied));
    draft.setUpdatedDate(Instant.now());
    drafts.save(draft);

    return ResponseEntity.ok(Map.of("ok", true, "deliverables", supplied));
  }

  private ResponseEntity<?> updateScaleBand(Map<String, Object> request) {
    String draftId = str(request.get("draft_id"));
    if (draftId == null) {
      return ResponseEntity.status(400).body(Map.of("error", "draft_id required"));
    }
    Optional<ChallengeDraftEntity> found = drafts.findById(draftId);
    if (found.isEmpty()) {
      return ResponseEntity.status(404).body(Map.of("error", "Draft not found"));
    }
    String scaleBand = orEmpty(str(request.get("scale_band_id")));
    ChallengeDraftEntity draft = found.get();
    draft.setScaleBand(scaleBand);
    draft.setUpdatedDate(Instant.now());
    drafts.save(draft);

    return ResponseEntity.ok(Map.of("ok", true, "scale_band", scaleBand));
  }

  // --------------------------------------------------------------- quotes

  /** One priced resourcing line. */
  private record LineItem(
      String resourceTypeId,
      String name,
      String unit,
      double quantity,
      double rate,
      double lineTotal,
      String notes) {

    Map<String, Object> toMap() {
      Map<String, Object> out = new LinkedHashMap<>();
      out.put("resource_type_id", resourceTypeId);
      out.put("name", name);
      out.put("unit", unit);
      out.put("quantity", quantity);
      out.put("rate", rate);
      out.put("line_total", lineTotal);
      out.put("notes", notes);
      return out;
    }
  }

  /**
   * Prices the supplied allocations.
   *
   * <p>A per-line rate override wins over the resource type's standard rate,
   * but only when it is above zero — zero and absent both mean "use the
   * standard rate", so an empty override field cannot accidentally zero out a
   * line.
   */
  private List<LineItem> priceLines(List<Map<String, Object>> supplied) {
    Map<String, ResourceTypeEntity> byId = new LinkedHashMap<>();
    for (ResourceTypeEntity rt : resourceTypes.findInOrder()) {
      byId.putIfAbsent(rt.getId(), rt);
    }

    List<LineItem> lines = new ArrayList<>();
    for (Map<String, Object> allocation : supplied) {
      String typeId = orEmpty(str(allocation.get("resource_type_id")));
      ResourceTypeEntity type = byId.get(typeId);

      double override = number(allocation.get("rate_override"));
      double rate = override > 0 ? override
          : (type == null || type.getRate() == null ? 0 : type.getRate());
      double quantity = allocation.get("quantity") == null ? 1
          : number(allocation.get("quantity"));

      lines.add(new LineItem(typeId,
          type == null ? "(unknown)" : nz(type.getName()),
          type == null ? "" : nz(type.getUnit()),
          quantity, rate, rate * quantity,
          orEmpty(str(allocation.get("notes")))));
    }
    return lines;
  }

  private ResponseEntity<?> computeQuote(Map<String, Object> request) {
    if (str(request.get("draft_id")) == null) {
      return ResponseEntity.status(400).body(Map.of("error", "draft_id required"));
    }
    List<LineItem> lines = priceLines(mapList(request.get("allocations")));
    double linesTotal = lines.stream().mapToDouble(LineItem::lineTotal).sum();
    double floor = number(request.get("packaged_floor"));

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("line_items", lines.stream().map(LineItem::toMap).toList());
    out.put("lines_total", linesTotal);
    out.put("packaged_floor", floor);
    // A floor, never a ceiling: extra resourcing raises the price, and the
    // packaged minimum still applies when the lines come in under it.
    out.put("total", Math.max(floor, linesTotal));
    return ResponseEntity.ok(out);
  }

  private ResponseEntity<?> saveQuote(Map<String, Object> request) {
    String draftId = str(request.get("draft_id"));
    if (draftId == null) {
      return ResponseEntity.status(400).body(Map.of("error", "draft_id required"));
    }
    List<Map<String, Object>> supplied = mapList(request.get("allocations"));
    List<LineItem> lines = priceLines(supplied);
    double floor = number(request.get("packaged_floor"));
    String accountManager = orEmpty(str(request.get("account_manager")));
    Instant now = Instant.now();

    String quoteId = str(request.get("quote_id"));
    EnterpriseQuoteEntity quote = quoteId == null
        ? null : quotes.findById(quoteId).orElse(null);
    if (quote == null) {
      quote = new EnterpriseQuoteEntity();
      quote.setId(newId());
      quote.setDraftId(draftId);
      quote.setStatus("draft");
      quote.setCreatedDate(now);
      quote.setIsSample(false);
    }
    quote.setLineItems(write(lines.stream().map(LineItem::toMap).toList()));
    quote.setPackagedFloor(floor);
    quote.setAccountManager(accountManager);
    quote.setUpdatedDate(now);
    quotes.save(quote);

    // Allocations are replaced wholesale rather than merged: the request
    // carries the complete intended set, and merging would silently keep lines
    // the account manager deleted.
    allocations.deleteAll(allocations.findByDraft(draftId));
    List<ResourceAllocationEntity> rows = new ArrayList<>();
    for (Map<String, Object> allocation : supplied) {
      ResourceAllocationEntity row = new ResourceAllocationEntity();
      row.setId(newId());
      row.setDraftId(draftId);
      row.setResourceTypeId(orEmpty(str(allocation.get("resource_type_id"))));
      row.setQuantity(allocation.get("quantity") == null ? 1
          : number(allocation.get("quantity")));
      row.setRateOverride(number(allocation.get("rate_override")));
      row.setNotes(orEmpty(str(allocation.get("notes"))));
      row.setCreatedDate(now);
      row.setUpdatedDate(now);
      row.setIsSample(false);
      rows.add(row);
    }
    if (!rows.isEmpty()) {
      allocations.saveAll(rows);
    }

    return ResponseEntity.ok(Map.of("quote", quoteJson(quote)));
  }

  private ResponseEntity<?> setQuoteStatus(Map<String, Object> request, String status) {
    String quoteId = str(request.get("quote_id"));
    if (quoteId == null) {
      return ResponseEntity.status(400).body(Map.of("error", "quote_id required"));
    }
    Optional<EnterpriseQuoteEntity> found = quotes.findById(quoteId);
    if (found.isEmpty()) {
      return ResponseEntity.status(404).body(Map.of("error", "Quote not found"));
    }
    EnterpriseQuoteEntity quote = found.get();
    quote.setStatus(status);
    quote.setUpdatedDate(Instant.now());
    quotes.save(quote);

    return ResponseEntity.ok(Map.of("ok", true, "quote_id", quoteId, "status", status));
  }

  /**
   * Moves a draft through review, refusing the one transition that would
   * commit the business to an unpriced programme.
   */
  private ResponseEntity<?> setDraftStatus(Map<String, Object> request) {
    String draftId = str(request.get("draft_id"));
    String reviewStatus = str(request.get("review_status"));
    if (draftId == null || reviewStatus == null) {
      return ResponseEntity.status(400).body(
          Map.of("error", "draft_id and review_status required"));
    }
    Optional<ChallengeDraftEntity> found = drafts.findById(draftId);
    if (found.isEmpty()) {
      return ResponseEntity.status(404).body(Map.of("error", "Draft not found"));
    }
    ChallengeDraftEntity draft = found.get();

    if ("approved".equals(reviewStatus) && notBlank(draft.getScaleBand())) {
      boolean byProposal = scaleBands.findById(draft.getScaleBand())
          .map(b -> "by_proposal".equals(b.getPricingMode()))
          .orElse(false);
      if (byProposal) {
        boolean accepted = quotes.findByDraft(draftId).stream()
            .anyMatch(q -> "accepted".equals(q.getStatus()));
        if (!accepted) {
          return ResponseEntity.status(409).body(Map.of("error",
              "This draft is on a by-proposal scale band and cannot be approved without "
                  + "an accepted enterprise quote."));
        }
      }
    }

    draft.setReviewStatus(reviewStatus);
    draft.setUpdatedDate(Instant.now());
    drafts.save(draft);

    return ResponseEntity.ok(Map.of("ok", true, "review_status", reviewStatus));
  }

  /**
   * Pushes an approved intake draft into the main challenge system.
   *
   * <p>Refuses a second attempt on a draft that already carries an upstream
   * id, because the main system has no idea this is a retry and would create a
   * duplicate competition.
   */
  private ResponseEntity<?> publishToMain(Map<String, Object> request) {
    String draftId = str(request.get("draft_id"));
    String startDate = str(request.get("start_date"));
    String endDate = str(request.get("end_date"));
    if (draftId == null || startDate == null || endDate == null) {
      return ResponseEntity.status(400).body(
          Map.of("error", "draft_id, start_date and end_date are required"));
    }
    Optional<ChallengeDraftEntity> found = drafts.findById(draftId);
    if (found.isEmpty()) {
      return ResponseEntity.status(404).body(Map.of("error", "Draft not found"));
    }
    ChallengeDraftEntity draft = found.get();
    if (notBlank(draft.getChallengeId())) {
      return ResponseEntity.status(409).body(Map.of(
          "error", "This proposal has already been published to the main system"));
    }

    String title = strOr(request.get("title"),
        blankToNull(draft.getChallengeTitle()) == null
            ? "Untitled challenge" : draft.getChallengeTitle());
    String description = strOr(request.get("description"),
        blankToNull(draft.getChallengeDescription()) == null
            ? title : draft.getChallengeDescription());

    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("title", title);
    payload.put("theme", title);
    payload.put("description", description);
    payload.put("category", strOr(request.get("category"), orEmpty(draft.getCategory())));
    payload.put("start_date", startDate);
    payload.put("end_date", endDate);

    JsonNode result = upstream.post("create_challenge", payload);
    String upstreamId = firstNonBlank(
        result.path("challenge").path("id").asText(""), result.path("id").asText(""));

    if (notBlank(result.path("error").asText("")) || upstreamId == null) {
      String error = notBlank(result.path("error").asText(""))
          ? result.path("error").asText()
          : "Main system did not return a challenge id";
      return ResponseEntity.status(502).body(Map.of("error", error));
    }

    draft.setChallengeId(upstreamId);
    draft.setReviewStatus("live");
    draft.setUpdatedDate(Instant.now());
    drafts.save(draft);

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("ok", true);
    out.put("challenge_id", upstreamId);
    out.put("upstream", result);
    return ResponseEntity.ok(out);
  }

  // -------------------------------------------------------------- shapes

  private Map<String, Object> questionnaireJson(IntakeQuestionnaireEntity q) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", q.getId());
    out.put("name", q.getName());
    out.put("version", q.getVersion());
    out.put("is_active", q.getIsActive());
    out.put("superseded_by_id", q.getSupersededById());
    out.put("change_note", q.getChangeNote());
    out.put("created_date", iso(q.getCreatedDate()));
    return out;
  }

  private Map<String, Object> questionJson(IntakeQuestionEntity q) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", q.getId());
    out.put("questionnaire_id", q.getQuestionnaireId());
    out.put("prompt", q.getPrompt());
    out.put("type", q.getType());
    out.put("sort_order", q.getSortOrder());
    out.put("is_required", q.getIsRequired());
    return out;
  }

  /**
   * What the public questionnaire exposes about an option.
   *
   * <p>Deliberately narrow: the taxonomy id lists are the scoring model, and
   * publishing them would let anyone reverse-engineer which answers produce
   * which recommendation. The original was equally selective.
   */
  private Map<String, Object> publicOptionJson(IntakeAnswerOptionEntity o) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", o.getId());
    out.put("label", o.getLabel());
    out.put("weight", o.getWeight());
    out.put("sort_order", o.getSortOrder());
    out.put("compliance_flags", json.stringList(o.getComplianceFlags()));
    out.put("service_tier_id", orEmpty(o.getServiceTierId()));
    return out;
  }

  private Map<String, Object> responseJson(IntakeResponseEntity r) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", r.getId());
    out.put("host_organisation_id", r.getHostOrganisationId());
    out.put("questionnaire_id", r.getQuestionnaireId());
    out.put("questionnaire_version", r.getQuestionnaireVersion());
    out.put("selected_option_ids", json.stringList(r.getSelectedOptionIds()));
    out.put("free_text_answers", node(r.getFreeTextAnswers()));
    out.put("submitted_at", iso(r.getSubmittedAt()));
    out.put("recommendation_id", r.getRecommendationId());
    return out;
  }

  private Map<String, Object> recommendationJson(ChallengeRecommendationEntity r) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", r.getId());
    out.put("response_id", r.getResponseId());
    out.put("host_organisation_id", r.getHostOrganisationId());
    out.put("top_mechanics", node(r.getTopMechanics()));
    out.put("top_categories", node(r.getTopCategories()));
    out.put("top_modes", node(r.getTopModes()));
    out.put("top_audiences", node(r.getTopAudiences()));
    out.put("top_scoring", node(r.getTopScoring()));
    out.put("top_evidence", node(r.getTopEvidence()));
    out.put("top_pathways", node(r.getTopPathways()));
    out.put("compliance_flags", json.stringList(r.getComplianceFlags()));
    out.put("rationale_summary", r.getRationaleSummary());
    out.put("service_tier_id", r.getServiceTierId());
    out.put("created_date", iso(r.getCreatedDate()));
    return out;
  }

  private Map<String, Object> draftJson(ChallengeDraftEntity d) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", d.getId());
    out.put("origin", d.getOrigin());
    out.put("host_organisation_id", d.getHostOrganisationId());
    out.put("recommendation_id", d.getRecommendationId());
    out.put("service_tier_id", d.getServiceTierId());
    out.put("scale_band", d.getScaleBand());
    out.put("program_scope", d.getProgramScope());
    out.put("review_status", d.getReviewStatus());
    out.put("challenge_id", d.getChallengeId());
    out.put("challenge_title", d.getChallengeTitle());
    out.put("challenge_description", d.getChallengeDescription());
    out.put("category", d.getCategory());
    out.put("deliverables", json.stringList(d.getDeliverables()));
    out.put("recommended_snapshot", node(d.getRecommendedSnapshot()));
    out.put("compliance_flags", json.stringList(d.getComplianceFlags()));
    out.put("created_date", iso(d.getCreatedDate()));
    out.put("updated_date", iso(d.getUpdatedDate()));
    return out;
  }

  private Map<String, Object> hostJson(HostOrganisationEntity h) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", h.getId());
    out.put("name", h.getName());
    out.put("account_type_id", h.getAccountTypeId());
    out.put("abn", h.getAbn());
    out.put("contacts", h.getContacts());
    out.put("state", h.getState());
    out.put("billing_status", h.getBillingStatus());
    out.put("internal_notes", h.getInternalNotes());
    out.put("created_date", iso(h.getCreatedDate()));
    return out;
  }

  private Map<String, Object> accountTypeJson(
      com.fiftythree.challenges.entity.HostAccountTypeEntity a) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", a.getId());
    out.put("name", a.getName());
    out.put("slug", a.getSlug());
    out.put("description", a.getDescription());
    out.put("sort_order", a.getSortOrder());
    out.put("is_active", a.getIsActive());
    return out;
  }

  private Map<String, Object> tierJson(ServiceTierEntity t) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", t.getId());
    out.put("name", t.getName());
    out.put("slug", t.getSlug());
    out.put("description", t.getDescription());
    out.put("operating_model", t.getOperatingModel());
    out.put("deliverables", json.stringList(t.getDeliverables()));
    out.put("sort_order", t.getSortOrder());
    out.put("is_active", t.getIsActive());
    return out;
  }

  private Map<String, Object> bandJson(CampaignScaleBandEntity b) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", b.getId());
    out.put("name", b.getName());
    out.put("service_fee_multiplier", b.getServiceFeeMultiplier());
    out.put("pricing_mode", b.getPricingMode());
    out.put("routing", b.getRouting());
    out.put("is_active", b.getIsActive());
    out.put("sort_order", b.getSortOrder());
    return out;
  }

  private Map<String, Object> deliverableJson(
      com.fiftythree.challenges.entity.DeliverableEntity d) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", d.getId());
    out.put("name", d.getName());
    out.put("description", d.getDescription());
    out.put("default_tiers", json.stringList(d.getDefaultTiers()));
    out.put("is_active", d.getIsActive());
    out.put("sort_order", d.getSortOrder());
    return out;
  }

  private Map<String, Object> resourceTypeJson(ResourceTypeEntity r) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", r.getId());
    out.put("name", r.getName());
    out.put("unit", r.getUnit());
    out.put("rate", r.getRate());
    out.put("is_active", r.getIsActive());
    out.put("sort_order", r.getSortOrder());
    return out;
  }

  private Map<String, Object> quoteJson(EnterpriseQuoteEntity q) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", q.getId());
    out.put("draft_id", q.getDraftId());
    out.put("line_items", node(q.getLineItems()));
    out.put("packaged_floor", q.getPackagedFloor());
    out.put("status", q.getStatus());
    out.put("account_manager", q.getAccountManager());
    out.put("created_date", iso(q.getCreatedDate()));
    out.put("updated_date", iso(q.getUpdatedDate()));
    return out;
  }

  private Map<String, Object> allocationJson(ResourceAllocationEntity a) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", a.getId());
    out.put("draft_id", a.getDraftId());
    out.put("resource_type_id", a.getResourceTypeId());
    out.put("quantity", a.getQuantity());
    out.put("rate_override", a.getRateOverride());
    out.put("notes", a.getNotes());
    return out;
  }

  // ------------------------------------------------------------- helpers

  private String writeScored(List<RecommendationEngine.Scored> scored) {
    return write(scored.stream().map(RecommendationEngine.Scored::toMap).toList());
  }

  private List<Map<String, Object>> scoredMaps(List<RecommendationEngine.Scored> scored) {
    return scored.stream().map(RecommendationEngine.Scored::toMap).toList();
  }

  private JsonNode node(String raw) {
    if (raw == null || raw.isBlank()) {
      return mapper.createObjectNode();
    }
    try {
      return mapper.readTree(raw);
    } catch (Exception e) {
      return mapper.createObjectNode();
    }
  }

  private String write(Object value) {
    try {
      return mapper.writeValueAsString(value);
    } catch (Exception e) {
      throw new IllegalStateException("Could not serialise an intake column", e);
    }
  }

  private String writeObject(Object value) {
    return write(value instanceof Map<?, ?> map ? map : Map.of());
  }

  private static List<String> stringList(Object value) {
    if (!(value instanceof List<?> list)) {
      return List.of();
    }
    return list.stream().map(String::valueOf).toList();
  }

  @SuppressWarnings("unchecked")
  private static List<Map<String, Object>> mapList(Object value) {
    if (!(value instanceof List<?> list)) {
      return List.of();
    }
    List<Map<String, Object>> out = new ArrayList<>();
    for (Object item : list) {
      if (item instanceof Map<?, ?> map) {
        out.add((Map<String, Object>) map);
      }
    }
    return out;
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> castMap(Map<?, ?> supplied) {
    return (Map<String, Object>) supplied;
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

  private static String firstNonBlank(String a, String b) {
    if (notBlank(a)) {
      return a;
    }
    return notBlank(b) ? b : null;
  }

  private static String iso(Instant value) {
    return value == null ? null : value.toString();
  }

  private static boolean notBlank(String value) {
    return value != null && !value.isBlank();
  }

  private static String blankToNull(String value) {
    return notBlank(value) ? value : null;
  }

  private static String strOr(Object value, String fallback) {
    String text = str(value);
    return text == null ? fallback : text;
  }

  private static String orEmpty(String value) {
    return value == null ? "" : value;
  }

  private static String nz(String value) {
    return value == null ? "" : value;
  }

  private static String str(Object value) {
    if (value == null) {
      return null;
    }
    String text = String.valueOf(value).trim();
    return text.isEmpty() ? null : text;
  }

  private static String newId() {
    return UUID.randomUUID().toString().replace("-", "").substring(0, 24);
  }
}
