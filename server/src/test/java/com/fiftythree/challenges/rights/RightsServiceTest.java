package com.fiftythree.challenges.rights;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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
import com.fiftythree.challenges.guardian.GuardianConsentQueryRepository;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * Effective scopes decide whether a real person's creative work may be used in
 * marketing. Every test here is a case where reading the raw grant would
 * authorise a use nobody actually consented to: a scope the challenge never
 * offered, an entry with uncleared commercial music, a bystander who has not
 * signed a release, or a child whose guardian has not countersigned.
 */
class RightsServiceTest {

  private static final String CID = "challenge-1";
  private static final String EID = "entry-1";
  private static final String SIGNOFF =
      "{\"reviewer\":\"A Lawyer\",\"date\":\"2026-01-01\",\"reference\":\"OP-1\"}";

  private final ObjectMapper mapper = new ObjectMapper();

  private RightsTemplateQueryRepository templates;
  private RightsConfigurationQueryRepository configs;
  private RightsRecordQueryRepository records;
  private MusicDeclarationQueryRepository music;
  private MediaReleaseQueryRepository media;
  private MarketingUseLogQueryRepository useLogs;
  private GuardianConsentQueryRepository guardianConsents;
  private ComplianceAuditService audit;

  private RightsService service;

  @BeforeEach
  void setUp() {
    templates = mock(RightsTemplateQueryRepository.class);
    configs = mock(RightsConfigurationQueryRepository.class);
    records = mock(RightsRecordQueryRepository.class);
    music = mock(MusicDeclarationQueryRepository.class);
    media = mock(MediaReleaseQueryRepository.class);
    useLogs = mock(MarketingUseLogQueryRepository.class);
    guardianConsents = mock(GuardianConsentQueryRepository.class);
    audit = mock(ComplianceAuditService.class);

    when(templates.findCurrent()).thenReturn(List.of());
    when(configs.findByChallengeId(anyString())).thenReturn(List.of());
    when(records.findByEntry(anyString())).thenReturn(List.of());
    when(music.findByEntry(anyString())).thenReturn(List.of());
    when(media.findByEntry(anyString())).thenReturn(List.of());
    when(useLogs.findLiveUses(anyString())).thenReturn(List.of());
    when(guardianConsents.findForEntry(anyString(), anyString())).thenReturn(List.of());

    service = new RightsService(templates, configs, records, music, media, useLogs,
        guardianConsents, audit, mapper);
  }

  // -------------------------------------------------------- the one rule

  @Test
  void effectiveScopesAreTheIntersectionOfGrantedAndConfigured() {
    ParticipantRightsRecordEntity record = record(false,
        grant("platform_promotion", RightsService.TIER2, "granted"),
        grant("social_repost", RightsService.TIER2, "granted"));

    RightsService.EffectiveScopes scopes = service.computeEffectiveScopes(
        record, config("platform_promotion"), List.of(), List.of(), null);

    // social_repost was granted but the challenge never offered it, so it is
    // not a licence this competition can rely on.
    assertEquals(List.of("platform_promotion"), scopes.effective());
    assertTrue(scopes.granted().contains("social_repost"));
  }

  @Test
  void aDeclinedGrantIsNotEffective() {
    ParticipantRightsRecordEntity record = record(false,
        grant("platform_promotion", RightsService.TIER2, "declined"));

    assertEquals(List.of(), service.computeEffectiveScopes(
        record, config("platform_promotion"), List.of(), List.of(), null).effective());
  }

  @Test
  void decliningEverythingLeavesNoMarketingScopesButIsNotAnError() {
    // Rule 1: declining every optional scope still allows entering, competing
    // and winning. Nothing here should throw or refuse.
    ParticipantRightsRecordEntity record = record(false,
        grant("platform_promotion", RightsService.TIER2, "declined"),
        grant("social_repost", RightsService.TIER2, "declined"));

    RightsService.EffectiveScopes scopes = service.computeEffectiveScopes(
        record, config("platform_promotion", "social_repost"), List.of(), List.of(), null);

    assertEquals(List.of(), scopes.effective());
    assertEquals(List.of(), scopes.blocked());
  }

  // --------------------------------------------------------------- music

