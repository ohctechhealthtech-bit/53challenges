package com.fiftythree.challenges.entityapi;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.fiftythree.challenges.entity.ChallengeEntity;
import com.fiftythree.challenges.entity.EntryEntity;
import com.fiftythree.challenges.entity.PrizeLedgerEntity;
import com.fiftythree.challenges.security.CallerResolver;
import com.fiftythree.challenges.user.UserRepository;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

/**
 * The entity API decides row visibility inside a SQL query, so a wrong
 * predicate cannot be caught by mocks — one that matches every row looks
 * exactly like a correct one until it runs. These tests put real rows in a
 * real database and check what actually comes back for each caller.
 *
 * <p>The question being asked throughout: can somebody read a row that is not
 * theirs? Every case here is one where getting it wrong discloses a
 * competitor's entry, an unpublished challenge, or a prize ledger.
 */
@SpringBootTest
@ActiveProfiles("entityapi-test")
@Transactional
class EntityApiSecurityTest {

  
  @Autowired private EntityApiController controller;
  @Autowired private EntityManager entityManager;

  @MockBean private CallerResolver caller;
  @MockBean private UserRepository users;

  @BeforeEach
  void seed() {
    entityManager.createQuery("delete from EntryEntity").executeUpdate();
    entityManager.createQuery("delete from ChallengeEntity").executeUpdate();
    entityManager.createQuery("delete from PrizeLedgerEntity").executeUpdate();

    persistEntry("entry-alice", "alice@example.com", "Alice's song");
    persistEntry("entry-bob", "bob@example.com", "Bob's poem");

    persistChallenge("ch-live", "entry_open");
    persistChallenge("ch-draft", "draft");

    PrizeLedgerEntity ledger = new PrizeLedgerEntity();
    ledger.setId("ledger-1");
    ledger.setCompetitionId("ch-live");
    entityManager.persist(ledger);

    entityManager.flush();
  }

  // --------------------------------------------------------------- reads

  @Test
  void anEntrantListingEntriesSeesOnlyTheirOwn() {
    signedInAs("alice@example.com", "user-alice", false);

    List<Map<String, Object>> rows = list("Entry", null);

    assertEquals(1, rows.size(), "Alice must not see Bob's entry");
    assertEquals("Alice's song", rows.get(0).get("title"));
  }

  @Test
  void anEntrantCannotReachAnotherEntrantsEntryByFilteringForIt() {
    // The obvious attack: ask for the row directly by its owner. The policy
    // predicate is ANDed with the caller's filter, so it still cannot widen
    // what they may see.
    signedInAs("alice@example.com", "user-alice", false);

    assertEquals(0, list("Entry", "{\"creator_email\":\"bob@example.com\"}").size());
  }

  @Test
  void anEntrantCannotFetchAnotherEntrantsEntryById() {
    signedInAs("alice@example.com", "user-alice", false);

    ResponseEntity<?> response = controller.get("Entry", "entry-bob");
    assertEquals(404, response.getStatusCode().value(),
        "404 rather than 403, so a hidden row is not confirmed to exist");
  }

  @Test
  void anAdminSeesEveryEntry() {
    signedInAs("admin@example.com", "user-admin", true);

    assertEquals(2, list("Entry", null).size());
  }

  @Test
  void anAnonymousCallerSeesNoEntriesAtAll() {
    anonymous();

    assertEquals(0, list("Entry", null).size());
  }

  @Test
  void aPrizeLedgerIsInvisibleToAnOrdinarySignedInCaller() {
    // The decision taken for the 17 entities with no declared rules. If this
    // ever returns a row, the money data is public to every account holder.
    signedInAs("alice@example.com", "user-alice", false);
    assertEquals(0, list("PrizeLedger", null).size());

    anonymous();
    assertEquals(0, list("PrizeLedger", null).size());

    signedInAs("admin@example.com", "user-admin", true);
    assertEquals(1, list("PrizeLedger", null).size());
  }

  @Test
  void onlyPublishedChallengesAreVisibleAnonymously() {
    anonymous();

    List<Map<String, Object>> rows = list("Challenge", null);
    assertEquals(1, rows.size());
    assertEquals("ch-live", rows.get(0).get("id"));

    signedInAs("admin@example.com", "user-admin", true);
    assertEquals(2, list("Challenge", null).size());
  }

  @Test
  void countIsFilteredByTheSamePolicyAsTheList() {
    // A count that ignored the policy would leak how many rows exist beyond
    // the ones the caller may read.
    signedInAs("alice@example.com", "user-alice", false);

    ResponseEntity<?> response = controller.count("Entry", null);
    assertEquals(1, ((Map<?, ?>) response.getBody()).get("count"));
  }

  // ------------------------------------------------------- unknown things

  @Test
  void anEntityWithNoPolicyIsNotServed() {
    signedInAs("admin@example.com", "user-admin", true);

    // Mapped in the database, but deliberately absent from the policy table.
    ResponseEntity<?> response = controller.list("GuardianConsent", null, null, null, null, null);
    assertEquals(404, response.getStatusCode().value());
  }

