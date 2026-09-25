package com.fiftythree.challenges.pathway;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiftythree.challenges.engine.EntryQueryRepository;
import com.fiftythree.challenges.entity.CombinedResultEntity;
import com.fiftythree.challenges.entity.EntryEntity;
import com.fiftythree.challenges.entity.GuardianConsentEntity;
import com.fiftythree.challenges.entity.PathwayEntity;
import com.fiftythree.challenges.entity.PathwayMemberEntity;
import com.fiftythree.challenges.entity.SeriesStandingEntity;
import com.fiftythree.challenges.guardian.GuardianConsentQueryRepository;
import com.fiftythree.challenges.judging.CombinedResultQueryRepository;
import com.fiftythree.challenges.judging.JudgingPanelQueryRepository;
import com.fiftythree.challenges.security.CallerResolver;
import com.fiftythree.challenges.support.JsonColumn;
import com.fiftythree.challenges.upstream.ChallengeApiClient;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.ResponseEntity;

/**
 * Promotion moves a competitor's work from one challenge into another, and for
 * a child that means their entry appearing on a bigger stage than the one their
 * guardian agreed to. The kids freeze is the reason most of these tests exist:
 * every path that could let a minor through without an explicit, current,
 * entry-specific consent is covered here.
 *
 * <p>The rest cover the season arithmetic and the fact that running a promotion
 * twice does not duplicate anyone.
 */
class PathwayPromotionTest {

  private static final String FROM = "challenge-heat";
  private static final String TO = "challenge-final";
  private static final String PATHWAY = "pathway-1";

  private final ObjectMapper mapper = new ObjectMapper();

  private PathwayQueryRepository pathways;
  private PathwayMemberQueryRepository members;
  private PromotionQueryRepository promotions;
  private SeriesStandingQueryRepository standings;
  private CombinedResultQueryRepository results;
  private GuardianConsentQueryRepository consents;
  private EntryQueryRepository entries;
  private ChallengeApiClient upstream;
  private CallerResolver caller;

  private PathwaysController controller;

  @BeforeEach
  void setUp() {
    pathways = mock(PathwayQueryRepository.class);
    members = mock(PathwayMemberQueryRepository.class);
    promotions = mock(PromotionQueryRepository.class);
    standings = mock(SeriesStandingQueryRepository.class);
    results = mock(CombinedResultQueryRepository.class);
    JudgingPanelQueryRepository panels = mock(JudgingPanelQueryRepository.class);
    consents = mock(GuardianConsentQueryRepository.class);
    entries = mock(EntryQueryRepository.class);
    upstream = mock(ChallengeApiClient.class);
    caller = mock(CallerResolver.class);

    when(caller.email(any())).thenReturn("admin@example.com");
    when(caller.isAdmin(any())).thenReturn(true);
    when(pathways.findById(PATHWAY)).thenReturn(Optional.of(pathway(3)));
    when(members.findActiveByChallenge(FROM)).thenReturn(List.of(member()));
    when(promotions.findForSourceEntry(anyString(), anyString())).thenReturn(List.of());
    when(results.findRanked(anyString())).thenReturn(List.of());
    when(consents.findGrantedForEntry(anyString())).thenReturn(List.of());
    when(entries.findByChallengeAndUpstreamEntry(anyString(), anyString()))
        .thenReturn(List.of());
    when(entries.findById(anyString())).thenReturn(Optional.empty());
    when(upstream.entries(anyString(), anyInt())).thenReturn(List.of());
    when(standings.findByPathway(anyString())).thenReturn(List.of());

    controller = new PathwaysController(pathways, members, promotions, standings, results,
        panels, consents, entries, upstream, caller, new JsonColumn(mapper), mapper);
  }

  // ---------------------------------------------------------- kids freeze

  @Test
  void aMinorWithoutApprovedGuardianStatusIsNotPromoted() {
    when(results.findRanked(FROM)).thenReturn(List.of(result("e1", 1, "A Child")));
    when(entries.findById("e1")).thenReturn(Optional.of(
        localEntry("e1", "children", true, "pending")));

    Map<String, Object> result = promote();

    assertEquals(0, promoted(result).size());
    assertEquals(1, skipped(result).size());
    assertTrue(String.valueOf(skipped(result).get(0).get("reason")).contains("pending"));
    verify(entries, never()).save(any());
  }