  @Test
  void unclearedCommercialMusicBlocksRepostingButNotOtherScopes() {
    // Rule 2, verbatim from the original: an entry with commercial music
    // passes display and judging but fails social_repost until cleared.
    ParticipantRightsRecordEntity record = record(false,
        grant("social_repost", RightsService.TIER2, "granted"),
        grant("platform_promotion", RightsService.TIER2, "granted"));

    RightsService.EffectiveScopes scopes = service.computeEffectiveScopes(
        record, config("social_repost", "platform_promotion"),
        List.of(musicDeclaration("commercial", "pending")), List.of(), null);

    assertEquals(List.of("platform_promotion"), scopes.effective());
    assertTrue(scopes.blocked().contains("social_repost"));
    assertTrue(scopes.blockReasons().get("social_repost").contains("pending"));
  }

  @Test
  void clearedCommercialMusicStopsBlocking() {
    ParticipantRightsRecordEntity record = record(false,
        grant("social_repost", RightsService.TIER2, "granted"));

    RightsService.EffectiveScopes scopes = service.computeEffectiveScopes(
        record, config("social_repost"),
        List.of(musicDeclaration("commercial", "cleared")), List.of(), null);

    assertEquals(List.of("social_repost"), scopes.effective());
  }

  @Test
  void originalMusicBlocksNothing() {
    ParticipantRightsRecordEntity record = record(false,
        grant("social_repost", RightsService.TIER2, "granted"));

    assertEquals(List.of("social_repost"), service.computeEffectiveScopes(
        record, config("social_repost"),
        List.of(musicDeclaration("original", "not_required")), List.of(), null).effective());
  }

  // ------------------------------------------------------- media release

  @Test
  void aPendingMediaReleaseBlocksEveryPromotionalScope() {
    // Someone appears in the entry who did not submit it. Until they release
    // it, the entry cannot be used to promote anything.
    ParticipantRightsRecordEntity record = record(false,
        grant("platform_promotion", RightsService.TIER2, "granted"),
        grant("sponsor_host_use", RightsService.TIER3, "granted"));

    RightsService.EffectiveScopes scopes = service.computeEffectiveScopes(
        record, config("platform_promotion", "sponsor_host_use"),
        List.of(), List.of(mediaRelease("A Bystander", "pending")), null);

    assertEquals(List.of(), scopes.effective());
    assertTrue(scopes.blockReasons().get("platform_promotion").contains("A Bystander"));
  }

  @Test
  void aGrantedMediaReleaseBlocksNothing() {
    ParticipantRightsRecordEntity record = record(false,
        grant("platform_promotion", RightsService.TIER2, "granted"));

    assertEquals(List.of("platform_promotion"), service.computeEffectiveScopes(
        record, config("platform_promotion"),
        List.of(), List.of(mediaRelease("A Bystander", "granted")), null).effective());
  }

  // ------------------------------------------------------- minor gating

  @Test
  void aMinorWithNoGuardianConsentHasNoMarketingScopes() {
    // Rule 5, and the most important one here. A child ticking a box is not
    // consent; the absence of a countersignature must read as "no".
    ParticipantRightsRecordEntity record = record(true,
        grant("platform_promotion", RightsService.TIER2, "granted"),
        grant("display_platform", RightsService.TIER1, "granted"));

    RightsService.EffectiveScopes scopes = service.computeEffectiveScopes(
        record, config("platform_promotion", "display_platform"), List.of(), List.of(), null);

    assertFalse(scopes.effective().contains("platform_promotion"));
    // Tier 1 is a condition of entry and is not guardian-gated here — the
    // entry still has to be displayable and judgeable.
    assertTrue(scopes.effective().contains("display_platform"));
  }

  @Test
  void aMinorNeedsTheMatchingGuardianPermission() {
    GuardianConsentEntity consent = new GuardianConsentEntity();
    consent.setScopesPromotionalReuse(true);
    consent.setScopesPublicDisplayName(false);

    ParticipantRightsRecordEntity record = record(true,
        grant("platform_promotion", RightsService.TIER2, "granted"),
        grant("attribution", RightsService.TIER3, "granted"));

    RightsService.EffectiveScopes scopes = service.computeEffectiveScopes(
        record, config("platform_promotion", "attribution"), List.of(), List.of(), consent);

    // promotional_reuse was countersigned; public_display_name was not.
    assertTrue(scopes.effective().contains("platform_promotion"));
    assertFalse(scopes.effective().contains("attribution"));
  }

