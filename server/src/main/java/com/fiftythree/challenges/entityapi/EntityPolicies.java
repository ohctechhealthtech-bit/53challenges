package com.fiftythree.challenges.entityapi;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * Who may read and write each entity through the generic entity API.
 *
 * <p>This is a port of the {@code rls} blocks in
 * {@code base44/entities/*.jsonc}, gathered into one table deliberately: these
 * are the rules that decide whether one competitor can read another's entry, so
 * they should be reviewable in a single sitting rather than scattered across
 * thirty controllers.
 *
 * <p><b>Anything not listed here is refused.</b> {@link #forEntity} returns a
 * deny-all policy for an unknown entity, so adding a table to the database does
 * not silently publish it, and a typo in a name here fails closed.
 *
 * <p>Entities that declared <em>no</em> RLS on Base44 are listed as
 * {@link Policy#ADMIN_ONLY} rather than being left out. Base44's platform
 * default for those is not recorded anywhere in this repository, and the
 * entities concerned include prize ledgers, payout records and audit logs —
 * so they are admin-only here until each one is deliberately relaxed with a
 * reason. A page that breaks because of this is a page that was relying on an
 * access rule nobody had written down.
 */
@Component
public class EntityPolicies {

  /** The four operations, each with its own rule. */
  public record Policy(RowPolicy read, RowPolicy create, RowPolicy update, RowPolicy delete) {

    static final Policy ADMIN_ONLY = new Policy(
        RowPolicy.admin(), RowPolicy.admin(), RowPolicy.admin(), RowPolicy.admin());

    /** Readable by anyone; only an admin may change it. Reference data. */
    static Policy publicRead() {
      return new Policy(
          RowPolicy.anyone(), RowPolicy.admin(), RowPolicy.admin(), RowPolicy.admin());
    }

    public RowPolicy forOperation(Operation operation) {
      return switch (operation) {
        case READ -> read;
        case CREATE -> create;
        case UPDATE -> update;
        case DELETE -> delete;
      };
    }
  }

  /** What the caller is trying to do. */
  public enum Operation { READ, CREATE, UPDATE, DELETE }

  private final Map<String, Policy> policies = build();

  /** The policy for an entity, or a deny-all one when it is not listed. */
  public Policy forEntity(String entityName) {
    return policies.getOrDefault(entityName,
        new Policy(RowPolicy.denied(), RowPolicy.denied(),
            RowPolicy.denied(), RowPolicy.denied()));
  }

  /** Whether the entity API serves this entity at all. */
  public boolean isKnown(String entityName) {
    return policies.containsKey(entityName);
  }

  public java.util.Set<String> entityNames() {
    return policies.keySet();
  }

  private static Map<String, Policy> build() {
    Map<String, Policy> map = new LinkedHashMap<>();

    // ── Declared on Base44 as admin-only across all four operations ──────
    for (String entity : List.of(
        "CalibrationScore",
        "CompetitionAssignment",
        "EntryJudgeAssignment",
        "JudgingAuditLog",
        "JudgingPanel",
        "PartnerInquiry",
        "Score",
        "Vote")) {
      map.put(entity, Policy.ADMIN_ONLY);
    }

    // ── Declared, with their own conditions ──────────────────────────────

    // A challenge is public once it has been published, and stays readable
    // after it closes so results remain visible. Anything earlier is a draft.
    map.put("Challenge", new Policy(
        RowPolicy.anyOf(
            RowPolicy.whereIn("lifecycleStatus",
                List.of("published", "entry_open", "voting_open", "closed")),
            RowPolicy.admin()),
        RowPolicy.admin(), RowPolicy.admin(), RowPolicy.admin()));

    // A host sees their own proposals but never the shared template library,
    // which lives in the same table and is admin-managed.
    RowPolicy ownDraft = RowPolicy.allOf(
        RowPolicy.createdBy(), RowPolicy.where("isTemplate", Boolean.TRUE, false));
    map.put("ChallengeDraft", new Policy(
        RowPolicy.anyOf(ownDraft, RowPolicy.admin()),
        RowPolicy.createdBy(),
        RowPolicy.anyOf(ownDraft, RowPolicy.admin()),
        RowPolicy.admin()));

    // An entrant sees their own entry. Everyone else reads entries through
    // the feed endpoints, which filter to approved work.
    map.put("Entry", new Policy(
        RowPolicy.anyOf(RowPolicy.ownedByEmail("creatorEmail"), RowPolicy.admin()),
        RowPolicy.admin(), RowPolicy.admin(), RowPolicy.admin()));

    // Comments are public to read — they appear under entries — and editable
    // only by whoever wrote them.
    map.put("EntryComment", new Policy(
        RowPolicy.anyone(),
        RowPolicy.createdBy(),
        RowPolicy.anyOf(RowPolicy.createdBy(), RowPolicy.admin()),
        RowPolicy.anyOf(RowPolicy.createdBy(), RowPolicy.admin())));

    map.put("HostTeamMember", new Policy(
        RowPolicy.anyOf(RowPolicy.createdBy(), RowPolicy.ownedByEmail("email"),
            RowPolicy.admin()),
        RowPolicy.createdBy(),
        RowPolicy.anyOf(RowPolicy.createdBy(), RowPolicy.admin()),
        RowPolicy.anyOf(RowPolicy.createdBy(), RowPolicy.admin())));

    // A judge reads their own profile. Base44 declared no create rule for
    // this entity, so creating one is admin-only.
    map.put("JudgeProfile", new Policy(
        RowPolicy.anyOf(RowPolicy.ownedByEmail("email"), RowPolicy.admin()),
        RowPolicy.admin(), RowPolicy.admin(), RowPolicy.admin()));

    // Either party to the conversation, or an admin. No create rule was
    // declared, so messages are created through the teamMessages function.
    RowPolicy messageParty = RowPolicy.anyOf(
        RowPolicy.createdBy(), RowPolicy.ownedByEmail("participantEmail"), RowPolicy.admin());
    map.put("Message", new Policy(
        messageParty, RowPolicy.admin(), messageParty,
        RowPolicy.anyOf(RowPolicy.createdBy(), RowPolicy.admin())));

    // ── No RLS declared on Base44 — admin-only until deliberately relaxed ─
    //
    // The platform default that applied to these is not recorded in this
    // repository. Several hold money and audit trails, so the safe reading is
    // the restrictive one. Relax individually, with a reason, once the pages
    // that need them are known.
    for (String entity : List.of(
        "AuditFinding",
        "AuditReview",
        "CombinedResult",
        "EmailCampaign",
        "LaunchCompetition",
        "Pathway",
        "PathwayMember",
        "PrizeLedger",
        "PrizePayout",
        "Promotion",
        "SeriesStanding",
        "SponsorProfile",
        "VoteAuditLog")) {
      map.put(entity, Policy.ADMIN_ONLY);
    }

    // ── No RLS declared, but unambiguously public reference data ─────────
    //
    // These four are read by anonymous visitors on pages that render before
    // sign-in — the category menus, the site theme and the jurisdiction list.
    // Locking them to admins would blank the public site, and they contain no
    // personal or commercial data.
    for (String entity : List.of(
        "ChallengeCategory",
        "Jurisdiction",
        "SiteSetting",
        "Subcategory")) {
      map.put(entity, Policy.publicRead());
    }

    return Map.copyOf(map);
  }
}
