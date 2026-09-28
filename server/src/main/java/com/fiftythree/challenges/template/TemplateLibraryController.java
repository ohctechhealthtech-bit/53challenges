package com.fiftythree.challenges.template;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fiftythree.challenges.entity.ChallengeDraftEntity;
import com.fiftythree.challenges.security.CallerResolver;
import com.fiftythree.challenges.upstream.ChallengeApiClient;
import com.fiftythree.challenges.upstream.ChallengeApiClient.UpstreamResponse;
import com.fiftythree.challenges.support.ApiErrors;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * The Java replacement for the {@code templateLibrary} function: the admin
 * template library, and the host-facing template picker that feeds off it.
 *
 * <p>Two different catalogues meet here, and confusing them is the easiest way
 * to break this endpoint:
 *
 * <ul>
 *   <li>{@code recommend} and {@code selectTemplate} read the <b>Challenge Idea
 *       Templates API</b>, a separate master service. Those templates are never
 *       stored in this database.
 *   <li>Everything else reads and writes <b>this app's</b> {@code challenge_draft}
 *       rows where {@code is_template} is true.
 * </ul>
 *
 * <p>Selecting a template freezes a full snapshot onto the proposal. That is
 * deliberate: a host who applied under one set of rules keeps those rules even
 * after an admin publishes version 4, and the snapshot is what an adjudicator
 * reads back months later.
 */
@RestController
public class TemplateLibraryController {

  private static final Logger log = LoggerFactory.getLogger(TemplateLibraryController.class);

  /**
   * The only fields {@code save} will write. A whitelist rather than a patch
   * merge, so a browser cannot post {@code template_status: 'active'} and skip
   * validation entirely.
   */
  private static final Set<String> TEMPLATE_FIELDS = Set.of(
      "template_name",
      "primary_category_id",
      "subcategory_id",
      "service_tier",
      "template_tags",
      "concept_pack",
      "rules_pack",
      "brand_pack",
      "lock_map",
      "template_recommendation_config");

  /** The audit log keeps the most recent 50 entries, oldest dropped first. */
  private static final int AUDIT_LOG_LIMIT = 49;

  private final TemplateQueryRepository templates;
  private final TemplateDefaults defaults;
  private final TemplateValidator validator;
  private final ChallengeApiClient upstream;
  private final CallerResolver caller;

  public TemplateLibraryController(
      TemplateQueryRepository templates,
      TemplateDefaults defaults,
      TemplateValidator validator,
      ChallengeApiClient upstream,
      CallerResolver caller) {
    this.templates = templates;
    this.defaults = defaults;
    this.validator = validator;
    this.upstream = upstream;
    this.caller = caller;
  }

  @PostMapping("/api/apps/{appId}/functions/templateLibrary")
  public ResponseEntity<?> handle(@RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> request = body == null ? Map.of() : body;
    String action = str(request.get("action"));

    try {
      // Public: visitors browse the catalogue before they ever sign in.
      if ("recommend".equals(action)) {
        return recommend(request);
      }

      String email = caller.email(str(request.get("session_token")));
      if (email == null) {
        return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
      }
      boolean isAdmin = caller.isAdmin(str(request.get("session_token")));

      if ("selectTemplate".equals(action)) {
        return selectTemplate(request);
      }

      if (!isAdmin) {
        return ResponseEntity.status(403).body(Map.of("error", "Admin access required"));
      }

      return switch (action == null ? "" : action) {
        case "list" -> list(request);
        case "versions" -> versions(request);
        case "create" -> create(email);
        case "importDrafts" -> importDrafts(request, email);
        case "save" -> save(request, email);
        case "validate" -> validate(request);
        case "publish" -> publish(request, email);
        case "newVersion" -> newVersion(request, email);
        case "archive" -> archive(request, email);
        case "approveProposal" -> approveProposal(request, email);
        default -> ResponseEntity.status(400).body(Map.of("error", "Unknown action"));
      };
    } catch (Exception e) {
      log.error("templateLibrary action '{}' failed", action, e);
      return ApiErrors.internal(e);
    }
  }

  // ---------------------------------------------------------------- host side