  @Test
  void aMinorApprovedButWithNoGrantedConsentIsNotPromoted() {
    // The status field says approved but there is no consent record behind it.
    // Trusting the flag alone would promote a child on the strength of a
    // boolean nobody can trace to a guardian.
    when(results.findRanked(FROM)).thenReturn(List.of(result("e1", 1, "A Child")));
    when(entries.findById("e1")).thenReturn(Optional.of(
        localEntry("e1", "children", true, "approved")));
    when(consents.findGrantedForEntry("e1")).thenReturn(List.of());

    Map<String, Object> result = promote();

    assertEquals(0, promoted(result).size());
    assertTrue(String.valueOf(skipped(result).get(0).get("reason"))
        .contains("no granted GuardianConsent"));
  }

  @Test
  void aTeensDivisionIsTreatedAsKidsEvenWhenIsMinorIsFalse() {
    // The division is the check that catches an entry whose is_minor flag was
    // never set.
    when(results.findRanked(FROM)).thenReturn(List.of(result("e1", 1, "A Teen")));
    when(entries.findById("e1")).thenReturn(Optional.of(
        localEntry("e1", "Teens", false, "")));

    assertEquals(1, skipped(promote()).size());
  }

  @Test
  void anApprovedMinorIsPromotedAndTheConsentIsCopiedScopeByScope() {
    when(results.findRanked(FROM)).thenReturn(List.of(result("e1", 1, "A Child")));
    when(entries.findById("e1")).thenReturn(Optional.of(
        localEntry("e1", "children", true, "approved")));

    GuardianConsentEntity granted = new GuardianConsentEntity();
    granted.setId("gc-1");
    granted.setEntryId("e1");
    granted.setStatus("granted");
    granted.setGuardianName("A Guardian");
    granted.setParticipantName("A Child");
    granted.setScopesEnteringChallenge(true);
    granted.setScopesPublicationOfEntryMedia(true);
    // Withheld by the guardian, and it must stay withheld on the new entry.
    granted.setScopesPromotionalReuse(false);
    when(consents.findGrantedForEntry("e1")).thenReturn(List.of(granted));

    Map<String, Object> result = promote();

    assertEquals(1, promoted(result).size());

    ArgumentCaptor<GuardianConsentEntity> saved =
        ArgumentCaptor.forClass(GuardianConsentEntity.class);
    verify(consents).save(saved.capture());
    GuardianConsentEntity copy = saved.getValue();
    assertEquals(TO, copy.getChallengeId(), "consent belongs to the new challenge");
    assertEquals("granted", copy.getStatus());
    assertEquals("A Guardian", copy.getGuardianName());
    assertTrue(copy.getScopesEnteringChallenge());
    assertTrue(copy.getScopesPublicationOfEntryMedia());
    assertFalse(copy.getScopesPromotionalReuse(), "a withheld scope stays withheld");
  }

  @Test
  void aPromotedMinorEntryIsCreatedPendingBeforeItIsApproved() {
    // Fail-closed ordering: if the consent copy failed, the new entry would be
    // left pending rather than sitting approved with nothing behind it.
    when(results.findRanked(FROM)).thenReturn(List.of(result("e1", 1, "A Child")));
    when(entries.findById("e1")).thenReturn(Optional.of(
        localEntry("e1", "children", true, "approved")));
    GuardianConsentEntity granted = new GuardianConsentEntity();
    granted.setId("gc-1");
    granted.setStatus("granted");
    when(consents.findGrantedForEntry("e1")).thenReturn(List.of(granted));

    // Recorded at call time. A captor would not do: Mockito holds the same
    // mutated instance, so both captures would show the final state and the
    // test would pass even if the entry were created approved.
    List<String> statusAtSave = new ArrayList<>();
    when(entries.save(any(EntryEntity.class))).thenAnswer(invocation -> {
      EntryEntity written = invocation.getArgument(0);
      statusAtSave.add(written.getGuardianApprovalStatus());
      return written;
    });

    promote();

    assertEquals(List.of("pending", "approved"), statusAtSave,
        "created pending, approved only once the consent copy exists");
  }

