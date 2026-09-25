package com.fiftythree.challenges.terms;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiftythree.challenges.compliance.ComplianceAuditService;
import com.fiftythree.challenges.compliance.ConditionEvaluator;
import com.fiftythree.challenges.compliance.FindingQueryRepository;
import com.fiftythree.challenges.compliance.PermitQueryRepository;
import com.fiftythree.challenges.compliance.PromoterAppointmentQueryRepository;
import com.fiftythree.challenges.compliance.RightsConfigurationQueryRepository;
import com.fiftythree.challenges.compliance.VotingConfigurationQueryRepository;
import com.fiftythree.challenges.entity.ApprovedClauseEntity;
import com.fiftythree.challenges.entity.ChallengeRepository;
import com.fiftythree.challenges.entity.TermsDocumentEntity;
import com.fiftythree.challenges.lifecycle.AssessmentQueryRepository;
import com.fiftythree.challenges.support.JsonColumn;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

/**
 * The assembler writes the document entrants are legally bound by, so the
 * behaviours worth pinning are the refusals. Every test here is a case where
 * producing a document would be worse than producing none: an unsigned clause
 * treated as approved, a required category quietly absent, or a merge field
 * left unresolved in the text people accept.
 */
class TermsAssemblerServiceTest {

  private static final String CID = "challenge-1";
  private static final String SIGNOFF =
      "{\"reviewer\":\"A Lawyer\",\"date\":\"2026-01-01\",\"reference\":\"OP-1\"}";

  private final ObjectMapper mapper = new ObjectMapper();

  private ApprovedClauseQueryRepository clauses;
  private TermsDocumentsQueryRepository documents;
  private AssessmentQueryRepository assessments;
  private FindingQueryRepository findings;
  private ChallengeRepository challenges;
  private PromoterAppointmentQueryRepository promoters;
  private PermitQueryRepository permits;
  private VotingConfigurationQueryRepository votingConfigs;
  private RightsConfigurationQueryRepository rights;
  private ComplianceAuditService audit;

  private TermsAssemblerService service;

  @BeforeEach
  void setUp() {
    clauses = mock(ApprovedClauseQueryRepository.class);
    documents = mock(TermsDocumentsQueryRepository.class);
    assessments = mock(AssessmentQueryRepository.class);
    findings = mock(FindingQueryRepository.class);
    challenges = mock(ChallengeRepository.class);
    promoters = mock(PromoterAppointmentQueryRepository.class);
    permits = mock(PermitQueryRepository.class);
    votingConfigs = mock(VotingConfigurationQueryRepository.class);
    rights = mock(RightsConfigurationQueryRepository.class);
    audit = mock(ComplianceAuditService.class);

    when(clauses.findCurrent()).thenReturn(List.of());
    when(documents.findLive(anyString())).thenReturn(List.of());
    when(assessments.findByChallenge(anyString())).thenReturn(List.of());
    when(findings.findByObligationTypes(anyString(), any())).thenReturn(List.of());
    when(challenges.findById(anyString())).thenReturn(Optional.empty());
    when(promoters.findLatestFor(anyString())).thenReturn(List.of());
    when(permits.findUsable()).thenReturn(List.of());
    when(votingConfigs.findLatestFor(anyString())).thenReturn(List.of());
    when(rights.findByChallengeId(anyString())).thenReturn(List.of());

    service = new TermsAssemblerService(clauses, documents, assessments, findings, challenges,
        promoters, permits, votingConfigs, rights, audit, new ConditionEvaluator(),
        new JsonColumn(mapper), mapper);
  }

  // ------------------------------------------------------------ sign-off

  @Test
  void aClauseIsSignedOnlyWithReviewerDateAndReference() {
    assertTrue(service.isSigned(clause("c1", "eligibility", true, SIGNOFF)));
    assertFalse(service.isSigned(clause("c1", "eligibility", true, "{}")));
    assertFalse(service.isSigned(clause("c1", "eligibility", true, null)));
    // A partial sign-off is the dangerous case: it looks filled in, and must
    // not count.
    assertFalse(service.isSigned(clause("c1", "eligibility", true,
        "{\"reviewer\":\"A Lawyer\",\"date\":\"2026-01-01\",\"reference\":\"  \"}")));
  }

