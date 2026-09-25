package com.fiftythree.challenges.rights;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiftythree.challenges.compliance.ComplianceAuditService;
import com.fiftythree.challenges.compliance.RightsConfigurationQueryRepository;
import com.fiftythree.challenges.entity.ChallengeRightsConfigurationEntity;
import com.fiftythree.challenges.entity.EntryEntity;
import com.fiftythree.challenges.entity.GuardianConsentEntity;
import com.fiftythree.challenges.entity.MarketingUseLogEntity;
import com.fiftythree.challenges.entity.MediaReleaseEntity;
import com.fiftythree.challenges.entity.MusicDeclarationEntity;
import com.fiftythree.challenges.entity.ParticipantRightsRecordEntity;
import com.fiftythree.challenges.entity.RightsGrantTemplateEntity;
import com.fiftythree.challenges.guardian.GuardianConsentQueryRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Participant rights and marketing consent, ported from
 * {@code base44/shared/rightsHelper.ts}.
 *
 * <p><b>The one rule</b>, on which everything else here depends:
 *
 * <pre>
 *   effective scopes = what the participant granted
 *                    ∩ what the challenge configuration allows
 *                    − what an open music or media gap blocks
 * </pre>
 *
 * <p>Every use check evaluates effective scopes, never raw grants. A
 * participant can tick a box and still not have granted a usable licence,
 * because the challenge never offered that scope, or because the entry has
 * uncleared commercial music in it, or because they are a minor whose guardian
 * has not countersigned. Reading the grant alone would authorise a use that
 * nobody actually consented to.
 *
 * <p>Three tiers. Tier 1 is a condition of entry and cannot be revoked during
 * the challenge — the platform has to be able to display and judge what was
 * submitted. Tier 2 is on by default and individually declinable. Tier 3 is
 * opt-in and unticked. Declining every Tier 2 and Tier 3 scope still lets
 * someone enter, compete and win; marketing contact is separate from all of it
 * and is never pre-ticked.
 */
@Service
public class RightsService {

  private static final Logger log = LoggerFactory.getLogger(RightsService.class);

  public static final String TIER1 = "tier1_mandatory";
  public static final String TIER2 = "tier2_standard";
  public static final String TIER3 = "tier3_extended";
  public static final String MARKETING_CONTACT = "marketing_contact";

  /** Mandatory, a condition of entry, and non-revocable for the challenge period. */
  public static final Set<String> TIER1_SCOPES = Set.of(
      "display_platform", "judging_use", "winner_announcement", "archival");

  /** On by default, individually declinable. */
  public static final Set<String> TIER2_SCOPES = Set.of(
      "platform_promotion", "challenge_recap", "social_repost");

  /** Opt-in, unticked. */
  public static final Set<String> TIER3_SCOPES = Set.of(
      "sponsor_host_use", "attribution", "non_sublicensable",
      "testimonial_nil", "derivative_compilation", "future_campaigns");

  /** The tiers a guardian must countersign before a minor's grant takes effect. */
  private static final Set<String> GUARDIAN_GATED_TIERS =
      Set.of(TIER2, TIER3, MARKETING_CONTACT);

  /** Scopes an ungranted media release blocks: anything that publishes the person. */
  private static final List<String> MEDIA_GATED_SCOPES = List.of(
      "platform_promotion", "social_repost", "sponsor_host_use", "derivative_compilation");

  /**
   * Which guardian permission each rights scope needs.
   *
   * <p>A minor's Tier 2/3 grant is inactive until the guardian countersigned
   * the matching permission. The mapping is not one-to-one — several marketing
   * scopes all sit behind "promotional reuse" — because guardians consent in
   * plain categories, not in the platform's scope vocabulary.
   */
  private static final Map<String, Function<GuardianConsentEntity, Boolean>> GUARDIAN_SCOPE =
      buildGuardianScopeMap();