  @Test
  void anAdultIsPromotedWithNoConsentRecord() {
    when(results.findRanked(FROM)).thenReturn(List.of(result("e1", 1, "An Adult")));
    when(entries.findById("e1")).thenReturn(Optional.of(
        localEntry("e1", "adults", false, "")));

    Map<String, Object> result = promote();

    assertEquals(1, promoted(result).size());
    verify(consents, never()).save(any());
  }

  @Test
  void anExistingKidsTargetEntryWithoutConsentIsNotAdopted() {
    // A partial earlier run left an entry in the target challenge. Reusing it
    // without its own granted consent would launder a pending entry into a
    // promoted one.
    when(results.findRanked(FROM)).thenReturn(List.of(result("e1", 1, "A Child")));
    when(entries.findById("e1")).thenReturn(Optional.of(
        localEntry("e1", "children", true, "approved")));
    GuardianConsentEntity granted = new GuardianConsentEntity();
    granted.setStatus("granted");
    when(consents.findGrantedForEntry("e1")).thenReturn(List.of(granted));

    EntryEntity stale = localEntry("target-1", "children", true, "approved");
    when(entries.findByChallengeAndUpstreamEntry(TO, "e1")).thenReturn(List.of(stale));
    when(consents.findGrantedForEntry("target-1")).thenReturn(List.of());

    Map<String, Object> result = promote();

    assertEquals(0, promoted(result).size());
    assertTrue(String.valueOf(skipped(result).get(0).get("reason"))
        .contains("refuse reuse"));
  }

  // ------------------------------------------------------------ mechanics

  @Test
  void anAlreadyPromotedEntryIsSkipped() {
    when(results.findRanked(FROM)).thenReturn(List.of(result("e1", 1, "An Adult")));
    when(entries.findById("e1")).thenReturn(Optional.of(
        localEntry("e1", "adults", false, "")));
    com.fiftythree.challenges.entity.PromotionEntity existing =
        new com.fiftythree.challenges.entity.PromotionEntity();
    existing.setId("p1");
    existing.setStatus("promoted");
    when(promotions.findForSourceEntry(FROM, "e1")).thenReturn(List.of(existing));

    Map<String, Object> result = promote();

    assertEquals(0, promoted(result).size());
    assertEquals("already promoted", skipped(result).get(0).get("reason"));
  }

  @Test
  void onlyTheConfiguredNumberArePromoted() {
    when(results.findRanked(FROM)).thenReturn(List.of(
        result("e1", 1, "First"), result("e2", 2, "Second"),
        result("e3", 3, "Third"), result("e4", 4, "Fourth")));
    for (String id : List.of("e1", "e2", "e3", "e4")) {
      when(entries.findById(id)).thenReturn(Optional.of(localEntry(id, "adults", false, "")));
    }

    assertEquals(3, promoted(promote()).size(), "pathway promotion_count is 3");
  }

  @Test
  void aChallengeWithNoPromotionTargetIsRefused() {
    PathwayMemberEntity noTarget = member();
    noTarget.setPromotionToChallengeId("");
    when(members.findActiveByChallenge(FROM)).thenReturn(List.of(noTarget));

    ResponseEntity<?> response = controller.handle(Map.of(
        "action", "promote_winners", "from_challenge_id", FROM));

    assertEquals(400, response.getStatusCode().value());
  }

  // ------------------------------------------------------------ standings

  @Test
  void pointsAccumulateAcrossEventsAndRankByTotal() {
    PathwayMemberEntity heatOne = member();
    heatOne.setChallengeId("heat-1");
    heatOne.setMemberKind("series_event");
    PathwayMemberEntity heatTwo = member();
    heatTwo.setChallengeId("heat-2");
    heatTwo.setMemberKind("series_event");
    when(members.findActiveByPathway(PATHWAY)).thenReturn(List.of(heatOne, heatTwo));

    // Alice: 1st then 3rd = 10 + 6 = 16. Bob: 2nd twice = 8 + 8 = 16.
    // Equal totals, so Alice wins on her better single placing.
    when(results.findRanked("heat-1")).thenReturn(List.of(
        result("a1", 1, "Alice"), result("b1", 2, "Bob")));
    when(results.findRanked("heat-2")).thenReturn(List.of(
        result("b2", 2, "Bob"), result("a2", 3, "Alice")));

    controller.handle(Map.of("action", "compute_standings", "pathway_id", PATHWAY));

    ArgumentCaptor<List<SeriesStandingEntity>> saved = captor();
    verify(standings).saveAll(saved.capture());
    List<SeriesStandingEntity> rows = saved.getValue();

    assertEquals(2, rows.size());
    assertEquals("Alice", rows.get(0).getCreatorName());
    assertEquals(16.0, rows.get(0).getTotalPoints());
    assertEquals(1.0, rows.get(0).getBestPlacing());
    assertEquals(1.0, rows.get(0).getRank());
    assertEquals("Bob", rows.get(1).getCreatorName());
    assertEquals(16.0, rows.get(1).getTotalPoints());
  }