  @Test
  void aClauseExpiresOnItsRetirementDate() {
    ApprovedClauseEntity retired = clause("c1", "eligibility", true, SIGNOFF);
    retired.setRetirementDate(Instant.now().minus(1, ChronoUnit.DAYS));
    assertTrue(service.isExpired(retired));

    ApprovedClauseEntity future = clause("c2", "eligibility", true, SIGNOFF);
    future.setRetirementDate(Instant.now().plus(1, ChronoUnit.DAYS));
    assertFalse(service.isExpired(future));

    assertFalse(service.isExpired(clause("c3", "eligibility", true, SIGNOFF)));
  }

  // --------------------------------------------------------------- STOPs

  @Test
  void anUnsignedMandatoryClauseStopsAssembly() {
    when(clauses.findCurrent()).thenReturn(List.of(clause("c1", "eligibility", true, "{}")));

    TermsAssemblerService.Result result = service.assemble(CID, facts(), "u1", "a@b.com");

    assertTrue(result.failed());
    assertTrue(stops(result).contains("clause_unsigned"), stops(result).toString());
    // Nothing is written when assembly stops.
    verify(documents, never()).save(any());
  }

  @Test
  void anUnsignedOptionalClauseIsSkippedWithoutStopping() {
    List<ApprovedClauseEntity> library = new ArrayList<>(fullLibrary());
    library.add(clause("optional", "marketing", false, "{}"));
    when(clauses.findCurrent()).thenReturn(library);

    TermsAssemblerService.Result result = service.assemble(CID, facts(), "u1", "a@b.com");

    assertFalse(result.failed(), stops(result).toString());
    assertFalse(result.clausesUsed().stream()
        .anyMatch(c -> "optional".equals(c.getIdentifier())));
  }

  @Test
  void aMissingRequiredCategoryStopsAssembly() {
    List<ApprovedClauseEntity> library = new ArrayList<>(fullLibrary());
    library.removeIf(c -> "privacy".equals(c.getCategory()));
    when(clauses.findCurrent()).thenReturn(library);

    TermsAssemblerService.Result result = service.assemble(CID, facts(), "u1", "a@b.com");

    assertTrue(result.failed());
    assertTrue(detail(result).contains("privacy"), detail(result));
  }

  @Test
  void aChanceClassifiedChallengeRequiresPermitAndDrawClauses() {
    when(clauses.findCurrent()).thenReturn(fullLibrary());
    Map<String, Object> facts = facts();
    facts.put("classification", "game_of_chance");

    TermsAssemblerService.Result result = service.assemble(CID, facts, "u1", "a@b.com");

    assertTrue(result.failed());
    String detail = detail(result);
    assertTrue(detail.contains("permit_statements"), detail);
    assertTrue(detail.contains("draw_procedure"), detail);
    assertTrue(detail.contains("free_entry_route"), detail);
  }

  @Test
  void prohibitedCombinationsStopAssembly() {
    List<ApprovedClauseEntity> library = new ArrayList<>(fullLibrary());
    library.get(0).setProhibitedCombinations("[\"eligibility\"]");
    when(clauses.findCurrent()).thenReturn(library);

    TermsAssemblerService.Result result = service.assemble(CID, facts(), "u1", "a@b.com");

    assertTrue(result.failed());
    assertTrue(stops(result).contains("prohibited_combination"), stops(result).toString());
  }

  @Test
  void anUnresolvedRequiredVariableStopsAssembly() {
    List<ApprovedClauseEntity> library = new ArrayList<>(fullLibrary());
    library.get(0).setRequiredVariables("[\"promoter_entity\"]");
    when(clauses.findCurrent()).thenReturn(library);

    TermsAssemblerService.Result result = service.assemble(CID, facts(), "u1", "a@b.com");

    assertTrue(result.failed());
    assertTrue(stops(result).contains("unresolved_variable"), stops(result).toString());
  }

  // ------------------------------------------------------------- success

  @Test
  void aCompleteLibraryProducesADraftDocument() {
    when(clauses.findCurrent()).thenReturn(fullLibrary());

    TermsAssemblerService.Result result = service.assemble(CID, facts(), "u1", "a@b.com");

    assertFalse(result.failed(), stops(result).toString());
    assertNotNull(result.document());
    assertEquals("draft", result.document().getStatus(), "never published straight out");
    assertEquals(8, result.clausesUsed().size());

    ArgumentCaptor<TermsDocumentEntity> saved =
        ArgumentCaptor.forClass(TermsDocumentEntity.class);
    verify(documents).save(saved.capture());
    assertTrue(saved.getValue().getMergedOutput().contains("### Eligibility"));
  }

