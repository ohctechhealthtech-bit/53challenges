package com.fiftythree.challenges.llm;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiftythree.challenges.entity.PartnerInquiryEntity;
import com.fiftythree.challenges.entity.PartnerInquiryRepository;
import com.fiftythree.challenges.security.CallerResolver;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

/**
 * What happens when the language model is not there.
 *
 * <p>This matters because the key is set through an environment variable on a
 * server nobody looks at often. The failure has to be legible: a 503 that says
 * what is wrong, and no half-written record left behind. A 500 with a stack
 * trace sends whoever is on call looking at the wrong thing.
 */
class LlmDegradationTest {

  private final ObjectMapper mapper = new ObjectMapper();

  private PartnerInquiryRepository inquiries;
  private CallerResolver caller;

  @BeforeEach
  void setUp() {
    inquiries = mock(PartnerInquiryRepository.class);
    caller = mock(CallerResolver.class);
    when(caller.email(any())).thenReturn(null);
  }

  private PlanChallengeController controllerWith(LlmClient llm) {
    return new PlanChallengeController(llm, inquiries, caller, mapper);
  }

  private LlmClient unconfigured() {
    return new LlmClient(mapper, "", "claude-sonnet-5", 4096, 120);
  }

  @Test
  void aClientWithNoKeyReportsItselfUnconfigured() {
    assertFalse(unconfigured().isConfigured());
    assertFalse(new LlmClient(mapper, "   ", "claude-sonnet-5", 4096, 120).isConfigured(),
        "whitespace is not a key");
    assertTrue(new LlmClient(mapper, "sk-real", "claude-sonnet-5", 4096, 120).isConfigured());
  }

  @Test
  void invokingWithNoKeySaysSoRatherThanFailingObscurely() {
    LlmClient.LlmUnavailableException thrown = assertThrows(
        LlmClient.LlmUnavailableException.class,
        () -> unconfigured().invoke("anything", mapper.createObjectNode()));

    assertTrue(thrown.getMessage().contains("LLM_API_KEY"),
        "the message should name the setting to fix: " + thrown.getMessage());
  }

  @Test
  void anUnavailableModelIs503AndLeavesTheInquiryUntouched() {
    PartnerInquiryEntity inquiry = new PartnerInquiryEntity();
    inquiry.setId("inq-1");
    inquiry.setStatus("new");
    when(inquiries.findById("inq-1")).thenReturn(Optional.of(inquiry));

    ResponseEntity<?> response =
        controllerWith(unconfigured()).handle(Map.of("inquiry_id", "inq-1"));

    assertEquals(503, response.getStatusCode().value(),
        "503, not 500 — the request was fine and a retry may work");
    // The important half: no partial write. The enquiry must not be left
    // claiming to be in planning with no plan attached.
    assertEquals("new", inquiry.getStatus());
    verify(inquiries, never()).save(any());
  }

  @Test
  void aMissingInquiryIs404BeforeTheModelIsEverCalled() {
    LlmClient llm = mock(LlmClient.class);
    when(inquiries.findById("nope")).thenReturn(Optional.empty());

    ResponseEntity<?> response =
        controllerWith(llm).handle(Map.of("inquiry_id", "nope"));

    assertEquals(404, response.getStatusCode().value());
    // Not merely tidy: the model costs money per call, so a bad id must not
    // reach it.
    verify(llm, never()).invoke(any(), any());
  }

  @Test
  void aSignedInNonAdminIsRefusedBeforeAnythingElse() {
    // The workflow calls this with no user, so anonymous is allowed. A person
    // who is signed in and not an admin is not.
    LlmClient llm = mock(LlmClient.class);
    when(caller.email(any())).thenReturn("someone@example.com");
    when(caller.isAdmin(any())).thenReturn(false);

    ResponseEntity<?> response = controllerWith(llm)
        .handle(Map.of("inquiry_id", "inq-1", "session_token", "t"));

    assertEquals(403, response.getStatusCode().value());
    verify(inquiries, never()).findById(any());
    verify(llm, never()).invoke(any(), any());
  }
}