  @Test
  void aPlacingBeyondThePointsScaleScoresNothing() {
    // The scale is eight long, so ninth place earns no points and the
    // competitor does not appear at all.
    PathwayMemberEntity heat = member();
    heat.setChallengeId("heat-1");
    heat.setMemberKind("series_event");
    when(members.findActiveByPathway(PATHWAY)).thenReturn(List.of(heat));
    when(results.findRanked("heat-1")).thenReturn(List.of(result("z1", 9, "Ninth")));

    controller.handle(Map.of("action", "compute_standings", "pathway_id", PATHWAY));

    verify(standings, never()).saveAll(any());
  }

  @Test
  void onlyScoringMemberKindsContributePoints() {
    PathwayMemberEntity showcase = member();
    showcase.setChallengeId("showcase-1");
    showcase.setMemberKind("showcase");
    when(members.findActiveByPathway(PATHWAY)).thenReturn(List.of(showcase));
    when(results.findRanked("showcase-1")).thenReturn(List.of(result("s1", 1, "Someone")));

    controller.handle(Map.of("action", "compute_standings", "pathway_id", PATHWAY));

    verify(standings, never()).saveAll(any());
  }

  @Test
  void standingsAreRebuiltNotAccumulated() {
    // Recomputing after a corrected result must not leave the old points
    // behind alongside the new ones.
    SeriesStandingEntity old = new SeriesStandingEntity();
    old.setId("old-1");
    when(standings.findByPathway(PATHWAY)).thenReturn(List.of(old));
    when(members.findActiveByPathway(PATHWAY)).thenReturn(List.of());

    controller.handle(Map.of("action", "compute_standings", "pathway_id", PATHWAY));

    verify(standings).deleteAll(List.of(old));
  }

  // -------------------------------------------------------------- gating

  @Test
  void anInvitationalPathwayAdmitsAnInvitedEmail() {
    PathwayEntity invitational = pathway(3);
    invitational.setType("invitational");
    invitational.setInvitedEmails("[\"Invited@Example.com\"]");
    when(pathways.findAllNewestFirst()).thenReturn(List.of(invitational));
    when(members.findActiveByChallenge(FROM)).thenReturn(List.of(gatedMember()));

    Map<String, Object> result = body(controller.handle(Map.of(
        "action", "entry_check", "challenge_id", FROM, "email", "invited@example.com")));

    assertEquals(true, result.get("allowed"));
  }

  @Test
  void anInvitationalPathwayRefusesAnUninvitedEmail() {
    PathwayEntity invitational = pathway(3);
    invitational.setType("invitational");
    invitational.setInvitedEmails("[\"someone@example.com\"]");
    when(pathways.findAllNewestFirst()).thenReturn(List.of(invitational));
    when(members.findActiveByChallenge(FROM)).thenReturn(List.of(gatedMember()));

    Map<String, Object> result = body(controller.handle(Map.of(
        "action", "entry_check", "challenge_id", FROM, "email", "gatecrasher@example.com")));

    assertEquals(false, result.get("allowed"));
  }

  @Test
  void anAccessCodeAdmitsSomeoneNotOnTheInviteList() {
    PathwayEntity invitational = pathway(3);
    invitational.setType("invitational");
    invitational.setInvitedEmails("[]");
    invitational.setAccessCode("LETMEIN");
    when(pathways.findAllNewestFirst()).thenReturn(List.of(invitational));
    when(members.findActiveByChallenge(FROM)).thenReturn(List.of(gatedMember()));

    Map<String, Object> result = body(controller.handle(Map.of(
        "action", "entry_check", "challenge_id", FROM,
        "email", "nobody@example.com", "access_code", "LETMEIN")));

    assertEquals(true, result.get("allowed"));
  }

