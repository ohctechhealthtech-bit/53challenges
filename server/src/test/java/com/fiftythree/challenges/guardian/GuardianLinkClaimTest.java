package com.fiftythree.challenges.guardian;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fiftythree.challenges.compliance.ComplianceAuditService;
import com.fiftythree.challenges.engine.EntryQueryRepository;
import com.fiftythree.challenges.entity.GuardianChildEntity;
import com.fiftythree.challenges.entity.GuardianEntity;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * Linking a child is a claim, not a relationship.
 *
 * <p>The guardian types the address, so on its own it proves nothing. Before
 * this, the link was created active immediately — so anyone registered as a
 * guardian could name a competitor's email and read their entries, titles,
 * submission times and vote counts through the portal's activity view.
 */
class GuardianLinkClaimTest {

  private final GuardianChildQueryRepository children = mock(GuardianChildQueryRepository.class);

  private final GuardianService service = new GuardianService(
      mock(GuardianQueryRepository.class),
      children,
      mock(GuardianApprovalRequestQueryRepository.class),
      mock(GuardianConsentQueryRepository.class),
      mock(EntryQueryRepository.class),
      mock(ComplianceAuditService.class));

  private GuardianEntity guardian() {
    GuardianEntity g = new GuardianEntity();
    g.setId("g1");
    g.setEmail("guardian@example.com");
    return g;
  }

  private void savesAreEchoed() {
    when(children.save(any())).thenAnswer(i -> i.getArgument(0));
  }

  @Test
  void aNewLinkStartsPendingRatherThanActive() {
    savesAreEchoed();
    when(children.findLink(anyString(), anyString())).thenReturn(List.of());

    GuardianChildEntity link = service.linkChild(guardian(), "A Child", "Child@Example.com ");

    assertEquals("pending", link.getStatus(),
        "a guardian-supplied email must not grant access on its own");
    // Normalised, so the confirmation lookup matches however it was typed.
    assertEquals("child@example.com", link.getChildEmail());
  }

  /**
   * Revoking and re-adding must not be a way around confirmation — otherwise
   * the check is one extra click rather than a control.
   */
  @Test
  void reAddingARevokedLinkReturnsItToPendingNotActive() {
    savesAreEchoed();
    GuardianChildEntity existing = new GuardianChildEntity();
    existing.setId("c1");
    existing.setGuardianId("g1");
    existing.setChildEmail("child@example.com");
    existing.setStatus("revoked");
    when(children.findLink(anyString(), anyString())).thenReturn(List.of(existing));

    GuardianChildEntity link = service.linkChild(guardian(), "A Child", "child@example.com");

    assertEquals("pending", link.getStatus());
  }

  /** An already-confirmed link is left alone rather than reset. */
  @Test
  void anActiveLinkIsUnchanged() {
    GuardianChildEntity existing = new GuardianChildEntity();
    existing.setId("c1");
    existing.setGuardianId("g1");
    existing.setChildEmail("child@example.com");
    existing.setStatus("active");
    when(children.findLink(anyString(), anyString())).thenReturn(List.of(existing));

    GuardianChildEntity link = service.linkChild(guardian(), "A Child", "child@example.com");

    assertEquals("active", link.getStatus());
  }
}