  /**
   * The ready-to-run challenges a host starts from, straight off the master
   * API. Sorted by the master's own {@code sort_order} — the curator's running
   * order, not a relevance score — and the first one is flagged as the best
   * match because the wizard highlights exactly one card.
   */
  private ResponseEntity<?> recommend(Map<String, Object> request) {
    List<ObjectNode> list = wizardTemplates(
        upstream.getFrom(templatesApi(), "templates", Map.of("status", "active")), "templates");

    list.sort(Comparator.comparingDouble(t -> t.path("sort_order").asDouble(0)));

    int limit = intOr(request.get("limit"), 5);
    ArrayNode out = defaults.array();
    for (int i = 0; i < Math.min(limit, list.size()); i++) {
      out.add(list.get(i).put("is_best_match", i == 0));
    }
    return ResponseEntity.ok(Map.of("templates", out));
  }

  /**
   * Starts a proposal from a master template, freezing a snapshot of it.
   *
   * <p>Only the host-facing summary goes back to the browser. The frozen rules,
   * operations and legal packs stay server-side: the host is applying under
   * them, not negotiating them.
   */
  private ResponseEntity<?> selectTemplate(Map<String, Object> request) {
    String templateId = str(request.get("template_id"));
    List<ObjectNode> found = wizardTemplates(
        upstream.getFrom(templatesApi(), "template",
            templateId == null ? Map.of() : Map.of("id", templateId)),
        "template");

    if (found.isEmpty()) {
      return ResponseEntity.status(404).body(Map.of("error", "Template is not available"));
    }
    ObjectNode t = found.get(0);
    Instant now = Instant.now();

    ObjectNode concept = defaults.object();
    concept.put("package_name", t.path("template_name").asText(""));
    concept.put("challenge_description", t.path("summary").asText(""));
    concept.put("entry_type", t.path("entry_type").asText(""));
    concept.set("recommended_duration_weeks", t.get("recommended_duration_weeks"));
    concept.put("category", t.path("category").asText(""));
    concept.put("image_url", t.path("image_url").asText(""));

    ObjectNode rules = defaults.object();
    rules.set("age_groups", t.get("age_groups"));
    rules.set("rules_expectations", t.get("rules_expectations"));
    rules.put("winner_selection_method", t.path("winner_selection_method").asText(""));
    rules.set("entry_limit_per_participant", t.get("entry_limit_per_participant"));

    ObjectNode snapshot = defaults.object();
    snapshot.put("template_id", t.path("id").asText(""));
    snapshot.put("template_name", t.path("template_name").asText(""));
    snapshot.put("template_status_at_selection", t.path("status").asText(""));
    snapshot.put("service_tier", "standard");
    snapshot.set("concept_pack", concept);
    snapshot.set("rules_pack", rules);
    snapshot.set("brand_pack", defaults.object());
    snapshot.set("lock_map", defaults.defaultLockMap());
    snapshot.put("snapshot_created_at", now.toString());

    ChallengeDraftEntity proposal = new ChallengeDraftEntity();
    proposal.setId(newId());
    proposal.setOrigin("host_apply");
    proposal.setIsTemplate(false);
    proposal.setReviewStatus("builder_started");
    proposal.setChallengeTitle(t.path("template_name").asText(""));
    proposal.setChallengeDescription(t.path("summary").asText(""));
    proposal.setCategory(t.path("category").asText(""));
    proposal.setTemplateId(t.path("id").asText(""));
    proposal.setTemplateVersionSnapshot(defaults.write(snapshot));
    proposal.setTemplateSnapshotCreatedAt(now);
    proposal.setHostBrandOverrides(defaults.write(defaults.object()));
    proposal.setCreatedDate(now);
    proposal.setUpdatedDate(now);
    templates.save(proposal);

    ObjectNode visibleSnapshot = defaults.object();
    visibleSnapshot.put("template_name", snapshot.path("template_name").asText(""));
    visibleSnapshot.put("service_tier", "standard");
    visibleSnapshot.set("brand_pack", defaults.object());
    visibleSnapshot.set("lock_map", defaults.defaultLockMap());

    ObjectNode visible = defaults.object();
    visible.put("id", proposal.getId());
    visible.put("challenge_title", proposal.getChallengeTitle());
    visible.put("challenge_description", proposal.getChallengeDescription());
    visible.put("category", proposal.getCategory());
    visible.put("review_status", proposal.getReviewStatus());
    visible.set("template_version_snapshot", visibleSnapshot);
    visible.set("host_brand_overrides", defaults.object());

    return ResponseEntity.ok(Map.of("proposal", visible));
  }

  // --------------------------------------------------------------- admin side

