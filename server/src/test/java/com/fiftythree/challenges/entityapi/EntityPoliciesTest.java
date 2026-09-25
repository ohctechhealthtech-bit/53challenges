package com.fiftythree.challenges.entityapi;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fiftythree.challenges.entity.ChallengeDraftEntity;
import com.fiftythree.challenges.entity.ChallengeEntity;
import com.fiftythree.challenges.entity.EntryEntity;
import com.fiftythree.challenges.entity.JudgeProfileEntity;
import com.fiftythree.challenges.entity.MessageEntity;
import com.fiftythree.challenges.entityapi.EntityPolicies.Operation;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * These rules decide whether one competitor can read another's entry, whether a
 * host can see somebody else's proposal, and whether prize and payout rows are
 * exposed to any account holder. They were transcribed by hand from the
 * {@code rls} blocks in {@code base44/entities/*.jsonc}, and a transcription
 * error here does not fail loudly — it quietly widens access.
 *
 * <p>So every rule is asserted from both sides: the person who should get in,
 * and the person who should not.
 */
class EntityPoliciesTest {

  private static final RowPolicy.Caller ANONYMOUS = new RowPolicy.Caller(null, null, false);
  private static final RowPolicy.Caller ALICE =
      new RowPolicy.Caller("user-alice", "alice@example.com", false);
  private static final RowPolicy.Caller BOB =
      new RowPolicy.Caller("user-bob", "bob@example.com", false);
  private static final RowPolicy.Caller ADMIN =
      new RowPolicy.Caller("user-admin", "admin@example.com", true);

  private final EntityPolicies policies = new EntityPolicies();

  // ------------------------------------------------------- the deny default

  @Test
  void anEntityWithNoPolicyIsRefusedEntirely() {
    // The guarantee that adding a database table does not publish it.
    for (Operation operation : Operation.values()) {
      assertFalse(policies.forEntity("SomeNewTable").forOperation(operation)
          .allows(new EntryEntity(), ADMIN), operation + " on an unlisted entity");
    }
    assertFalse(policies.isKnown("SomeNewTable"));
  }

  @Test
  void aTypoInAnEntityNameFailsClosedRatherThanOpen() {
    assertFalse(policies.isKnown("entry"), "names are case-sensitive");
    assertFalse(policies.forEntity("entry").read().allows(new EntryEntity(), ADMIN));
  }

  // ------------------------------------------------- undeclared = admin only

  @Test
  void entitiesWithNoDeclaredRlsAreAdminOnly() {
    // The decision taken for the 17 entities whose Base44 rules are not
    // recorded anywhere. Prize and payout rows are the reason.
    for (String entity : List.of("PrizeLedger", "PrizePayout", "VoteAuditLog",
        "AuditFinding", "AuditReview", "CombinedResult", "EmailCampaign",
        "LaunchCompetition", "Pathway", "PathwayMember", "Promotion",
        "SeriesStanding", "SponsorProfile")) {

      assertTrue(policies.isKnown(entity), entity + " should be listed");
      assertFalse(policies.forEntity(entity).read().allows(new EntryEntity(), ALICE),
          entity + " must not be readable by an ordinary signed-in caller");
      assertFalse(policies.forEntity(entity).read().allows(new EntryEntity(), ANONYMOUS),
          entity + " must not be readable anonymously");
      assertTrue(policies.forEntity(entity).read().allows(new EntryEntity(), ADMIN),
          entity + " should be readable by an admin");
    }
  }

  @Test
  void publicReferenceDataIsReadableAnonymouslyButNotWritable() {
    // These render before sign-in. Locking them would blank the public site;
    // letting anyone write them would let anyone restyle it.
    for (String entity : List.of("ChallengeCategory", "Jurisdiction",
        "SiteSetting", "Subcategory")) {

      assertTrue(policies.forEntity(entity).read().allows(new EntryEntity(), ANONYMOUS),
          entity + " should be publicly readable");
      assertFalse(policies.forEntity(entity).update().allows(new EntryEntity(), ALICE),
          entity + " must not be writable by an ordinary caller");
      assertTrue(policies.forEntity(entity).update().allows(new EntryEntity(), ADMIN));
    }
  }

  // ------------------------------------------------------------ admin only

  @Test
  void judgingAndVotingDataIsAdminOnly() {
    // Scores and votes decide who wins. A competitor reading them mid-contest
    // is the failure this prevents.
    for (String entity : List.of("Score", "Vote", "JudgingPanel", "CalibrationScore",
        "CompetitionAssignment", "EntryJudgeAssignment", "JudgingAuditLog",
        "PartnerInquiry")) {

      assertFalse(policies.forEntity(entity).read().allows(new EntryEntity(), ALICE), entity);
      assertTrue(policies.forEntity(entity).read().allows(new EntryEntity(), ADMIN), entity);
    }
  }

  // ------------------------------------------------------------- ownership

  @Test
  void anEntrantReadsTheirOwnEntryAndNobodyElses() {
    EntryEntity hers = new EntryEntity();
    hers.setCreatorEmail("alice@example.com");

    RowPolicy read = policies.forEntity("Entry").read();
    assertTrue(read.allows(hers, ALICE));
    assertFalse(read.allows(hers, BOB), "another competitor must not read it");
    assertFalse(read.allows(hers, ANONYMOUS));
    assertTrue(read.allows(hers, ADMIN));
  }

  @Test
  void ownershipByEmailIgnoresCase() {
    // The same person signs in as Alice@Example.com and alice@example.com. A
    // case-sensitive match would hide their own entry from them.
    EntryEntity hers = new EntryEntity();
    hers.setCreatorEmail("Alice@Example.COM");

    assertTrue(policies.forEntity("Entry").read().allows(hers, ALICE));
  }

  @Test
  void aRowWithNoOwnerIsNotOwnedByEveryone() {
    // The null-matches-null trap: an entry whose creator_email was never set
    // must not become readable by a caller whose email is also absent.
    EntryEntity orphan = new EntryEntity();

    assertFalse(policies.forEntity("Entry").read().allows(orphan, ANONYMOUS));
    assertFalse(policies.forEntity("Entry").read().allows(orphan, ALICE));
  }

  @Test
  void anEntrantCannotEditTheirOwnEntryThroughTheEntityApi() {
    // Reading is owner-scoped but writing is admin-only, matching Base44.
    // Entries are edited through submitChallengeEntry, which applies the
    // compliance gates; a direct PUT here would bypass them.
    EntryEntity hers = new EntryEntity();
    hers.setCreatorEmail("alice@example.com");

    assertFalse(policies.forEntity("Entry").update().allows(hers, ALICE));
    assertFalse(policies.forEntity("Entry").create().allows(hers, ALICE));
  }

  // ----------------------------------------------------------- the packs

  @Test
  void aHostSeesTheirOwnProposalButNotTheTemplateLibrary() {
    // Proposals and templates share one table. A host reading templates would
    // see the platform's unpublished commercial material.
    ChallengeDraftEntity proposal = new ChallengeDraftEntity();
    proposal.setCreatedById("user-alice");
    proposal.setIsTemplate(false);

    ChallengeDraftEntity template = new ChallengeDraftEntity();
    template.setCreatedById("user-alice");
    template.setIsTemplate(true);

    RowPolicy read = policies.forEntity("ChallengeDraft").read();
    assertTrue(read.allows(proposal, ALICE));
    assertFalse(read.allows(template, ALICE), "a template is not a host's proposal");
    assertFalse(read.allows(proposal, BOB), "another host must not read it");
    assertTrue(read.allows(template, ADMIN));
  }

  @Test
  void aPublishedChallengeIsPublicAndADraftIsNot() {
    RowPolicy read = policies.forEntity("Challenge").read();

    for (String status : List.of("published", "entry_open", "voting_open", "closed")) {
      ChallengeEntity live = new ChallengeEntity();
      live.setLifecycleStatus(status);
      assertTrue(read.allows(live, ANONYMOUS), status + " should be publicly readable");
    }

    ChallengeEntity draft = new ChallengeEntity();
    draft.setLifecycleStatus("draft");
    assertFalse(read.allows(draft, ANONYMOUS), "an unpublished challenge is not public");
    assertFalse(read.allows(draft, ALICE));
    assertTrue(read.allows(draft, ADMIN));

    ChallengeEntity inReview = new ChallengeEntity();
    inReview.setLifecycleStatus("in_review");
    assertFalse(read.allows(inReview, ANONYMOUS));
  }

  @Test
  void aJudgeReadsTheirOwnProfileOnly() {
    JudgeProfileEntity hers = new JudgeProfileEntity();
    hers.setEmail("alice@example.com");

    RowPolicy read = policies.forEntity("JudgeProfile").read();
    assertTrue(read.allows(hers, ALICE));
    assertFalse(read.allows(hers, BOB));
    // Base44 declared no create rule, so creating one is admin-only.
    assertFalse(policies.forEntity("JudgeProfile").create().allows(hers, ALICE));
  }

  @Test
  void bothPartiesToAMessageCanReadIt() {
    MessageEntity message = new MessageEntity();
    message.setCreatedById("user-alice");
    message.setParticipantEmail("bob@example.com");

    RowPolicy read = policies.forEntity("Message").read();
    assertTrue(read.allows(message, ALICE), "the sender");
    assertTrue(read.allows(message, BOB), "the participant");
    assertFalse(read.allows(message, new RowPolicy.Caller("user-eve", "eve@example.com", false)),
        "a third party must not read it");
  }

  @Test
  void onlyTheSenderMayDeleteAMessage() {
    // Read and update admit both parties; delete admits only the author, so
    // the other side cannot erase a conversation from under them.
    MessageEntity message = new MessageEntity();
    message.setCreatedById("user-alice");
    message.setParticipantEmail("bob@example.com");

    assertTrue(policies.forEntity("Message").update().allows(message, BOB));
    assertFalse(policies.forEntity("Message").delete().allows(message, BOB));
    assertTrue(policies.forEntity("Message").delete().allows(message, ALICE));
  }

  @Test
  void commentsArePubliclyReadableAndEditableOnlyByTheirAuthor() {
    var comment = new com.fiftythree.challenges.entity.EntryCommentEntity();
    comment.setCreatedById("user-alice");

    assertTrue(policies.forEntity("EntryComment").read().allows(comment, ANONYMOUS));
    assertTrue(policies.forEntity("EntryComment").update().allows(comment, ALICE));
    assertFalse(policies.forEntity("EntryComment").update().allows(comment, BOB));
    assertTrue(policies.forEntity("EntryComment").delete().allows(comment, ADMIN));
  }

  @Test
  void aHostTeamMemberIsVisibleToTheOwnerAndToTheMemberThemselves() {
    var member = new com.fiftythree.challenges.entity.HostTeamMemberEntity();
    member.setCreatedById("user-alice");
    member.setEmail("bob@example.com");

    RowPolicy read = policies.forEntity("HostTeamMember").read();
    assertTrue(read.allows(member, ALICE), "the host who added them");
    assertTrue(read.allows(member, BOB), "the member themselves");
    assertFalse(read.allows(member,
        new RowPolicy.Caller("user-eve", "eve@example.com", false)));
    // The member can see their own row but cannot change it.
    assertFalse(policies.forEntity("HostTeamMember").update().allows(member, BOB));
  }

  // ------------------------------------------------------- anonymous callers

  @Test
  void anAnonymousCallerMatchesNoOwnershipRule() {
    // Anonymous means no id and no email. Every ownership branch must reject
    // rather than comparing null to null.
    for (String entity : List.of("Entry", "ChallengeDraft", "Message",
        "HostTeamMember", "JudgeProfile")) {

      assertFalse(policies.forEntity(entity).read().allows(blankRow(entity), ANONYMOUS),
          entity + " must not admit an anonymous caller by ownership");
    }
  }

  private static Object blankRow(String entity) {
    return switch (entity) {
      case "Entry" -> new EntryEntity();
      case "ChallengeDraft" -> new ChallengeDraftEntity();
      case "Message" -> new MessageEntity();
      case "HostTeamMember" -> new com.fiftythree.challenges.entity.HostTeamMemberEntity();
      default -> new JudgeProfileEntity();
    };
  }
}