  private static Map<String, Function<GuardianConsentEntity, Boolean>> buildGuardianScopeMap() {
    Map<String, Function<GuardianConsentEntity, Boolean>> map = new LinkedHashMap<>();
    map.put("display_platform", GuardianConsentEntity::getScopesPublicationOfEntryMedia);
    map.put("judging_use", GuardianConsentEntity::getScopesEnteringChallenge);
    map.put("winner_announcement", GuardianConsentEntity::getScopesPublicationOfEntryMedia);
    map.put("archival", GuardianConsentEntity::getScopesPublicationOfEntryMedia);
    map.put("platform_promotion", GuardianConsentEntity::getScopesPromotionalReuse);
    map.put("challenge_recap", GuardianConsentEntity::getScopesPublicationOfEntryMedia);
    map.put("social_repost", GuardianConsentEntity::getScopesPromotionalReuse);
    map.put("sponsor_host_use", GuardianConsentEntity::getScopesPromotionalReuse);
    map.put("attribution", GuardianConsentEntity::getScopesPublicDisplayName);
    map.put("non_sublicensable", GuardianConsentEntity::getScopesPromotionalReuse);
    map.put("testimonial_nil", GuardianConsentEntity::getScopesDirectCommunicationWithMinor);
    map.put("derivative_compilation", GuardianConsentEntity::getScopesPromotionalReuse);
    map.put("future_campaigns", GuardianConsentEntity::getScopesPromotionalReuse);
    map.put(MARKETING_CONTACT, GuardianConsentEntity::getScopesDirectCommunicationWithMinor);
    return Map.copyOf(map);
  }

  private final RightsTemplateQueryRepository templates;
  private final RightsConfigurationQueryRepository configs;
  private final RightsRecordQueryRepository records;
  private final MusicDeclarationQueryRepository music;
  private final MediaReleaseQueryRepository media;
  private final MarketingUseLogQueryRepository useLogs;
  private final GuardianConsentQueryRepository guardianConsents;
  private final ComplianceAuditService audit;
  private final ObjectMapper mapper;

  public RightsService(
      RightsTemplateQueryRepository templates,
      RightsConfigurationQueryRepository configs,
      RightsRecordQueryRepository records,
      MusicDeclarationQueryRepository music,
      MediaReleaseQueryRepository media,
      MarketingUseLogQueryRepository useLogs,
      GuardianConsentQueryRepository guardianConsents,
      ComplianceAuditService audit,
      ObjectMapper mapper) {
    this.templates = templates;
    this.configs = configs;
    this.records = records;
    this.music = music;
    this.media = media;
    this.useLogs = useLogs;
    this.guardianConsents = guardianConsents;
    this.audit = audit;
    this.mapper = mapper;
  }

  /** What an entry may actually be used for, and why anything is missing. */
  public record EffectiveScopes(
      List<String> effective,
      List<String> granted,
      List<String> configured,
      List<String> blocked,
      Map<String, String> blockReasons) {

    public Map<String, Object> toMap() {
      Map<String, Object> out = new LinkedHashMap<>();
      out.put("effective", effective);
      out.put("granted", granted);
      out.put("configured", configured);
      out.put("blocked", blocked);
      out.put("block_reasons", blockReasons);
      return out;
    }
  }

  /** Whether a proposed use is permitted, and what stands in the way. */
  public record UseCheck(
      boolean cleared,
      List<String> effectiveScopes,
      List<String> missing,
      List<String> blocked) {

    public Map<String, Object> toMap() {
      Map<String, Object> out = new LinkedHashMap<>();
      out.put("cleared", cleared);
      out.put("effective_scopes", effectiveScopes);
      out.put("missing", missing);
      out.put("blocked", blocked);
      return out;
    }
  }

  // ------------------------------------------------------------- lookups

  /** Templates that are current, signed and not retired. */
  public List<RightsGrantTemplateEntity> activeTemplates() {
    return templates.findCurrent().stream()
        .filter(this::isSigned)
        .filter(t -> !isExpired(t))
        .toList();
  }

  /** A template is offered only once a named reviewer signed it on a date. */
  public boolean isSigned(RightsGrantTemplateEntity template) {
    JsonNode signoff = parse(template == null ? null : template.getLegalSignoff());
    return notBlank(signoff.path("reviewer").asText(""))
        && notBlank(signoff.path("date").asText(""))
        && notBlank(signoff.path("reference").asText(""));
  }

  public boolean isExpired(RightsGrantTemplateEntity template) {
    Instant retirement = template == null ? null : template.getRetirementDate();
    return retirement != null && !retirement.isAfter(Instant.now());
  }

  public Optional<ChallengeRightsConfigurationEntity> config(String challengeId) {
    return configs.findByChallengeId(String.valueOf(challengeId)).stream().findFirst();
  }

  public Optional<ParticipantRightsRecordEntity> recordForEntry(String entryId) {
    return records.findByEntry(String.valueOf(entryId)).stream().findFirst();
  }