  private ResponseEntity<?> list(Map<String, Object> request) {
    List<ChallengeDraftEntity> rows =
        new ArrayList<>(templates.findTemplates(PageRequest.of(0, 500)));

    String search = str(request.get("search"));
    if (search != null) {
      String needle = search.toLowerCase(Locale.ROOT);
      rows.removeIf(t -> !orEmpty(t.getTemplateName()).toLowerCase(Locale.ROOT).contains(needle));
    }
    String status = str(request.get("status"));
    if (status != null) {
      rows.removeIf(t -> !status.equals(t.getTemplateStatus()));
    }
    String category = str(request.get("category"));
    if (category != null) {
      rows.removeIf(t -> !category.equals(t.getPrimaryCategoryId()));
    }
    String tier = str(request.get("service_tier"));
    if (tier != null) {
      rows.removeIf(t -> !tier.equals(t.getServiceTier()));
    }

    String sort = str(request.get("sort"));
    if ("name".equals(sort)) {
      rows.sort(Comparator.comparing(t -> orEmpty(t.getTemplateName())));
    } else if ("version".equals(sort)) {
      rows.sort(Comparator.comparingDouble(
          (ChallengeDraftEntity t) -> t.getTemplateVersion() == null ? 0 : t.getTemplateVersion())
          .reversed());
    }

    return ResponseEntity.ok(Map.of("templates", toJsonList(rows)));
  }

  private ResponseEntity<?> versions(Map<String, Object> request) {
    String familyId = str(request.get("template_family_id"));
    List<ChallengeDraftEntity> rows =
        familyId == null ? List.of() : templates.findFamily(familyId);
    return ResponseEntity.ok(Map.of("versions", toJsonList(rows)));
  }

  private ResponseEntity<?> create(String actor) {
    Instant now = Instant.now();
    ChallengeDraftEntity draft = blankTemplate(now);
    // The original inserted, then updated to add the audit entry, because it
    // only learned the id after the insert. The id is generated here, so one
    // insert carries the same entry.
    draft.setTemplateAuditLog(defaults.write(audit(draft, "template_created", actor, null)));
    templates.save(draft);
    return ResponseEntity.ok(Map.of("template", toJson(draft)));
  }

  /**
   * Bulk import. Every row lands as a <b>draft</b>, never active: an import is
   * a starting point for an admin to finish, and publishing is the one step
   * that runs validation.
   */
  private ResponseEntity<?> importDrafts(Map<String, Object> request, String actor) {
    Object raw = request.get("records");
    if (!(raw instanceof List<?> rows) || rows.isEmpty()) {
      return ResponseEntity.status(400).body(Map.of("error", "No records supplied"));
    }

    List<Map<String, Object>> created = new ArrayList<>();
    List<Map<String, Object>> skipped = new ArrayList<>();

    for (Object row : rows) {
      if (!(row instanceof Map<?, ?> record)) {
        skipped.add(Map.of("reason", "Record is not an object"));
        continue;
      }
      String code = pick(record, "templatecode", "template_code", "template_name");
      String familyId = firstNonBlank(
          pick(record, "templatefamilyid", "template_family_id"), code);
      double version = Math.max(1, intOr(
          firstNonBlank(pick(record, "templateversion"), pick(record, "template_version")), 1));

      if (code == null || familyId == null) {
        skipped.add(Map.of("reason", "Missing template code or family id"));
        continue;
      }
      if (!templates.findFamilyVersion(familyId, version).isEmpty()) {
        skipped.add(Map.of("template_code", code, "reason", "This version already exists"));
        continue;
      }

      Instant now = Instant.now();
      ChallengeDraftEntity rec = blankTemplate(now);
      rec.setTemplateName(code);
      rec.setTemplateFamilyId(familyId);
      rec.setTemplateVersion(version);
      rec.setTemplateStatus("draft");
      overrideIfPresent(record, rec::setConceptPack, "conceptpack", "concept_pack");
      overrideIfPresent(record, rec::setRulesPack, "rulespack", "rules_pack");
      overrideIfPresent(record, rec::setBrandPack, "brandpack", "brand_pack");

      ObjectNode extra = defaults.object();
      extra.put("template_code", code);
      rec.setTemplateAuditLog(defaults.write(audit(rec, "draft_imported", actor, extra)));
      templates.save(rec);

      Map<String, Object> summary = new LinkedHashMap<>();
      summary.put("id", rec.getId());
      summary.put("template_name", rec.getTemplateName());
      summary.put("template_version", rec.getTemplateVersion());
      created.add(summary);
    }

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("imported", created.size());
    result.put("created", created);
    result.put("skipped", skipped);
    return ResponseEntity.ok(result);
  }