  @Test
  void mergeFieldsAreSubstitutedFromTheFacts() {
    List<ApprovedClauseEntity> library = new ArrayList<>(fullLibrary());
    library.get(0).setBody("Run by {{promoter_entity}} in {{geography}}.");
    when(clauses.findCurrent()).thenReturn(library);

    Map<String, Object> facts = facts();
    facts.put("promoter_entity", "53 Challenges Pty Ltd");
    facts.put("geography", "national");

    TermsAssemblerService.Result result = service.assemble(CID, facts, "u1", "a@b.com");

    assertTrue(result.document().getMergedOutput()
        .contains("Run by 53 Challenges Pty Ltd in national."),
        result.document().getMergedOutput());
  }

  @Test
  void anUnknownMergeFieldIsLeftVisibleRatherThanBlanked() {
    // A silently deleted placeholder produces a sentence that reads fine and
    // says the wrong thing. Leaving it visible makes the gap reviewable.
    List<ApprovedClauseEntity> library = new ArrayList<>(fullLibrary());
    library.get(0).setBody("Contact {{nobody_defined_this}}.");
    when(clauses.findCurrent()).thenReturn(library);

    TermsAssemblerService.Result result = service.assemble(CID, facts(), "u1", "a@b.com");

    assertTrue(result.document().getMergedOutput().contains("{{nobody_defined_this}}"));
  }

  @Test
  void aSubstitutedValueIsNotItselfExpandedAgain() {
    // A fact whose value happens to contain a placeholder must be inserted
    // literally, not re-scanned — otherwise a prize description quoting a
    // template could pull in unrelated text.
    List<ApprovedClauseEntity> library = new ArrayList<>(fullLibrary());
    library.get(0).setBody("Prize: {{prize_descriptions}}");
    when(clauses.findCurrent()).thenReturn(library);

    Map<String, Object> facts = facts();
    facts.put("prize_descriptions", "{{min_age}} and up");

    TermsAssemblerService.Result result = service.assemble(CID, facts, "u1", "a@b.com");

    assertTrue(result.document().getMergedOutput().contains("Prize: {{min_age}} and up"),
        result.document().getMergedOutput());
  }

  // --------------------------------------------------------- config drift

  @Test
  void aChangedConfigSupersedesAPublishedDocumentAndStops() {
    TermsDocumentEntity published = new TermsDocumentEntity();
    published.setId("doc-1");
    published.setChallengeId(CID);
    published.setStatus("published");
    published.setConfigSnapshot("{\"classification\":\"game_of_skill\","
        + "\"audience_slug\":\"adults\"}");
    when(documents.findLive(CID)).thenReturn(List.of(published));
    when(clauses.findCurrent()).thenReturn(fullLibrary());

    Map<String, Object> facts = facts();
    facts.put("audience_slug", "minors");

    TermsAssemblerService.Result result = service.assemble(CID, facts, "u1", "a@b.com");

    assertTrue(result.failed());
    assertTrue(stops(result).contains("config_changed"), stops(result).toString());
    assertEquals("superseded", published.getStatus());
  }

  @Test
  void aChangedConfigOnlyWarnsWhenThePriorDocumentWasADraft() {
    TermsDocumentEntity draft = new TermsDocumentEntity();
    draft.setId("doc-1");
    draft.setChallengeId(CID);
    draft.setStatus("draft");
    draft.setConfigSnapshot("{\"classification\":\"game_of_skill\","
        + "\"promoter_type\":\"charity\"}");
    when(documents.findLive(CID)).thenReturn(List.of(draft));
    when(clauses.findCurrent()).thenReturn(fullLibrary());

    Map<String, Object> facts = facts();
    facts.put("promoter_type", "company");

    TermsAssemblerService.Result result = service.assemble(CID, facts, "u1", "a@b.com");

    assertFalse(result.failed(), stops(result).toString());
    assertEquals(1, result.warnings().size(), result.warnings().toString());
    assertEquals("superseded", draft.getStatus());
  }