  /** The guardian's countersignature for a minor's entry, if there is one. */
  public Optional<GuardianConsentEntity> guardianConsentFor(EntryEntity entry) {
    if (entry == null || !Boolean.TRUE.equals(entry.getIsMinor())) {
      return Optional.empty();
    }
    return guardianConsents.findForEntry(nz(entry.getChallengeId()), nz(entry.getId()))
        .stream().findFirst();
  }

  // --------------------------------------------------------- the one rule

  /**
   * Computes the effective scopes: granted ∩ configured − blocked.
   *
   * <p>The subtractions are the point. A granted scope the challenge never
   * offered is not effective; a granted, configured scope with an uncleared
   * commercial music track behind it is not effective for reposting; and a
   * minor's marketing grant is not effective until their guardian countersigned
   * the matching permission.
   */
  public EffectiveScopes computeEffectiveScopes(
      ParticipantRightsRecordEntity record,
      ChallengeRightsConfigurationEntity config,
      List<MusicDeclarationEntity> musicDeclarations,
      List<MediaReleaseEntity> mediaReleases,
      GuardianConsentEntity guardianConsent) {

    Set<String> granted = new LinkedHashSet<>();
    List<JsonNode> grants = record == null ? List.of() : nodes(record.getScopeGrants());
    for (JsonNode grant : grants) {
      if ("granted".equals(grant.path("status").asText(""))) {
        granted.add(grant.path("scope_code").asText(""));
      }
    }

    Set<String> configured = new LinkedHashSet<>();
    if (config != null) {
      for (JsonNode scope : nodes(config.getIncludedScopeVersions())) {
        configured.add(scope.path("scope_code").asText(""));
      }
    }

    Set<String> blocked = new LinkedHashSet<>();
    Map<String, String> reasons = new LinkedHashMap<>();

    // Commercial music blocks reposting until it is cleared. The entry can
    // still be displayed and judged — this is a licensing limit on where the
    // work may be republished, not a judgement about the work.
    for (MusicDeclarationEntity declaration : orEmpty(musicDeclarations)) {
      if ("commercial".equals(declaration.getBasis())
          && !"cleared".equals(declaration.getClearanceStatus())) {
        blocked.add("social_repost");
        reasons.put("social_repost", "Commercial music declaration not cleared (status: "
            + nz(declaration.getClearanceStatus()) + ").");
      }
    }

    // Someone who appears in an entry but did not submit it has to have
    // released it before the entry is used to promote anything.
    for (MediaReleaseEntity release : orEmpty(mediaReleases)) {
      if (!"granted".equals(release.getStatus())) {
        for (String scope : MEDIA_GATED_SCOPES) {
          blocked.add(scope);
          reasons.put(scope, "Pending media release for " + nz(release.getSubjectName()) + ".");
        }
      }
    }

    if (record != null && Boolean.TRUE.equals(record.getIsMinor())) {
      applyGuardianGating(granted, grants, guardianConsent);
    }

    List<String> effective = granted.stream()
        .filter(configured::contains)
        .filter(scope -> !blocked.contains(scope))
        .toList();

    return new EffectiveScopes(effective, List.copyOf(granted), List.copyOf(configured),
        List.copyOf(blocked), Map.copyOf(reasons));
  }

  /**
   * Removes a minor's Tier 2/3 grants that their guardian has not countersigned.
   *
   * <p>With no guardian consent at all, every one of them goes. A child ticking
   * a marketing box is not consent, and the absence of a countersignature has
   * to mean "no" rather than "not checked".
   */
  private void applyGuardianGating(
      Set<String> granted, List<JsonNode> grants, GuardianConsentEntity guardianConsent) {

    for (JsonNode grant : grants) {
      if (!"granted".equals(grant.path("status").asText(""))) {
        continue;
      }
      if (!GUARDIAN_GATED_TIERS.contains(grant.path("tier").asText(""))) {
        continue;
      }
      String scope = grant.path("scope_code").asText("");
      if (guardianConsent == null) {
        granted.remove(scope);
        continue;
      }
      Function<GuardianConsentEntity, Boolean> permission = GUARDIAN_SCOPE.get(scope);
      if (permission != null && !Boolean.TRUE.equals(permission.apply(guardianConsent))) {
        granted.remove(scope);
      }
    }
  }