  /**
   * Edits a draft.
   *
   * <p>Only drafts. A published template has been copied onto live proposals,
   * so editing it in place would rewrite the rules underneath challenges that
   * are already running — the answer is a new version, and the 409 says so.
   */
  private ResponseEntity<?> save(Map<String, Object> request, String actor) {
    Optional<ChallengeDraftEntity> found = template(request.get("id"));
    if (found.isEmpty()) {
      return ResponseEntity.status(400).body(Map.of("error", "Not a template record"));
    }
    ChallengeDraftEntity current = found.get();
    if (!"draft".equals(current.getTemplateStatus())) {
      return ResponseEntity.status(409).body(Map.of(
          "error", "Only draft templates can be edited. Create a new version instead."));
    }

    Object patch = request.get("patch");
    if (patch instanceof Map<?, ?> fields) {
      for (Map.Entry<?, ?> field : fields.entrySet()) {
        String name = String.valueOf(field.getKey());
        if (field.getValue() == null || !TEMPLATE_FIELDS.contains(name)) {
          continue;
        }
        applyField(current, name, field.getValue());
      }
    }
    current.setTemplateAuditLog(defaults.write(audit(current, "draft_edited", actor, null)));
    current.setUpdatedDate(Instant.now());
    templates.save(current);

    return ResponseEntity.ok(Map.of("template", toJson(current)));
  }

  private ResponseEntity<?> validate(Map<String, Object> request) {
    Optional<ChallengeDraftEntity> found = byId(request.get("id"));
    List<String> errors = found.map(this::validationErrors).orElseGet(List::of);
    return ResponseEntity.ok(Map.of("errors", errors));
  }

  /**
   * Publishes a draft and retires whatever version was active before it.
   *
   * <p>Exactly one version of a family may be active, because
   * {@code selectTemplate} resolves a family to a single template. The
   * supersede loop and the count check afterwards are both about keeping that
   * true; when the count comes back wrong the template is still published, but
   * the response carries a repair warning rather than pretending it is fine.
   */
  private ResponseEntity<?> publish(Map<String, Object> request, String actor) {
    Optional<ChallengeDraftEntity> found = template(request.get("id"));
    if (found.isEmpty()) {
      return ResponseEntity.status(400).body(Map.of("error", "Not a template record"));
    }
    ChallengeDraftEntity current = found.get();
    if (!"draft".equals(current.getTemplateStatus())) {
      return ResponseEntity.status(409).body(
          Map.of("error", "Only draft templates can be published."));
    }
    List<String> errors = validationErrors(current);
    if (!errors.isEmpty()) {
      return ResponseEntity.status(400).body(Map.of("errors", errors));
    }

    List<ChallengeDraftEntity> family = templates.findFamily(current.getTemplateFamilyId());
    double version = version(current);
    for (ChallengeDraftEntity sibling : family) {
      if ("active".equals(sibling.getTemplateStatus()) && version(sibling) > version) {
        return ResponseEntity.status(409).body(
            Map.of("error", "A newer version of this template is already active."));
      }
    }

    Instant now = Instant.now();
    ObjectNode change = defaults.object();
    change.put("old_status", "draft");
    change.put("new_status", "active");
    current.setTemplateAuditLog(
        defaults.write(audit(current, "template_published", actor, change)));
    current.setTemplateStatus("active");
    current.setPublishedAt(now);
    current.setPublishedBy(actor);
    current.setUpdatedDate(now);
    templates.save(current);

    for (ChallengeDraftEntity old : family) {
      if (!"active".equals(old.getTemplateStatus()) || old.getId().equals(current.getId())) {
        continue;
      }
      ObjectNode superseded = defaults.object();
      superseded.put("old_status", "active");
      superseded.put("new_status", "superseded");
      superseded.put("superseded_by_version", version);
      old.setTemplateAuditLog(
          defaults.write(audit(old, "version_superseded", actor, superseded)));
      old.setTemplateStatus("superseded");
      old.setSupersededById(current.getId());
      old.setSupersededAt(now);
      old.setSupersededByUser(actor);
      old.setUpdatedDate(now);
      templates.save(old);
    }

    long active = templates.findFamily(current.getTemplateFamilyId()).stream()
        .filter(t -> "active".equals(t.getTemplateStatus()))
        .count();
    Map<String, Object> response = new LinkedHashMap<>();
    response.put("template", toJson(current));
    if (active != 1) {
      response.put("repair_warning", "Expected exactly one active version, found " + active
          + ". Review this template family.");
    }
    return ResponseEntity.ok(response);
  }