  // ------------------------------------------------------ condition eval

  @Test
  void inclusionConditionsSupportEveryOperator() {
    Map<String, Object> facts = new LinkedHashMap<>();
    facts.put("count", 5);
    facts.put("name", "singing");
    facts.put("tags", List.of("music", "live"));
    facts.put("blank", "");

    assertTrue(service.matches(conditions("[{\"field\":\"count\",\"operator\":\"gt\","
        + "\"value\":3}]"), facts));
    assertFalse(service.matches(conditions("[{\"field\":\"count\",\"operator\":\"lt\","
        + "\"value\":3}]"), facts));
    assertTrue(service.matches(conditions("[{\"field\":\"name\",\"operator\":\"eq\","
        + "\"value\":\"singing\"}]"), facts));
    assertTrue(service.matches(conditions("[{\"field\":\"tags\",\"operator\":\"contains\","
        + "\"value\":\"live\"}]"), facts));
    assertTrue(service.matches(conditions("[{\"field\":\"tags\",\"operator\":\"not_contains\","
        + "\"value\":\"dance\"}]"), facts));
    assertTrue(service.matches(conditions("[{\"field\":\"name\",\"operator\":\"exists\"}]"),
        facts));
    assertFalse(service.matches(conditions("[{\"field\":\"blank\",\"operator\":\"exists\"}]"),
        facts), "an empty string does not exist, matching the JavaScript check");
    assertFalse(service.matches(conditions("[{\"field\":\"missing\",\"operator\":\"exists\"}]"),
        facts));
  }

  @Test
  void conditionsAreAndedAndAnEmptyListAlwaysMatches() {
    Map<String, Object> facts = Map.of("a", "1", "b", "2");

    assertTrue(service.matches(conditions("[]"), facts));
    assertTrue(service.matches(null, facts));
    assertTrue(service.matches(conditions("[{\"field\":\"a\",\"operator\":\"eq\",\"value\":\"1\"},"
        + "{\"field\":\"b\",\"operator\":\"eq\",\"value\":\"2\"}]"), facts));
    assertFalse(service.matches(conditions("[{\"field\":\"a\",\"operator\":\"eq\",\"value\":\"1\"},"
        + "{\"field\":\"b\",\"operator\":\"eq\",\"value\":\"x\"}]"), facts));
  }

  @Test
  void anUnknownOperatorNeverMatches() {
    // Fail closed: a condition nobody can evaluate must not include a clause.
    assertFalse(service.matches(
        conditions("[{\"field\":\"a\",\"operator\":\"wat\",\"value\":\"1\"}]"),
        Map.of("a", "1")));
  }

  // ------------------------------------------------------------ fixtures

  private JsonNode conditions(String raw) {
    try {
      return mapper.readTree(raw);
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  private static Map<String, Object> facts() {
    Map<String, Object> facts = new LinkedHashMap<>();
    facts.put("challenge_id", CID);
    return facts;
  }

  /** One signed, mandatory clause for each always-required category. */
  private static List<ApprovedClauseEntity> fullLibrary() {
    List<ApprovedClauseEntity> library = new ArrayList<>();
    for (String category : List.of("promoter_identity", "eligibility", "entry_method",
        "prizes", "privacy", "liability", "disputes", "general")) {
      library.add(clause(category, category, true, SIGNOFF));
    }
    return library;
  }

  private static ApprovedClauseEntity clause(
      String identifier, String category, boolean mandatory, String signoff) {

    ApprovedClauseEntity c = new ApprovedClauseEntity();
    c.setId("id-" + identifier);
    c.setIdentifier(identifier);
    c.setTitle(Character.toUpperCase(category.charAt(0)) + category.substring(1));
    c.setBody("Body of " + identifier + ".");
    c.setCategory(category);
    c.setMandatory(mandatory);
    c.setLegalSignoff(signoff);
    c.setIsCurrent(true);
    return c;
  }

  private static List<String> stops(TermsAssemblerService.Result result) {
    return result.errors().stream().map(TermsAssemblerService.Stop::stop).toList();
  }

  private static String detail(TermsAssemblerService.Result result) {
    return String.join(" | ",
        result.errors().stream().map(TermsAssemblerService.Stop::detail).toList());
  }
}