  @Test
  void anAdultIsNotGuardianGated() {
    ParticipantRightsRecordEntity record = record(false,
        grant("attribution", RightsService.TIER3, "granted"));

    assertEquals(List.of("attribution"), service.computeEffectiveScopes(
        record, config("attribution"), List.of(), List.of(), null).effective());
  }

  // ------------------------------------------------------------ use gate

  @Test
  void aBlockedScopeIsReportedSeparatelyFromAMissingOne() {
    // The distinction matters operationally: a block is usually fixable — clear
    // the music, chase the release — while a missing grant is not.
    when(records.findByEntry(EID)).thenReturn(List.of(record(false,
        grant("social_repost", RightsService.TIER2, "granted"))));
    when(configs.findByChallengeId(CID)).thenReturn(List.of(config("social_repost")));
    when(music.findByEntry(EID)).thenReturn(List.of(musicDeclaration("commercial", "pending")));

    RightsService.UseCheck check =
        service.checkUse(entry(), List.of("social_repost", "sponsor_host_use"));

    assertFalse(check.cleared());
    assertEquals(List.of("social_repost"), check.blocked());
    assertEquals(List.of("sponsor_host_use"), check.missing());
  }

  @Test
  void aMissingEntryIsNeverCleared() {
    RightsService.UseCheck check = service.checkUse(null, List.of("platform_promotion"));

    assertFalse(check.cleared());
    assertEquals(List.of("entry_not_found"), check.missing());
  }

  @Test
  void aUseWithinTheEffectiveScopesIsCleared() {
    when(records.findByEntry(EID)).thenReturn(List.of(record(false,
        grant("platform_promotion", RightsService.TIER2, "granted"))));
    when(configs.findByChallengeId(CID)).thenReturn(List.of(config("platform_promotion")));

    assertTrue(service.checkUse(entry(), List.of("platform_promotion")).cleared());
  }

  // ---------------------------------------------------------- revocation

  @Test
  void tierOneCannotBeRevoked() {
    RightsService.Revocation result =
        service.revokeScope(EID, "display_platform", "u1", "a@b.com");

    assertFalse(result.revoked());
    assertTrue(result.error().contains("non-revocable"));
    verify(records, never()).save(any());
  }

  @Test
  void revokingTheLastActiveScopeMarksTheRecordRevoked() {
    ParticipantRightsRecordEntity record = record(false,
        grant("platform_promotion", RightsService.TIER2, "granted"));
    when(records.findByEntry(EID)).thenReturn(List.of(record));

    RightsService.Revocation result =
        service.revokeScope(EID, "platform_promotion", "u1", "a@b.com");

    assertTrue(result.revoked());
    assertEquals("revoked", result.status());
    assertEquals("revoked", record.getStatus());
  }

  @Test
  void revokingOneOfSeveralScopesIsAPartialRevocation() {
    ParticipantRightsRecordEntity record = record(false,
        grant("platform_promotion", RightsService.TIER2, "granted"),
        grant("social_repost", RightsService.TIER2, "granted"));
    when(records.findByEntry(EID)).thenReturn(List.of(record));

    assertEquals("partially_revoked",
        service.revokeScope(EID, "platform_promotion", "u1", "a@b.com").status());
  }

  @Test
  void revokingAScopeTurnsLoggedUsesIntoTakedownTasks() {
    // Rule 4. Revocation is prospective, but uses already published on owned
    // channels have to come down, and the log is what makes that possible.
    ParticipantRightsRecordEntity record = record(false,
        grant("platform_promotion", RightsService.TIER2, "granted"));
    when(records.findByEntry(EID)).thenReturn(List.of(record));

    MarketingUseLogEntity relevant = useLog("log-1", "[\"platform_promotion\"]");
    MarketingUseLogEntity unrelated = useLog("log-2", "[\"challenge_recap\"]");
    when(useLogs.findLiveUses(EID)).thenReturn(List.of(relevant, unrelated));

    RightsService.Revocation result =
        service.revokeScope(EID, "platform_promotion", "u1", "a@b.com");

    assertEquals(1, result.takedownsCreated());
    assertEquals("pending", relevant.getTakedownStatus());
    assertEquals("not_required", unrelated.getTakedownStatus());
    assertTrue(relevant.getNotes().contains("Takedown required"));
  }