  @Test
  void theAccessCodeIsNeverReturnedByThePublicConfig() {
    // public_config renders the form before anyone signs in. Returning the
    // code would defeat the gate entirely.
    PathwayEntity invitational = pathway(3);
    invitational.setType("invitational");
    invitational.setAccessCode("LETMEIN");
    when(pathways.findAllNewestFirst()).thenReturn(List.of(invitational));
    when(members.findActiveByChallenge(FROM)).thenReturn(List.of(gatedMember()));

    Map<String, Object> result = body(controller.handle(Map.of(
        "action", "public_config", "challenge_id", FROM)));

    assertEquals(true, result.get("gated"));
    assertEquals(true, result.get("requires_code"));
    assertFalse(result.toString().contains("LETMEIN"), result.toString());
  }

  @Test
  void anUngatedChallengeIsAlwaysAllowed() {
    when(pathways.findAllNewestFirst()).thenReturn(List.of(pathway(3)));
    when(members.findActiveByChallenge(FROM)).thenReturn(List.of(gatedMember()));

    assertEquals(true, body(controller.handle(Map.of(
        "action", "entry_check", "challenge_id", FROM))).get("allowed"));
  }

  // ------------------------------------------------------------ fixtures

  private Map<String, Object> promote() {
    return body(controller.handle(Map.of(
        "action", "promote_winners", "from_challenge_id", FROM)));
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> body(ResponseEntity<?> response) {
    return (Map<String, Object>) response.getBody();
  }

  @SuppressWarnings("unchecked")
  private static List<Map<String, Object>> promoted(Map<String, Object> result) {
    return (List<Map<String, Object>>) result.get("promoted");
  }

  @SuppressWarnings("unchecked")
  private static List<Map<String, Object>> skipped(Map<String, Object> result) {
    return (List<Map<String, Object>>) result.get("skipped");
  }

  @SuppressWarnings("unchecked")
  private static ArgumentCaptor<List<SeriesStandingEntity>> captor() {
    return ArgumentCaptor.forClass((Class<List<SeriesStandingEntity>>) (Class<?>) List.class);
  }

  private static PathwayEntity pathway(int promotionCount) {
    PathwayEntity p = new PathwayEntity();
    p.setId(PATHWAY);
    p.setName("National Series");
    p.setType("series_championship");
    p.setStatus("active");
    p.setPromotionCount((double) promotionCount);
    p.setPointsScale("[10,8,6,5,4,3,2,1]");
    p.setApprovedOrganisations("[]");
    p.setInvitedEmails("[]");
    return p;
  }

  private static PathwayMemberEntity member() {
    PathwayMemberEntity m = new PathwayMemberEntity();
    m.setId("member-1");
    m.setPathwayId(PATHWAY);
    m.setChallengeId(FROM);
    m.setChallengeTitle("State Heat");
    m.setMemberKind("qualifier");
    m.setPromotionToChallengeId(TO);
    m.setPromotionCountOverride(0d);
    m.setStatus("active");
    return m;
  }

  private static PathwayMemberEntity gatedMember() {
    PathwayMemberEntity m = member();
    m.setPromotionToChallengeId("");
    return m;
  }

  private static CombinedResultEntity result(String entryId, int rank, String creator) {
    CombinedResultEntity r = new CombinedResultEntity();
    r.setId("cr-" + entryId);
    r.setEntryId(entryId);
    r.setCreatorName(creator);
    r.setEntryTitle("Entry " + entryId);
    r.setCombinedRank((double) rank);
    return r;
  }

  private static EntryEntity localEntry(
      String id, String division, boolean isMinor, String guardianStatus) {
    EntryEntity e = new EntryEntity();
    e.setId(id);
    e.setChallengeId(FROM);
    e.setTitle("Entry " + id);
    e.setCreatorName("Creator " + id);
    e.setDivision(division);
    e.setIsMinor(isMinor);
    e.setGuardianApprovalStatus(guardianStatus);
    e.setWorkType("text");
    e.setWorkText("work");
    return e;
  }
}