  /** Clones the current version into a fresh draft, so edits never touch a live template. */
  private ResponseEntity<?> newVersion(Map<String, Object> request, String actor) {
    Optional<ChallengeDraftEntity> found = template(request.get("id"));
    if (found.isEmpty()) {
      return ResponseEntity.status(400).body(Map.of("error", "Not a template record"));
    }
    ChallengeDraftEntity current = found.get();
    List<ChallengeDraftEntity> family = templates.findFamily(current.getTemplateFamilyId());
    if (family.stream().anyMatch(t -> "draft".equals(t.getTemplateStatus()))) {
      return ResponseEntity.status(409).body(
          Map.of("error", "A draft version of this template already exists."));
    }

    double next = family.stream().mapToDouble(TemplateLibraryController::version).max().orElse(1) + 1;
    Instant now = Instant.now();

    ChallengeDraftEntity clone = new ChallengeDraftEntity();
    clone.setId(newId());
    clone.setOrigin("admin_created");
    clone.setIsTemplate(true);
    clone.setTemplateName(current.getTemplateName());
    clone.setTemplateFamilyId(current.getTemplateFamilyId());
    clone.setTemplateVersion(next);
    clone.setTemplateStatus("draft");
    clone.setPreviousVersionId(current.getId());
    clone.setPrimaryCategoryId(current.getPrimaryCategoryId());
    clone.setSubcategoryId(current.getSubcategoryId());
    clone.setServiceTier(current.getServiceTier());
    clone.setTemplateTags(defaults.write(defaults.readArray(current.getTemplateTags())));
    clone.setConceptPack(packOrEmpty(current.getConceptPack()));
    clone.setRulesPack(packOrEmpty(current.getRulesPack()));
    clone.setBrandPack(packOrEmpty(current.getBrandPack()));
    clone.setParticipationPack(packOrEmpty(current.getParticipationPack()));
    clone.setOperationsPack(packOrEmpty(current.getOperationsPack()));
    clone.setLegalPack(packOrEmpty(current.getLegalPack()));
    ObjectNode lockMap = defaults.read(current.getLockMap());
    clone.setLockMap(defaults.write(lockMap.isEmpty() ? defaults.defaultLockMap() : lockMap));
    clone.setTemplateRecommendationConfig(
        packOrEmpty(current.getTemplateRecommendationConfig()));
    clone.setCreatedDate(now);
    clone.setUpdatedDate(now);

    ObjectNode extra = defaults.object();
    extra.put("from_version", version(current));
    clone.setTemplateAuditLog(
        defaults.write(audit(clone, "new_version_created", actor, extra)));
    templates.save(clone);

    return ResponseEntity.ok(Map.of("template", toJson(clone)));
  }

  private ResponseEntity<?> archive(Map<String, Object> request, String actor) {
    String reason = str(request.get("reason"));
    if (reason == null) {
      return ResponseEntity.status(400).body(Map.of("error", "An archive reason is required."));
    }
    Optional<ChallengeDraftEntity> found = byId(request.get("id"));
    if (found.isEmpty()) {
      return ResponseEntity.status(404).body(Map.of("error", "Template not found"));
    }
    ChallengeDraftEntity current = found.get();

    ObjectNode extra = defaults.object();
    extra.put("old_status", current.getTemplateStatus());
    extra.put("new_status", "archived");
    extra.put("reason", reason);
    current.setTemplateAuditLog(
        defaults.write(audit(current, "template_archived", actor, extra)));

    Instant now = Instant.now();
    current.setTemplateStatus("archived");
    current.setArchivedAt(now);
    current.setArchivedBy(actor);
    current.setArchiveReason(reason);
    current.setUpdatedDate(now);
    templates.save(current);

    return ResponseEntity.ok(Map.of("template", toJson(current)));
  }