  /** Whether an entry may be used for the requested scopes. */
  public UseCheck checkUse(EntryEntity entry, List<String> requestedScopes) {
    if (entry == null) {
      return new UseCheck(false, List.of(), List.of("entry_not_found"), List.of());
    }
    String entryId = entry.getId();

    ParticipantRightsRecordEntity record = recordForEntry(entryId).orElse(null);
    EffectiveScopes scopes = computeEffectiveScopes(
        record,
        config(nz(entry.getChallengeId())).orElse(null),
        music.findByEntry(entryId),
        media.findByEntry(entryId),
        guardianConsentFor(entry).orElse(null));

    Set<String> effective = new LinkedHashSet<>(scopes.effective());
    Set<String> grantedRaw = new LinkedHashSet<>();
    if (record != null) {
      for (JsonNode grant : nodes(record.getScopeGrants())) {
        if ("granted".equals(grant.path("status").asText(""))) {
          grantedRaw.add(grant.path("scope_code").asText(""));
        }
      }
    }

    List<String> missing = new ArrayList<>();
    List<String> blocked = new ArrayList<>();
    for (String scope : orEmpty(requestedScopes)) {
      if (effective.contains(scope)) {
        continue;
      }
      // Granted but not effective means something is standing in the way —
      // worth distinguishing, because a block is usually fixable (clear the
      // music, chase the release) while a missing grant is not.
      if (grantedRaw.contains(scope)) {
        blocked.add(scope);
      } else {
        missing.add(scope);
      }
    }

    return new UseCheck(missing.isEmpty() && blocked.isEmpty(),
        scopes.effective(), List.copyOf(missing), List.copyOf(blocked));
  }

  // ---------------------------------------------------------- revocation

  /** The outcome of revoking one scope. */
  public record Revocation(
      boolean revoked, String status, int takedownsCreated, String error) {

    public Map<String, Object> toMap() {
      Map<String, Object> out = new LinkedHashMap<>();
      out.put("revoked", revoked);
      if (revoked) {
        out.put("status", status);
        out.put("takedowns_created", takedownsCreated);
      } else {
        out.put("error", error);
      }
      return out;
    }
  }

  /**
   * Withdraws one scope, prospectively.
   *
   * <p>Revocation is forward-looking: it stops future uses, and turns already
   * logged uses that relied on the scope into takedown tasks rather than
   * pretending they never happened. Tier 1 cannot be revoked during the
   * challenge — the entry has to stay displayable and judgeable for the
   * competition to run at all, and that was the condition of entering.
   */
  public Revocation revokeScope(String entryId, String scopeCode, String actorId, String actorEmail) {
    if (TIER1_SCOPES.contains(scopeCode)) {
      return new Revocation(false, null, 0,
          "Tier 1 scopes are non-revocable for the challenge period.");
    }

    Optional<ParticipantRightsRecordEntity> found = recordForEntry(entryId);
    if (found.isEmpty()) {
      return new Revocation(false, null, 0, "Rights record not found.");
    }
    ParticipantRightsRecordEntity record = found.get();

    var updated = mapper.createArrayNode();
    boolean stillHasActiveGrants = false;
    for (JsonNode grant : nodes(record.getScopeGrants())) {
      var copy = grant.deepCopy();
      if (copy instanceof com.fasterxml.jackson.databind.node.ObjectNode object
          && scopeCode.equals(object.path("scope_code").asText(""))) {
        object.put("status", "declined");
      }
      updated.add(copy);
      String tier = copy.path("tier").asText("");
      if ("granted".equals(copy.path("status").asText(""))
          && (TIER2.equals(tier) || TIER3.equals(tier))) {
        stillHasActiveGrants = true;
      }
    }

    String status = stillHasActiveGrants ? "partially_revoked" : "revoked";
    record.setScopeGrants(write(updated));
    record.setStatus(status);
    if ("revoked".equals(status)) {
      record.setRevokedAt(Instant.now());
    }
    record.setUpdatedDate(Instant.now());
    records.save(record);

    int takedowns = 0;
    for (MarketingUseLogEntity useLog : useLogs.findLiveUses(String.valueOf(entryId))) {
      if (!stringList(useLog.getScopesReliedOn()).contains(scopeCode)) {
        continue;
      }
      useLog.setTakedownStatus("pending");
      useLog.setNotes(nz(useLog.getNotes())
          + " | Takedown required: scope '" + scopeCode + "' revoked.");
      useLog.setUpdatedDate(Instant.now());
      useLogs.save(useLog);
      takedowns++;
    }

    audit.event("finding_updated", nz(record.getChallengeId()), actorId, actorEmail,
        "Scope '" + scopeCode + "' revoked for entry " + entryId + ". Status: " + status
            + ". Takedown tasks: " + takedowns + ".");

    return new Revocation(true, status, takedowns, null);
  }