  @Test
  void revokingWithNoRightsRecordFails() {
    RightsService.Revocation result =
        service.revokeScope(EID, "platform_promotion", "u1", "a@b.com");

    assertFalse(result.revoked());
    assertEquals("Rights record not found.", result.error());
  }

  // ----------------------------------------------------------- templates

  @Test
  void onlySignedUnexpiredTemplatesAreActive() {
    var signed = template("t1", "display_platform", SIGNOFF);
    var unsigned = template("t2", "platform_promotion", "{}");
    var retired = template("t3", "social_repost", SIGNOFF);
    retired.setRetirementDate(java.time.Instant.now().minusSeconds(60));
    when(templates.findCurrent()).thenReturn(List.of(signed, unsigned, retired));

    assertEquals(List.of("t1"),
        service.activeTemplates().stream().map(t -> t.getId()).toList());
  }

  // ------------------------------------------------------------ fixtures

  private static EntryEntity entry() {
    EntryEntity entry = new EntryEntity();
    entry.setId(EID);
    entry.setChallengeId(CID);
    entry.setIsMinor(false);
    return entry;
  }

  private ParticipantRightsRecordEntity record(boolean isMinor, String... grants) {
    ParticipantRightsRecordEntity record = new ParticipantRightsRecordEntity();
    record.setId("rights-1");
    record.setChallengeId(CID);
    record.setEntryId(EID);
    record.setIsMinor(isMinor);
    record.setScopeGrants("[" + String.join(",", grants) + "]");
    record.setStatus("active");
    return record;
  }

  private static String grant(String scopeCode, String tier, String status) {
    return "{\"scope_code\":\"" + scopeCode + "\",\"tier\":\"" + tier
        + "\",\"status\":\"" + status + "\"}";
  }

  private static ChallengeRightsConfigurationEntity config(String... scopeCodes) {
    StringBuilder scopes = new StringBuilder("[");
    for (int i = 0; i < scopeCodes.length; i++) {
      scopes.append(i == 0 ? "" : ",")
          .append("{\"scope_code\":\"").append(scopeCodes[i]).append("\"}");
    }
    scopes.append("]");

    ChallengeRightsConfigurationEntity config = new ChallengeRightsConfigurationEntity();
    config.setId("config-1");
    config.setChallengeId(CID);
    config.setIncludedScopeVersions(scopes.toString());
    return config;
  }

  private static MusicDeclarationEntity musicDeclaration(String basis, String clearance) {
    MusicDeclarationEntity declaration = new MusicDeclarationEntity();
    declaration.setId("music-1");
    declaration.setEntryId(EID);
    declaration.setBasis(basis);
    declaration.setClearanceStatus(clearance);
    return declaration;
  }

  private static MediaReleaseEntity mediaRelease(String subject, String status) {
    MediaReleaseEntity release = new MediaReleaseEntity();
    release.setId("release-1");
    release.setEntryId(EID);
    release.setSubjectName(subject);
    release.setStatus(status);
    return release;
  }

  private static MarketingUseLogEntity useLog(String id, String scopesJson) {
    MarketingUseLogEntity useLog = new MarketingUseLogEntity();
    useLog.setId(id);
    useLog.setEntryId(EID);
    useLog.setScopesReliedOn(scopesJson);
    useLog.setTakedownStatus("not_required");
    useLog.setNotes("");
    return useLog;
  }

  private static com.fiftythree.challenges.entity.RightsGrantTemplateEntity template(
      String id, String scopeCode, String signoff) {
    var template = new com.fiftythree.challenges.entity.RightsGrantTemplateEntity();
    template.setId(id);
    template.setScopeCode(scopeCode);
    template.setLegalSignoff(signoff);
    template.setIsCurrent(true);
    return template;
  }
}