  /**
   * Locks a proposal's branding and approves it.
   *
   * <p>The lock is one-way on purpose: once approved, the brand pack is what
   * gets printed, published and judged against, and the 409 on a second attempt
   * stops a later edit quietly changing what was signed off.
   */
  private ResponseEntity<?> approveProposal(Map<String, Object> request, String actor) {
    Optional<ChallengeDraftEntity> found = byId(request.get("proposal_id"));
    if (found.isEmpty()) {
      return ResponseEntity.status(404).body(Map.of("error", "Proposal not found"));
    }
    ChallengeDraftEntity proposal = found.get();
    if (Boolean.TRUE.equals(proposal.getApprovalLocked())) {
      return ResponseEntity.status(409).body(
          Map.of("error", "This proposal is already locked and approved."));
    }

    ObjectNode snapshot = defaults.read(proposal.getTemplateVersionSnapshot());
    // An admin who sends no adjustments keeps whatever was already on the
    // proposal, so re-opening the screen and approving does not wipe them.
    ObjectNode adjustments =
        request.get("admin_brand_adjustments") instanceof Map<?, ?> supplied
            && defaults.toNode(supplied) instanceof ObjectNode sent
            ? sent
            : defaults.read(proposal.getAdminBrandAdjustments());

    ObjectNode approved = defaults.mergeApprovedBrand(
        snapshot.get("brand_pack"),
        defaults.read(proposal.getHostBrandOverrides()),
        adjustments,
        snapshot.get("lock_map"));

    Instant now = Instant.now();
    proposal.setAdminBrandAdjustments(defaults.write(adjustments));
    proposal.setApprovedBrandPack(defaults.write(approved));
    proposal.setApprovedBy(actor);
    proposal.setApprovedAt(now);
    proposal.setApprovalLocked(true);
    proposal.setReviewStatus("approved");
    proposal.setUpdatedDate(now);
    templates.save(proposal);

    return ResponseEntity.ok(Map.of("proposal", toJson(proposal)));
  }

  // ------------------------------------------------------------------ helpers

  private ChallengeDraftEntity blankTemplate(Instant now) {
    ChallengeDraftEntity draft = new ChallengeDraftEntity();
    draft.setId(newId());
    draft.setOrigin("admin_created");
    draft.setIsTemplate(true);
    draft.setTemplateName("Untitled template");
    draft.setTemplateFamilyId(defaults.newFamilyId());
    draft.setTemplateVersion(1d);
    draft.setTemplateStatus("draft");
    draft.setServiceTier("standard");
    draft.setTemplateTags(defaults.write(defaults.array()));
    draft.setConceptPack(defaults.write(defaults.blankConceptPack()));
    draft.setRulesPack(defaults.write(defaults.blankRulesPack()));
    draft.setBrandPack(defaults.write(defaults.blankBrandPack()));
    draft.setParticipationPack(defaults.write(defaults.object()));
    draft.setOperationsPack(defaults.write(defaults.object()));
    draft.setLegalPack(defaults.write(defaults.object()));
    draft.setLockMap(defaults.write(defaults.defaultLockMap()));
    draft.setTemplateRecommendationConfig(defaults.write(defaults.blankRecommendationConfig()));
    draft.setTemplateAuditLog(defaults.write(defaults.array()));
    draft.setCreatedDate(now);
    draft.setUpdatedDate(now);
    return draft;
  }

  private List<String> validationErrors(ChallengeDraftEntity t) {
    return validator.validate(
        t.getTemplateName(),
        t.getPrimaryCategoryId(),
        defaults.read(t.getConceptPack()),
        defaults.read(t.getRulesPack()),
        defaults.read(t.getBrandPack()));
  }

  /** Appends one entry, keeping the log at 50 by dropping the oldest. */
  private ArrayNode audit(
      ChallengeDraftEntity record, String action, String actor, ObjectNode extra) {

    ArrayNode existing = defaults.readArray(record.getTemplateAuditLog());
    ArrayNode log = defaults.array();
    int from = Math.max(0, existing.size() - AUDIT_LOG_LIMIT);
    for (int i = from; i < existing.size(); i++) {
      log.add(existing.get(i));
    }

    ObjectNode entry = defaults.object();
    entry.put("action", action);
    entry.put("actor", actor == null ? "unknown" : actor);
    entry.put("at", Instant.now().toString());
    entry.put("template_id", orEmpty(record.getId()));
    entry.put("template_family_id", orEmpty(record.getTemplateFamilyId()));
    entry.put("template_version", version(record));
    if (extra != null) {
      entry.setAll(extra);
    }
    log.add(entry);
    return log;
  }