  // ------------------------------------------------------------- summary

  /**
   * The plain-language summary the entry flow shows before someone consents,
   * grouped by tier. Only signed templates for scopes this challenge actually
   * includes — there is no point asking for a licence the competition will not
   * use.
   */
  public Map<String, Object> buildRightsSummary(String challengeId) {
    ChallengeRightsConfigurationEntity config = config(challengeId).orElse(null);
    if (config == null) {
      return null;
    }

    Set<String> included = new LinkedHashSet<>();
    for (JsonNode scope : nodes(config.getIncludedScopeVersions())) {
      included.add(scope.path("scope_code").asText(""));
    }

    Map<String, List<Map<String, Object>>> grouped = new LinkedHashMap<>();
    grouped.put("tier1", new ArrayList<>());
    grouped.put("tier2", new ArrayList<>());
    grouped.put("tier3", new ArrayList<>());
    grouped.put(MARKETING_CONTACT, new ArrayList<>());

    for (RightsGrantTemplateEntity t : activeTemplates()) {
      if (!included.contains(t.getScopeCode())) {
        continue;
      }
      Map<String, Object> row = new LinkedHashMap<>();
      row.put("scope_code", t.getScopeCode());
      row.put("display_name", t.getDisplayName());
      row.put("description", nz(t.getDescription()));
      row.put("clause_reference", t.getClauseReference());
      row.put("template_id", t.getId());

      String key = switch (nz(t.getTier())) {
        case TIER1 -> "tier1";
        case TIER2 -> "tier2";
        case TIER3 -> "tier3";
        case MARKETING_CONTACT -> MARKETING_CONTACT;
        default -> null;
      };
      if (key != null) {
        grouped.get(key).add(row);
      }
    }

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("config", configJson(config));
    out.put("tiers", grouped);
    out.put("music_policy", config.getMusicPolicy());
    out.put("third_party_policy", config.getThirdPartyPolicy());
    out.put("sponsor_use_period", config.getSponsorUsePeriod());
    return out;
  }

  public Map<String, Object> configJson(ChallengeRightsConfigurationEntity c) {
    if (c == null) {
      return null;
    }
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", c.getId());
    out.put("challenge_id", c.getChallengeId());
    out.put("included_scope_versions", node(c.getIncludedScopeVersions()));
    out.put("music_policy", c.getMusicPolicy());
    out.put("third_party_policy", c.getThirdPartyPolicy());
    out.put("sponsor_use_period", c.getSponsorUsePeriod());
    out.put("marketing_contact_senders", node(c.getMarketingContactSenders()));
    out.put("created_date", c.getCreatedDate() == null ? null : c.getCreatedDate().toString());
    out.put("updated_date", c.getUpdatedDate() == null ? null : c.getUpdatedDate().toString());
    return out;
  }

  // ------------------------------------------------------------- helpers

  List<JsonNode> nodes(String raw) {
    JsonNode parsed = node(raw);
    if (!parsed.isArray()) {
      return List.of();
    }
    List<JsonNode> out = new ArrayList<>();
    parsed.forEach(out::add);
    return out;
  }

  List<String> stringList(String raw) {
    List<String> out = new ArrayList<>();
    for (JsonNode n : nodes(raw)) {
      out.add(n.asText(""));
    }
    return out;
  }

  JsonNode node(String raw) {
    if (raw == null || raw.isBlank()) {
      return mapper.createArrayNode();
    }
    try {
      return mapper.readTree(raw);
    } catch (Exception e) {
      log.warn("Ignoring malformed rights JSON column: {}", e.toString());
      return mapper.createArrayNode();
    }
  }

  private JsonNode parse(String raw) {
    if (raw == null || raw.isBlank()) {
      return mapper.createObjectNode();
    }
    try {
      return mapper.readTree(raw);
    } catch (Exception e) {
      return mapper.createObjectNode();
    }
  }

  String write(Object value) {
    try {
      return mapper.writeValueAsString(value);
    } catch (Exception e) {
      throw new IllegalStateException("Could not serialise a rights column", e);
    }
  }

  private static <T> List<T> orEmpty(List<T> value) {
    return value == null ? List.of() : value;
  }

  private static boolean notBlank(String value) {
    return value != null && !value.trim().isEmpty();
  }

  private static String nz(String value) {
    return value == null ? "" : value;
  }
}