  @Test
  void anUnsupportedQueryOperatorIsRefusedRatherThanIgnored() {
    // Ignoring it would widen the result set instead of narrowing it, which on
    // a filtered list is a disclosure rather than a bug.
    signedInAs("admin@example.com", "user-admin", true);

    ResponseEntity<?> response = controller.list("Entry",
        "{\"creator_email\":{\"$ne\":\"alice@example.com\"}}", null, null, null, null);

    assertEquals(400, response.getStatusCode().value());
    assertTrue(String.valueOf(((Map<?, ?>) response.getBody()).get("error"))
        .contains("Unsupported query operator"));
  }

  @Test
  void anUnknownFieldIsA400NotA500() {
    signedInAs("admin@example.com", "user-admin", true);

    ResponseEntity<?> response =
        controller.list("Entry", "{\"nope\":\"x\"}", null, null, null, null);

    assertEquals(400, response.getStatusCode().value());
  }

  @Test
  void anUnknownSortFieldIsA400NotA500() {
    signedInAs("admin@example.com", "user-admin", true);

    assertEquals(400,
        controller.list("Entry", null, "-nope", null, null, null)
            .getStatusCode().value());
  }

  // --------------------------------------------------------------- writes

  @Test
  void anEntrantCannotDeleteAnotherEntrantsEntry() {
    signedInAs("alice@example.com", "user-alice", false);

    assertEquals(403, controller.delete("Entry", "entry-bob").getStatusCode().value());
    assertTrue(entityManager.find(EntryEntity.class, "entry-bob") != null,
        "the row must still be there");
  }

  @Test
  void anEntrantCannotEditTheirOwnEntryThroughThisApi() {
    // Writing entries is admin-only, matching Base44: entries go through
    // submitChallengeEntry, which applies the compliance gates. A direct PUT
    // here would bypass them.
    signedInAs("alice@example.com", "user-alice", false);

    assertEquals(403, controller
        .update("Entry", "entry-alice", Map.of("title", "Rewritten"))
        .getStatusCode().value());
  }

  @Test
  void anUpdateCannotRewriteTheOwnerToStealARow() {
    // The row is judged as it stands, before the patch. Judging it afterwards
    // would let a caller hand themselves somebody else's row in one request.
    signedInAs("alice@example.com", "user-alice", false);

    ResponseEntity<?> response = controller.update("Entry", "entry-bob",
        Map.of("creator_email", "alice@example.com"));

    assertEquals(403, response.getStatusCode().value());
    EntryEntity bob = entityManager.find(EntryEntity.class, "entry-bob");
    assertEquals("bob@example.com", bob.getCreatorEmail(), "still Bob's");
  }

  @Test
  void aClientSuppliedIdIsIgnoredOnCreate() {
    // The SDK round-trips whole records, so a client sending back an id is
    // normal — but it must not be able to choose one and overwrite a row.
    signedInAs("admin@example.com", "user-admin", true);

    ResponseEntity<?> response = controller.create("Challenge",
        Map.of("id", "ch-draft", "title", "Injected", "lifecycle_status", "draft"));

    assertEquals(200, response.getStatusCode().value());
    String created = String.valueOf(((Map<?, ?>) response.getBody()).get("id"));
    assertFalse("ch-draft".equals(created), "a fresh id is generated");
    assertEquals(3, entityManager.createQuery(
        "select count(c) from ChallengeEntity c", Long.class).getSingleResult().intValue());
  }

  @Test
  void anAnonymousCallerCannotCreateAnything() {
    anonymous();

    assertEquals(401, controller.create("EntryComment", Map.of("body", "hello"))
        .getStatusCode().value());
  }

  // ------------------------------------------------------------- fixtures

  private void signedInAs(String email, String userId, boolean admin) {
    when(caller.email(any())).thenReturn(email);
    when(caller.isAdmin(any())).thenReturn(admin);
    when(users.findIdByEmail(email)).thenReturn(Optional.of(userId));
  }

  private void anonymous() {
    when(caller.email(any())).thenReturn(null);
    when(caller.isAdmin(any())).thenReturn(false);
    when(users.findIdByEmail(any())).thenReturn(Optional.empty());
  }

  @SuppressWarnings("unchecked")
  private List<Map<String, Object>> list(String entity, String q) {
    ResponseEntity<?> response = controller.list(entity, q, null, null, null, null);
    assertEquals(200, response.getStatusCode().value(), "expected a list response");
    return (List<Map<String, Object>>) response.getBody();
  }

  private void persistEntry(String id, String creatorEmail, String title) {
    EntryEntity entry = new EntryEntity();
    entry.setId(id);
    entry.setChallengeId("ch-live");
    entry.setCreatorEmail(creatorEmail);
    entry.setTitle(title);
    entry.setStatus("approved");
    entry.setCreatedDate(Instant.now());
    entityManager.persist(entry);
  }

  private void persistChallenge(String id, String lifecycleStatus) {
    ChallengeEntity challenge = new ChallengeEntity();
    challenge.setId(id);
    challenge.setTitle("Challenge " + id);
    challenge.setLifecycleStatus(lifecycleStatus);
    challenge.setSource("native");
    challenge.setCreatedDate(Instant.now());
    entityManager.persist(challenge);
  }
}