  /** Writes one whitelisted patch field, JSON columns serialised as they arrive. */
  private void applyField(ChallengeDraftEntity t, String name, Object value) {
    switch (name) {
      case "template_name" -> t.setTemplateName(String.valueOf(value));
      case "primary_category_id" -> t.setPrimaryCategoryId(String.valueOf(value));
      case "subcategory_id" -> t.setSubcategoryId(String.valueOf(value));
      case "service_tier" -> t.setServiceTier(String.valueOf(value));
      case "template_tags" -> t.setTemplateTags(defaults.write(defaults.toNode(value)));
      case "concept_pack" -> t.setConceptPack(defaults.write(defaults.toNode(value)));
      case "rules_pack" -> t.setRulesPack(defaults.write(defaults.toNode(value)));
      case "brand_pack" -> t.setBrandPack(defaults.write(defaults.toNode(value)));
      case "lock_map" -> t.setLockMap(defaults.write(defaults.toNode(value)));
      case "template_recommendation_config" ->
          t.setTemplateRecommendationConfig(defaults.write(defaults.toNode(value)));
      default -> { }
    }
  }

  /** The record as the Base44 entity API returned it: snake_case, packs inflated. */
  private ObjectNode toJson(ChallengeDraftEntity t) {
    ObjectNode out = defaults.object();
    out.put("id", t.getId());
    out.put("origin", t.getOrigin());
    out.put("is_template", t.getIsTemplate());
    out.put("template_name", t.getTemplateName());
    out.put("template_family_id", t.getTemplateFamilyId());
    out.put("template_version", t.getTemplateVersion());
    out.put("template_status", t.getTemplateStatus());
    out.put("previous_version_id", t.getPreviousVersionId());
    out.put("superseded_by_id", t.getSupersededById());
    out.put("superseded_at", iso(t.getSupersededAt()));
    out.put("superseded_by_user", t.getSupersededByUser());
    out.put("published_at", iso(t.getPublishedAt()));
    out.put("published_by", t.getPublishedBy());
    out.put("archived_at", iso(t.getArchivedAt()));
    out.put("archived_by", t.getArchivedBy());
    out.put("archive_reason", t.getArchiveReason());
    out.put("primary_category_id", t.getPrimaryCategoryId());
    out.put("subcategory_id", t.getSubcategoryId());
    out.put("service_tier", t.getServiceTier());
    out.set("template_tags", defaults.readArray(t.getTemplateTags()));
    out.set("concept_pack", defaults.read(t.getConceptPack()));
    out.set("rules_pack", defaults.read(t.getRulesPack()));
    out.set("brand_pack", defaults.read(t.getBrandPack()));
    out.set("participation_pack", defaults.read(t.getParticipationPack()));
    out.set("operations_pack", defaults.read(t.getOperationsPack()));
    out.set("legal_pack", defaults.read(t.getLegalPack()));
    out.set("lock_map", defaults.read(t.getLockMap()));
    out.set("template_recommendation_config",
        defaults.read(t.getTemplateRecommendationConfig()));
    out.set("template_audit_log", defaults.readArray(t.getTemplateAuditLog()));

    // Proposal-side fields. Present on every record because the original
    // returned the whole row and the approval screen reads them off it.
    out.put("review_status", t.getReviewStatus());
    out.put("challenge_title", t.getChallengeTitle());
    out.put("challenge_description", t.getChallengeDescription());
    out.put("category", t.getCategory());
    out.put("template_id", t.getTemplateId());
    out.set("template_version_snapshot", defaults.read(t.getTemplateVersionSnapshot()));
    out.put("template_snapshot_created_at", iso(t.getTemplateSnapshotCreatedAt()));
    out.set("host_brand_overrides", defaults.read(t.getHostBrandOverrides()));
    out.set("admin_brand_adjustments", defaults.read(t.getAdminBrandAdjustments()));
    out.set("approved_brand_pack", defaults.read(t.getApprovedBrandPack()));
    out.put("approved_by", t.getApprovedBy());
    out.put("approved_at", iso(t.getApprovedAt()));
    out.put("approval_locked", t.getApprovalLocked());

    out.put("created_date", iso(t.getCreatedDate()));
    out.put("updated_date", iso(t.getUpdatedDate()));
    out.put("created_by_id", t.getCreatedById());
    return out;
  }

  private ArrayNode toJsonList(List<ChallengeDraftEntity> rows) {
    ArrayNode out = defaults.array();
    for (ChallengeDraftEntity row : rows) {
      out.add(toJson(row));
    }
    return out;
  }

  /**
   * The host-safe shape the wizard understands, from {@code toWizardTemplate}.
   * Accepts either the list response or the single-template one, so both
   * callers share the null handling.
   */
  private List<ObjectNode> wizardTemplates(UpstreamResponse response, String field) {
    List<ObjectNode> out = new ArrayList<>();
    JsonNode body = response == null ? null : response.body();
    JsonNode payload = body == null ? null : body.get(field);
    if (payload == null || payload.isNull()) {
      return out;
    }
    List<JsonNode> records = new ArrayList<>();
    if (payload.isArray()) {
      payload.forEach(records::add);
    } else {
      records.add(payload);
    }

    for (JsonNode t : records) {
      if (!t.isObject()) {
        continue;
      }
      ObjectNode w = defaults.object();
      w.put("id", t.path("id").asText(null));
      w.put("template_name", t.path("template_name").asText(null));
      w.put("summary", t.path("summary").asText(""));
      w.put("entry_type", t.path("entry_type").asText(""));
      w.set("recommended_duration_weeks", numberOrNull(t.get("recommended_duration_weeks")));
      w.put("category", t.path("category").asText(""));
      w.set("age_groups", arrayOrEmpty(t.get("age_groups")));
      w.set("rules_expectations", arrayOrEmpty(t.get("rules_expectations")));
      w.put("winner_selection_method", t.path("winner_selection_method").asText(""));
      w.set("entry_limit_per_participant", numberOrNull(t.get("entry_limit_per_participant")));
      w.put("image_url", t.path("image_url").asText(""));
      // A template with no status is treated as active, as the master API's
      // own clients do — absent means "not yet retired", not "not usable".
      String status = t.path("status").asText("");
      w.put("status", status.isBlank() ? "active" : status);
      w.put("sort_order", t.path("sort_order").asDouble(0));
      out.add(w);
    }
    return out;
  }

  private JsonNode numberOrNull(JsonNode value) {
    // Matches `t.x || null`: 0 is falsy in JavaScript and came back as null.
    return value == null || value.isNull() || value.asDouble(0) == 0
        ? defaults.nullNode()
        : value;
  }

  private ArrayNode arrayOrEmpty(JsonNode value) {
    return value instanceof ArrayNode array ? array : defaults.array();
  }

  /** The template API lives on the parent app, alongside every other function. */
  private String templatesApi() {
    return upstream.sibling("ideaTemplatesApi");
  }

  private Optional<ChallengeDraftEntity> byId(Object id) {
    String key = str(id);
    return key == null ? Optional.empty() : templates.findById(key);
  }

  /** A record that exists <b>and</b> is a template; anything else is a 400. */
  private Optional<ChallengeDraftEntity> template(Object id) {
    return byId(id).filter(t -> Boolean.TRUE.equals(t.getIsTemplate()));
  }

  private String packOrEmpty(String raw) {
    return raw == null || raw.isBlank() ? defaults.write(defaults.object()) : raw;
  }

  private void overrideIfPresent(
      Map<?, ?> record, java.util.function.Consumer<String> setter, String... keys) {
    for (String key : keys) {
      Object value = record.get(key);
      if (value != null && !"".equals(value)) {
        setter.accept(defaults.write(defaults.toNode(value)));
        return;
      }
    }
  }

  private static double version(ChallengeDraftEntity t) {
    return t.getTemplateVersion() == null ? 1 : t.getTemplateVersion();
  }

  private static String pick(Map<?, ?> record, String... keys) {
    for (String key : keys) {
      String value = str(record.get(key));
      if (value != null) {
        return value;
      }
    }
    return null;
  }

  private static String firstNonBlank(String... values) {
    for (String value : values) {
      if (value != null && !value.isBlank()) {
        return value;
      }
    }
    return null;
  }

  private static int intOr(Object value, int fallback) {
    if (value instanceof Number n) {
      return n.intValue();
    }
    try {
      return value == null ? fallback : (int) Double.parseDouble(String.valueOf(value));
    } catch (NumberFormatException e) {
      return fallback;
    }
  }

  private static String iso(Instant value) {
    return value == null ? null : value.toString();
  }

  private static String orEmpty(String value) {
    return value == null ? "" : value;
  }

  private static String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value;
  }

  /** A 24-character hex id, the shape Base44 gave every record. */
  private static String newId() {
    return UUID.randomUUID().toString().replace("-", "").substring(0, 24);
  }

  private static String str(Object value) {
    if (value == null) {
      return null;
    }
    String text = String.valueOf(value).trim();
    return text.isEmpty() ? null : text;
  }
}
