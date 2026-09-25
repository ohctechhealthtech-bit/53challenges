package com.fiftythree.challenges.pathway;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiftythree.challenges.entity.CombinedResultEntity;
import com.fiftythree.challenges.entity.EntryEntity;
import com.fiftythree.challenges.engine.EntryQueryRepository;
import com.fiftythree.challenges.entity.GuardianConsentEntity;
import com.fiftythree.challenges.entity.PathwayEntity;
import com.fiftythree.challenges.entity.PathwayMemberEntity;
import com.fiftythree.challenges.entity.PromotionEntity;
import com.fiftythree.challenges.entity.SeriesStandingEntity;
import com.fiftythree.challenges.guardian.GuardianConsentQueryRepository;
import com.fiftythree.challenges.judging.CombinedResultQueryRepository;
import com.fiftythree.challenges.judging.JudgingPanelQueryRepository;
import com.fiftythree.challenges.security.CallerResolver;
import com.fiftythree.challenges.support.JsonColumn;
import com.fiftythree.challenges.upstream.ChallengeApiClient;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * The Java replacement for {@code pathways}: multi-stage competitions, where
 * winners of one challenge are promoted into the next and points accumulate
 * across a season.
 *
 * <p>Two parts of this need care.
 *
 * <p><b>Gating.</b> Private-organisation and invitational pathways restrict who
 * may enter. {@code public_config} tells the submit form what to ask for, and
 * {@code entry_check} decides. They are separate because the first is public —
 * the form has to render before anyone signs in — and it deliberately returns
 * the approved organisation list but never the access code.
 *
 * <p><b>The kids freeze.</b> Promotion creates a new entry in a different
 * challenge, which means a child's work moving to a bigger stage under consent
 * that was given for a smaller one. A minor is promoted only with an approved
 * guardian decision <em>and</em> a granted consent record, the consent is
 * copied scope by scope onto the new entry, and the new entry is created
 * pending and only marked approved once that copy exists. Every refusal is
 * returned in {@code skipped} with its reason rather than passing silently.
 */
@RestController
public class PathwaysController {

  private static final Logger log = LoggerFactory.getLogger(PathwaysController.class);

  private static final Set<String> PATHWAY_TYPES = Set.of(
      "national_state_ranking", "state_to_national", "local_to_state_to_national",
      "series_championship", "private_organisation", "invitational");

  /** Pathway types that restrict who may enter. */
  private static final Set<String> GATED_TYPES = Set.of("private_organisation", "invitational");

  private static final Set<String> PATHWAY_STATUSES = Set.of("draft", "active", "archived");
  private static final Set<String> MEMBER_STATUSES = Set.of("active", "archived");

  /** Member kinds that contribute placings to a season standing. */
  private static final Set<String> SCORING_MEMBER_KINDS =
      Set.of("series_event", "qualifier", "anchor");

  /** Divisions that cannot be promoted without guardian consent. */
  private static final Set<String> KIDS_DIVISIONS = Set.of("children", "teens");

  private static final List<Double> DEFAULT_POINTS_SCALE =
      List.of(10d, 8d, 6d, 5d, 4d, 3d, 2d, 1d);

  private static final int MAX_PROMOTION_COUNT = 20;

  private final PathwayQueryRepository pathways;
  private final PathwayMemberQueryRepository members;
  private final PromotionQueryRepository promotions;
  private final SeriesStandingQueryRepository standings;
  private final CombinedResultQueryRepository results;
  private final JudgingPanelQueryRepository panels;
  private final GuardianConsentQueryRepository consents;
  private final EntryQueryRepository entries;
  private final ChallengeApiClient upstream;
  private final CallerResolver caller;
  private final JsonColumn json;
  private final ObjectMapper mapper;

  public PathwaysController(
      PathwayQueryRepository pathways,
      PathwayMemberQueryRepository members,
      PromotionQueryRepository promotions,
      SeriesStandingQueryRepository standings,
      CombinedResultQueryRepository results,
      JudgingPanelQueryRepository panels,
      GuardianConsentQueryRepository consents,
      EntryQueryRepository entries,
      ChallengeApiClient upstream,
      CallerResolver caller,
      JsonColumn json,
      ObjectMapper mapper) {
    this.pathways = pathways;
    this.members = members;
    this.promotions = promotions;
    this.standings = standings;
    this.results = results;
    this.panels = panels;
    this.consents = consents;
    this.entries = entries;
    this.upstream = upstream;
    this.caller = caller;
    this.json = json;
    this.mapper = mapper;
  }

  @PostMapping("/api/apps/{appId}/functions/pathways")
  public ResponseEntity<?> handle(@RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> request = body == null ? Map.of() : body;
    String action = str(request.get("action"));
    if (action == null) {
      return ResponseEntity.status(400).body(Map.of("error", "Missing action"));
    }
    String sessionToken = str(request.get("session_token"));
    String email = caller.email(sessionToken);
    boolean isAdmin = email != null && caller.isAdmin(sessionToken);

    try {
      return switch (action) {
        // Public: the submit form asks what it needs to collect before the
        // visitor has signed in.
        case "public_config" -> publicConfig(request);

        case "entry_check" -> email == null
            ? ResponseEntity.status(401).body(Map.of("error", "Unauthorized"))
            : entryCheck(request, email);

        case "list" -> admin(isAdmin, this::list);
        case "save_pathway" -> admin(isAdmin, () -> savePathway(request));
        case "delete_pathway" -> admin(isAdmin, () -> deletePathway(request));
        case "save_member" -> admin(isAdmin, () -> saveMember(request));
        case "remove_member" -> admin(isAdmin, () -> removeMember(request));
        case "compute_standings" -> admin(isAdmin, () -> computeStandings(request));
        case "promote_winners" -> admin(isAdmin, () -> promoteWinners(request));

        default -> ResponseEntity.status(400).body(Map.of("error", "Unknown action"));
      };
    } catch (Exception e) {
      log.error("pathways action '{}' failed", action, e);
      return ResponseEntity.status(500).body(Map.of(
          "error", e.getMessage() == null ? "Server error" : e.getMessage()));
    }
  }

  private ResponseEntity<?> admin(boolean isAdmin, Supplier<ResponseEntity<?>> handler) {
    return isAdmin ? handler.get() : ResponseEntity.status(403).body(Map.of("error", "Admin only"));
  }

  // ------------------------------------------------------------ management

  private ResponseEntity<?> list() {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("pathways", pathways.findAllNewestFirst().stream().map(this::pathwayJson).toList());
    out.put("members", members.findAllNewestFirst().stream().map(this::memberJson).toList());
    return ResponseEntity.ok(out);
  }

  private ResponseEntity<?> savePathway(Map<String, Object> request) {
    if (!(request.get("pathway") instanceof Map<?, ?> supplied)) {
      return ResponseEntity.status(400).body(Map.of("error", "Invalid pathway"));
    }
    Map<String, Object> p = castMap(supplied);
    String name = str(p.get("name"));
    String type = str(p.get("type"));
    if (name == null || type == null || !PATHWAY_TYPES.contains(type)) {
      return ResponseEntity.status(400).body(Map.of("error", "Invalid pathway"));
    }

    Instant now = Instant.now();
    String id = str(p.get("id"));
    PathwayEntity pathway = id == null ? null : pathways.findById(id).orElse(null);
    if (pathway == null) {
      pathway = new PathwayEntity();
      pathway.setId(newId());
      pathway.setCreatedDate(now);
      pathway.setIsSample(false);
    }

    pathway.setName(clip(name, 120));
    pathway.setType(type);
    pathway.setDescription(clip(orEmpty(str(p.get("description"))), 1000));
    pathway.setSeasonLabel(clip(orEmpty(str(p.get("season_label"))), 80));
    pathway.setAnchorChallengeId(orEmpty(str(p.get("anchor_challenge_id"))));
    pathway.setAccessCode(clip(orEmpty(str(p.get("access_code"))), 60));
    pathway.setApprovedOrganisations(write(stringList(p.get("approved_organisations")).stream()
        .map(o -> clip(o, 120)).toList()));
    pathway.setInvitedEmails(write(stringList(p.get("invited_emails")).stream()
        .map(PathwaysController::normaliseEmail)
        .filter(e -> !e.isEmpty())
        .toList()));
    // An empty scale would score every placing zero, so the default stands in.
    List<Double> scale = numberList(p.get("points_scale"));
    pathway.setPointsScale(write(scale.isEmpty() ? DEFAULT_POINTS_SCALE : scale));
    pathway.setPromotionCount(clamp(number(p.get("promotion_count")), 1, MAX_PROMOTION_COUNT, 3));
    pathway.setStatus(PATHWAY_STATUSES.contains(str(p.get("status")))
        ? str(p.get("status")) : "draft");
    pathway.setUpdatedDate(now);
    pathways.save(pathway);

    return ResponseEntity.ok(Map.of("pathway", pathwayJson(pathway)));
  }

  private ResponseEntity<?> deletePathway(Map<String, Object> request) {
    String pathwayId = str(request.get("pathway_id"));
    if (pathwayId == null) {
      return ResponseEntity.status(400).body(Map.of("error", "Missing pathway_id"));
    }
    // Members, promotions and standings all reference the pathway and mean
    // nothing without it; leaving them behind would show orphan standings.
    members.deleteAll(members.findByPathway(pathwayId));
    promotions.deleteAll(promotions.findByPathway(pathwayId));
    standings.deleteAll(standings.findByPathway(pathwayId));
    pathways.findById(pathwayId).ifPresent(pathways::delete);
    return ResponseEntity.ok(Map.of("ok", true));
  }

  private ResponseEntity<?> saveMember(Map<String, Object> request) {
    if (!(request.get("member") instanceof Map<?, ?> supplied)) {
      return ResponseEntity.status(400).body(Map.of("error", "Invalid member"));
    }
    Map<String, Object> m = castMap(supplied);
    String pathwayId = str(m.get("pathway_id"));
    String challengeId = str(m.get("challenge_id"));
    String memberKind = str(m.get("member_kind"));
    if (pathwayId == null || challengeId == null || memberKind == null) {
      return ResponseEntity.status(400).body(Map.of("error", "Invalid member"));
    }

    Instant now = Instant.now();
    String id = str(m.get("id"));
    PathwayMemberEntity member = id == null ? null : members.findById(id).orElse(null);
    if (member == null) {
      member = new PathwayMemberEntity();
      member.setId(newId());
      member.setCreatedDate(now);
      member.setIsSample(false);
    }

    member.setPathwayId(pathwayId);
    member.setChallengeId(challengeId);
    member.setChallengeTitle(clip(orEmpty(str(m.get("challenge_title"))), 160));
    member.setMemberKind(memberKind);
    member.setRegion(clip(orEmpty(str(m.get("region"))), 80));
    double tier = number(m.get("tier"));
    member.setTier(tier > 0 ? tier : 1);
    member.setPromotionToChallengeId(orEmpty(str(m.get("promotion_to_challenge_id"))));
    // Zero means "no override", so the floor is 0 rather than 1 here.
    member.setPromotionCountOverride(
        clamp(number(m.get("promotion_count_override")), 0, MAX_PROMOTION_COUNT, 0));
    member.setStatus(MEMBER_STATUSES.contains(str(m.get("status")))
        ? str(m.get("status")) : "active");
    member.setUpdatedDate(now);
    members.save(member);

    return ResponseEntity.ok(Map.of("member", memberJson(member)));
  }

  private ResponseEntity<?> removeMember(Map<String, Object> request) {
    String memberId = str(request.get("member_id"));
    if (memberId != null) {
      members.findById(memberId).ifPresent(members::delete);
    }
    return ResponseEntity.ok(Map.of("ok", true));
  }

  // ---------------------------------------------------------------- gating

  /** Every live pathway a challenge belongs to, by membership or as its anchor. */
  private List<PathwayEntity> pathwaysFor(String challengeId) {
    Set<String> ids = new LinkedHashSet<>();
    for (PathwayMemberEntity m : members.findActiveByChallenge(challengeId)) {
      ids.add(m.getPathwayId());
    }
    List<PathwayEntity> all = pathways.findAllNewestFirst();
    for (PathwayEntity p : all) {
      if (challengeId.equals(p.getAnchorChallengeId()) && !"archived".equals(p.getStatus())) {
        ids.add(p.getId());
        break;
      }
    }
    return all.stream()
        .filter(p -> ids.contains(p.getId()) && !"archived".equals(p.getStatus()))
        .toList();
  }

  private ResponseEntity<?> publicConfig(Map<String, Object> request) {
    String challengeId = str(request.get("challenge_id"));
    if (challengeId == null) {
      return ResponseEntity.ok(Map.of("gated", false));
    }
    List<PathwayEntity> live = pathwaysFor(challengeId);
    if (live.isEmpty()) {
      return ResponseEntity.ok(Map.of("gated", false));
    }

    Optional<PathwayEntity> gated = live.stream()
        .filter(p -> GATED_TYPES.contains(p.getType()))
        .findFirst();
    if (gated.isEmpty()) {
      Map<String, Object> out = new LinkedHashMap<>();
      out.put("gated", false);
      out.put("pathway_type", live.get(0).getType());
      return ResponseEntity.ok(out);
    }

    PathwayEntity pathway = gated.get();
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("gated", true);
    out.put("pathway_id", pathway.getId());
    out.put("pathway_type", pathway.getType());
    out.put("pathway_name", pathway.getName());
    out.put("requires_org", "private_organisation".equals(pathway.getType()));
    // Whether a code is needed, never the code itself — this endpoint is
    // public, and the code is the thing it protects.
    out.put("requires_code", notBlank(pathway.getAccessCode()));
    out.put("approved_organisations", "private_organisation".equals(pathway.getType())
        ? json.stringList(pathway.getApprovedOrganisations()) : List.of());
    return ResponseEntity.ok(out);
  }

  private ResponseEntity<?> entryCheck(Map<String, Object> request, String callerEmail) {
    String challengeId = str(request.get("challenge_id"));
    if (challengeId == null) {
      return ResponseEntity.ok(Map.of("allowed", true));
    }
    Optional<PathwayEntity> found = pathwaysFor(challengeId).stream()
        .filter(p -> GATED_TYPES.contains(p.getType()))
        .findFirst();
    if (found.isEmpty()) {
      return ResponseEntity.ok(Map.of("allowed", true));
    }
    PathwayEntity pathway = found.get();
    String accessCode = orEmpty(str(request.get("access_code")));
    boolean codeMatches = notBlank(pathway.getAccessCode())
        && !accessCode.isEmpty()
        && accessCode.equals(pathway.getAccessCode());

    if ("invitational".equals(pathway.getType())) {
      // Falls back to the session's own address, so someone cannot claim an
      // invited address that is not theirs by typing it into the form.
      String email = normaliseEmail(strOr(request.get("email"), callerEmail));
      List<String> invited = json.stringList(pathway.getInvitedEmails()).stream()
          .map(PathwaysController::normaliseEmail)
          .toList();
      if (invited.contains(email) || codeMatches) {
        return ResponseEntity.ok(Map.of("allowed", true, "pathway_id", pathway.getId()));
      }
      return ResponseEntity.ok(Map.of("allowed", false, "reason",
          "This is an invitation-only challenge. Your email isn't on the invite list."));
    }

    if ("private_organisation".equals(pathway.getType())) {
      String organisation = orEmpty(str(request.get("organisation")))
          .toLowerCase(Locale.ROOT).trim();
      List<String> approved = json.stringList(pathway.getApprovedOrganisations()).stream()
          .map(o -> o.toLowerCase(Locale.ROOT).trim())
          .toList();
      if ((!organisation.isEmpty() && approved.contains(organisation)) || codeMatches) {
        return ResponseEntity.ok(Map.of("allowed", true, "pathway_id", pathway.getId()));
      }
      return ResponseEntity.ok(Map.of("allowed", false, "reason",
          "Entry is restricted to approved organisations. "
              + "Check the organisation name or access code."));
    }

    return ResponseEntity.ok(Map.of("allowed", true));
  }

  // ------------------------------------------------------------- standings

  /**
   * Recomputes a season's standings from the locked results of its events.
   *
   * <p>Points come from the pathway's own scale, indexed by placing. Rebuilt
   * from scratch every time rather than adjusted, so a corrected result in one
   * event cannot leave stale points behind in the table.
   */
  private ResponseEntity<?> computeStandings(Map<String, Object> request) {
    String pathwayId = str(request.get("pathway_id"));
    if (pathwayId == null) {
      return ResponseEntity.status(400).body(Map.of("error", "Missing pathway_id"));
    }
    Optional<PathwayEntity> found = pathways.findById(pathwayId);
    if (found.isEmpty()) {
      return ResponseEntity.status(404).body(Map.of("error", "Pathway not found"));
    }
    PathwayEntity pathway = found.get();

    List<Double> scale = numberList(json.nodes(pathway.getPointsScale()));
    if (scale.isEmpty()) {
      scale = DEFAULT_POINTS_SCALE;
    }

    Map<String, Standing> aggregated = new LinkedHashMap<>();
    for (PathwayMemberEntity member : members.findActiveByPathway(pathwayId)) {
      if (!SCORING_MEMBER_KINDS.contains(member.getMemberKind())) {
        continue;
      }
      for (CombinedResultEntity result : results.findRanked(member.getChallengeId())) {
        int placing = result.getCombinedRank() == null ? 0 : result.getCombinedRank().intValue();
        if (placing < 1) {
          continue;
        }
        // Placings beyond the scale score nothing, which is what makes a short
        // scale mean "only the top few earn points".
        double points = placing <= scale.size() ? scale.get(placing - 1) : 0;
        if (points <= 0) {
          continue;
        }
        String key = firstNonBlank(result.getCreatorName(),
            firstNonBlank(result.getEntryTitle(), result.getEntryId()));

        Standing standing = aggregated.computeIfAbsent(key,
            k -> new Standing(orEmpty(result.getCreatorName()), placing));
        standing.totalPoints += points;
        standing.eventsCounted++;
        standing.bestPlacing = Math.min(standing.bestPlacing, placing);
        Map<String, Object> line = new LinkedHashMap<>();
        line.put("challenge_id", member.getChallengeId());
        line.put("challenge_title", orEmpty(member.getChallengeTitle()));
        line.put("placing", placing);
        line.put("points", points);
        standing.breakdown.add(line);
      }
    }

    List<Standing> ranked = new ArrayList<>(aggregated.values());
    // Most points wins; a tie goes to whoever placed higher at any single
    // event, which is the sporting convention.
    ranked.sort(Comparator.comparingDouble((Standing s) -> s.totalPoints).reversed()
        .thenComparingInt(s -> s.bestPlacing));

    Instant now = Instant.now();
    standings.deleteAll(standings.findByPathway(pathwayId));

    List<SeriesStandingEntity> saved = new ArrayList<>();
    for (int i = 0; i < ranked.size(); i++) {
      Standing s = ranked.get(i);
      SeriesStandingEntity row = new SeriesStandingEntity();
      row.setId(newId());
      row.setPathwayId(pathwayId);
      row.setCreatorName(s.creatorName);
      row.setCreatorEmail("");
      row.setState("");
      row.setTotalPoints(s.totalPoints);
      row.setEventsCounted((double) s.eventsCounted);
      row.setBestPlacing((double) s.bestPlacing);
      row.setRank((double) (i + 1));
      row.setBreakdown(write(s.breakdown));
      row.setComputedAt(now);
      row.setCreatedDate(now);
      row.setUpdatedDate(now);
      row.setIsSample(false);
      saved.add(row);
    }
    if (!saved.isEmpty()) {
      standings.saveAll(saved);
    }

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("standings", saved.stream().map(this::standingJson).toList());
    out.put("champion", ranked.isEmpty() ? null : Map.of(
        "rank", 1,
        "creator_name", ranked.get(0).creatorName,
        "total_points", ranked.get(0).totalPoints));
    return ResponseEntity.ok(out);
  }

  /** One competitor's running total across a season. */
  private static final class Standing {
    private final String creatorName;
    private double totalPoints;
    private int eventsCounted;
    private int bestPlacing;
    private final List<Map<String, Object>> breakdown = new ArrayList<>();

    private Standing(String creatorName, int bestPlacing) {
      this.creatorName = creatorName;
      this.bestPlacing = bestPlacing;
    }
  }

  // ------------------------------------------------------------ promotion

  /** One entry being considered for promotion, from whichever source had it. */
  private record SourceEntry(
      String entryId,
      String title,
      String creatorName,
      String state,
      String city,
      String division,
      String workType,
      String workText,
      String workLink,
      String category,
      boolean isMinor,
      String guardianApprovalStatus,
      int placing) {}

  private ResponseEntity<?> promoteWinners(Map<String, Object> request) {
    String fromChallengeId = str(request.get("from_challenge_id"));
    if (fromChallengeId == null) {
      return ResponseEntity.status(400).body(Map.of("error", "Missing from_challenge_id"));
    }
    Optional<PathwayMemberEntity> found = members.findActiveByChallenge(fromChallengeId).stream()
        .filter(m -> notBlank(m.getPromotionToChallengeId()))
        .findFirst();
    if (found.isEmpty()) {
      return ResponseEntity.status(400).body(Map.of(
          "error", "This challenge isn't a qualifier with a promotion target."));
    }
    PathwayMemberEntity member = found.get();
    Optional<PathwayEntity> pathway = pathways.findById(member.getPathwayId());
    if (pathway.isEmpty()) {
      return ResponseEntity.status(404).body(Map.of("error", "Pathway not found"));
    }

    double override = member.getPromotionCountOverride() == null
        ? 0 : member.getPromotionCountOverride();
    double fallback = pathway.get().getPromotionCount() == null
        ? 3 : pathway.get().getPromotionCount();
    int promoteN = (int) (override > 0 ? override : fallback);

    List<SourceEntry> sources = rankSources(fromChallengeId);
    String targetId = member.getPromotionToChallengeId();
    Instant now = Instant.now();

    List<Map<String, Object>> promoted = new ArrayList<>();
    List<Map<String, Object>> skipped = new ArrayList<>();

    for (SourceEntry source : sources) {
      if (promoted.size() >= promoteN) {
        break;
      }
      boolean isKids = source.isMinor()
          || KIDS_DIVISIONS.contains(source.division().toLowerCase(Locale.ROOT).trim());

      if (isKids && !"approved".equals(source.guardianApprovalStatus())) {
        skipped.add(skip(source, "guardian_approval_status is '"
            + (source.guardianApprovalStatus().isEmpty()
                ? "empty" : source.guardianApprovalStatus())
            + "' — kids/teens cannot promote without approved guardian consent."));
        continue;
      }

      GuardianConsentEntity sourceConsent = null;
      if (isKids) {
        sourceConsent = consents.findGrantedForEntry(source.entryId()).stream()
            .findFirst().orElse(null);
        if (sourceConsent == null) {
          skipped.add(skip(source,
              "no granted GuardianConsent on source entry — kids/teens cannot promote."));
          continue;
        }
      }

      List<PromotionEntity> existing =
          promotions.findForSourceEntry(fromChallengeId, source.entryId());
      if (!existing.isEmpty() && "promoted".equals(existing.get(0).getStatus())) {
        skipped.add(skip(source, "already promoted"));
        continue;
      }

      // The target may already hold an entry from a previous partial run.
      EntryEntity target = entries
          .findByChallengeAndUpstreamEntry(targetId, source.entryId())
          .stream().findFirst().orElse(null);

      if (target != null) {
        String refusal = reuseRefusal(target);
        if (refusal != null) {
          skipped.add(skip(source, refusal));
          continue;
        }
      } else {
        target = createTargetEntry(source, member, targetId, isKids, now);
        if (isKids) {
          copyConsent(sourceConsent, target, targetId, now);
          // Only now is the new entry approved: the consent covering *this*
          // entry id exists, so the approval is not a claim about a different
          // entry in a different challenge.
          target.setGuardianApprovalStatus("approved");
          target.setConsentStatus("valid");
          target.setUpdatedDate(now);
          entries.save(target);
        }
      }

      recordPromotion(existing, member, fromChallengeId, targetId, source, target, now);

      Map<String, Object> row = new LinkedHashMap<>();
      row.put("source_entry_id", source.entryId());
      row.put("promoted_entry_id", target.getId());
      row.put("placing", source.placing());
      row.put("creator_name", source.creatorName());
      promoted.add(row);
    }

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("promoted", promoted);
    out.put("skipped", skipped);
    out.put("promote_n", promoteN);
    return ResponseEntity.ok(out);
  }

  /**
   * Why an existing target entry cannot be reused, or null when it can.
   *
   * <p>Reusing an entry created by an earlier run is what makes this safe to
   * re-run, but a kids entry sitting there without approval and its own
   * granted consent must not be adopted — that would launder a pending entry
   * into a promoted one.
   */
  private String reuseRefusal(EntryEntity target) {
    boolean kids = Boolean.TRUE.equals(target.getIsMinor())
        || KIDS_DIVISIONS.contains(orEmpty(target.getDivision()).toLowerCase(Locale.ROOT).trim());
    if (!kids) {
      return null;
    }
    if (!"approved".equals(orEmpty(target.getGuardianApprovalStatus()))) {
      return "target entry exists but guardian_approval_status is not approved — "
          + "kids/teens cannot promote.";
    }
    if (consents.findGrantedForEntry(target.getId()).isEmpty()) {
      return "target entry missing granted GuardianConsent for entry_id — refuse reuse.";
    }
    return null;
  }

  private EntryEntity createTargetEntry(
      SourceEntry source,
      PathwayMemberEntity member,
      String targetId,
      boolean isKids,
      Instant now) {

    EntryEntity entry = new EntryEntity();
    entry.setId(newId());
    entry.setChallengeId(targetId);
    entry.setTitle(source.title());
    entry.setDescription("");
    entry.setCreatorName(source.creatorName());
    entry.setCreatorEmailMasked("");
    entry.setState(source.state());
    entry.setCity(source.city());
    entry.setDivision(source.division());
    entry.setWorkType(source.workType());
    entry.setWorkText(source.workText());
    entry.setWorkLink(source.workLink());
    entry.setStatus("approved");
    entry.setIsMinor(source.isMinor());
    // Fail closed: a kids entry is created pending and stays that way unless
    // the consent copy below succeeds.
    entry.setGuardianApprovalStatus(isKids ? "pending" : "not_required");
    entry.setConsentStatus(isKids ? "pending_consent" : "valid");
    entry.setUpstreamEntryId(source.entryId());
    entry.setCategory(source.category());
    entry.setChallengeTitle(orEmpty(member.getChallengeTitle()));
    entry.setCreatedDate(now);
    entry.setUpdatedDate(now);
    entry.setIsSample(false);
    entries.save(entry);
    return entry;
  }

  /**
   * Copies the guardian's consent onto the promoted entry, scope by scope.
   *
   * <p>Each scope is carried across exactly as granted. Consent to enter a
   * local heat is not consent to appear in a national final, so nothing is
   * widened here — and a scope the guardian withheld stays withheld.
   */
  private void copyConsent(
      GuardianConsentEntity source, EntryEntity target, String targetId, Instant now) {

    GuardianConsentEntity consent = new GuardianConsentEntity();
    consent.setId(newId());
    consent.setChallengeId(targetId);
    consent.setEntryId(target.getId());
    consent.setParticipantName(firstNonBlank(source.getParticipantName(),
        firstNonBlank(target.getCreatorName(), "participant")));
    consent.setParticipantEmail(orEmpty(source.getParticipantEmail()));
    consent.setRequirementId(firstNonBlank(source.getRequirementId(), "pathway_promote"));
    consent.setRequirementVersion(
        source.getRequirementVersion() == null ? 1 : source.getRequirementVersion());
    consent.setGuardianName(firstNonBlank(source.getGuardianName(), "guardian"));
    consent.setGuardianRelationship(orEmpty(source.getGuardianRelationship()));
    consent.setGuardianContact(orEmpty(source.getGuardianContact()));
    consent.setMethodUsed(firstNonBlank(source.getMethodUsed(), "guardian_account_countersign"));
    consent.setVerifiedAt(source.getVerifiedAt() == null ? now : source.getVerifiedAt());
    consent.setStatus("granted");
    consent.setScopesEnteringChallenge(isTrue(source.getScopesEnteringChallenge()));
    consent.setScopesTermsAcceptance(isTrue(source.getScopesTermsAcceptance()));
    consent.setScopesPersonalInfoProcessing(isTrue(source.getScopesPersonalInfoProcessing()));
    consent.setScopesPublicDisplayName(isTrue(source.getScopesPublicDisplayName()));
    consent.setScopesPublicDisplayAgeBracket(isTrue(source.getScopesPublicDisplayAgeBracket()));
    consent.setScopesPublicationOfEntryMedia(isTrue(source.getScopesPublicationOfEntryMedia()));
    consent.setScopesPromotionalReuse(isTrue(source.getScopesPromotionalReuse()));
    consent.setScopesDirectCommunicationWithMinor(
        isTrue(source.getScopesDirectCommunicationWithMinor()));
    consent.setScopesPublicVotingParticipation(isTrue(source.getScopesPublicVotingParticipation()));
    consent.setScopesPrizeAcceptancePayment(isTrue(source.getScopesPrizeAcceptancePayment()));
    consent.setScopesEventTravelAttendance(isTrue(source.getScopesEventTravelAttendance()));
    consent.setScopesAppearsInEntry(isTrue(source.getScopesAppearsInEntry()));
    consent.setConsentWordingHash(orEmpty(source.getConsentWordingHash()));
    consent.setCreatedDate(now);
    consent.setUpdatedDate(now);
    consent.setIsSample(false);
    consents.save(consent);
  }

  private void recordPromotion(
      List<PromotionEntity> existing,
      PathwayMemberEntity member,
      String fromChallengeId,
      String targetId,
      SourceEntry source,
      EntryEntity target,
      Instant now) {

    PromotionEntity promotion = existing.isEmpty() ? null : existing.get(0);
    if (promotion == null) {
      promotion = new PromotionEntity();
      promotion.setId(newId());
      promotion.setPathwayId(member.getPathwayId());
      promotion.setFromChallengeId(fromChallengeId);
      promotion.setToChallengeId(targetId);
      promotion.setSourceEntryId(source.entryId());
      promotion.setCreatedDate(now);
      promotion.setIsSample(false);
    }
    promotion.setPromotedEntryId(target.getId());
    promotion.setCreatorName(source.creatorName());
    promotion.setRegion(source.state());
    promotion.setPlacing((double) source.placing());
    promotion.setPromotedAt(now);
    promotion.setStatus("promoted");
    promotion.setUpdatedDate(now);
    promotions.save(promotion);
  }

  /**
   * The source challenge's entries in finishing order.
   *
   * <p>Locked combined results are preferred, because those are the judged
   * placings. With none recorded, it falls back to the upstream vote order —
   * which is how a qualifier decided purely by public voting still promotes.
   */
  private List<SourceEntry> rankSources(String fromChallengeId) {
    List<CombinedResultEntity> ranked = results.findRanked(fromChallengeId);
    List<JsonNode> upstreamEntries = upstream.entries(fromChallengeId, 500);

    if (ranked.isEmpty()) {
      List<SourceEntry> out = new ArrayList<>();
      for (int i = 0; i < upstreamEntries.size(); i++) {
        out.add(fromUpstream(upstreamEntries.get(i), null, i + 1));
      }
      return out;
    }

    Map<String, JsonNode> upstreamById = new LinkedHashMap<>();
    for (JsonNode e : upstreamEntries) {
      upstreamById.putIfAbsent(e.path("id").asText(""), e);
    }

    List<SourceEntry> out = new ArrayList<>();
    for (CombinedResultEntity result : ranked) {
      String entryId = orEmpty(result.getEntryId());
      // A native entry may hold the guardian gate when the source challenge
      // ran on this platform rather than upstream.
      EntryEntity local = entries.findById(entryId).orElse(null);
      JsonNode remote = upstreamById.get(entryId);

      int placing = result.getCombinedRank() == null ? 0 : result.getCombinedRank().intValue();
      SourceEntry base = fromUpstream(remote, local, placing);
      out.add(new SourceEntry(entryId,
          firstNonBlank(result.getEntryTitle(), base.title()),
          firstNonBlank(result.getCreatorName(), base.creatorName()),
          base.state(), base.city(), base.division(), base.workType(), base.workText(),
          base.workLink(), base.category(), base.isMinor(), base.guardianApprovalStatus(),
          placing));
    }
    return out;
  }

  /** Merges an upstream entry with its local twin, preferring the upstream copy. */
  private SourceEntry fromUpstream(JsonNode remote, EntryEntity local, int placing) {
    String entryId = remote != null ? remote.path("id").asText("")
        : (local == null ? "" : orEmpty(local.getId()));
    String workType = firstNonBlank(text(remote, "work_type"),
        local == null ? "" : orEmpty(local.getWorkType()));

    // The guardian status is read from the local record first: it is the one
    // this platform maintains, and the upstream copy can be stale.
    String guardianStatus = local != null && notBlank(local.getGuardianApprovalStatus())
        ? local.getGuardianApprovalStatus()
        : orEmpty(text(remote, "guardian_approval_status"));

    boolean isMinor = remote != null && remote.has("is_minor")
        ? remote.path("is_minor").asBoolean(false)
        : (local != null && Boolean.TRUE.equals(local.getIsMinor()));

    return new SourceEntry(entryId,
        pick(remote, local, "title", EntryEntity::getTitle),
        pick(remote, local, "creator_name", EntryEntity::getCreatorName),
        pick(remote, local, "state", EntryEntity::getState),
        pick(remote, local, "city", EntryEntity::getCity),
        firstNonBlank(pick(remote, local, "division", EntryEntity::getDivision), "adults"),
        "link".equals(workType) ? "link" : "text",
        firstNonBlank(firstNonBlank(text(remote, "work_text"), text(remote, "description")),
            local == null ? "" : orEmpty(local.getWorkText())),
        firstNonBlank(firstNonBlank(text(remote, "work_link"), text(remote, "work_url")),
            local == null ? "" : orEmpty(local.getWorkLink())),
        pick(remote, local, "category", EntryEntity::getCategory),
        isMinor,
        orEmpty(guardianStatus),
        placing);
  }

  private static String pick(
      JsonNode remote,
      EntryEntity local,
      String field,
      java.util.function.Function<EntryEntity, String> getter) {

    String value = text(remote, field);
    if (notBlank(value)) {
      return value;
    }
    return local == null ? "" : orEmpty(getter.apply(local));
  }

  private static Map<String, Object> skip(SourceEntry source, String reason) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("entry_id", source.entryId());
    out.put("reason", reason);
    return out;
  }

  // -------------------------------------------------------------- shapes

  private Map<String, Object> pathwayJson(PathwayEntity p) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", p.getId());
    out.put("name", p.getName());
    out.put("type", p.getType());
    out.put("description", p.getDescription());
    out.put("season_label", p.getSeasonLabel());
    out.put("anchor_challenge_id", p.getAnchorChallengeId());
    out.put("access_code", p.getAccessCode());
    out.put("approved_organisations", json.stringList(p.getApprovedOrganisations()));
    out.put("invited_emails", json.stringList(p.getInvitedEmails()));
    out.put("points_scale", numberList(json.nodes(p.getPointsScale())));
    out.put("promotion_count", p.getPromotionCount());
    out.put("status", p.getStatus());
    out.put("created_date", iso(p.getCreatedDate()));
    return out;
  }

  private Map<String, Object> memberJson(PathwayMemberEntity m) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", m.getId());
    out.put("pathway_id", m.getPathwayId());
    out.put("challenge_id", m.getChallengeId());
    out.put("challenge_title", m.getChallengeTitle());
    out.put("member_kind", m.getMemberKind());
    out.put("region", m.getRegion());
    out.put("tier", m.getTier());
    out.put("promotion_to_challenge_id", m.getPromotionToChallengeId());
    out.put("promotion_count_override", m.getPromotionCountOverride());
    out.put("status", m.getStatus());
    out.put("created_date", iso(m.getCreatedDate()));
    return out;
  }

  private Map<String, Object> standingJson(SeriesStandingEntity s) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", s.getId());
    out.put("pathway_id", s.getPathwayId());
    out.put("creator_name", s.getCreatorName());
    out.put("creator_email", s.getCreatorEmail());
    out.put("state", s.getState());
    out.put("total_points", s.getTotalPoints());
    out.put("events_counted", s.getEventsCounted());
    out.put("best_placing", s.getBestPlacing());
    out.put("rank", s.getRank());
    out.put("breakdown", node(s.getBreakdown()));
    out.put("computed_at", iso(s.getComputedAt()));
    return out;
  }

  // ------------------------------------------------------------- helpers

  private JsonNode node(String raw) {
    if (raw == null || raw.isBlank()) {
      return mapper.createArrayNode();
    }
    try {
      return mapper.readTree(raw);
    } catch (Exception e) {
      return mapper.createArrayNode();
    }
  }

  private String write(Object value) {
    try {
      return mapper.writeValueAsString(value);
    } catch (Exception e) {
      throw new IllegalStateException("Could not serialise a pathway column", e);
    }
  }

  private static List<Double> numberList(Object value) {
    List<Double> out = new ArrayList<>();
    if (value instanceof List<?> list) {
      for (Object item : list) {
        if (item instanceof JsonNode n) {
          out.add(n.asDouble(0));
        } else if (item != null) {
          try {
            out.add(Double.parseDouble(String.valueOf(item)));
          } catch (NumberFormatException e) {
            out.add(0d);
          }
        }
      }
    }
    return out;
  }

  private static List<String> stringList(Object value) {
    if (!(value instanceof List<?> list)) {
      return List.of();
    }
    return list.stream().map(String::valueOf).toList();
  }

  /** Clamps to a range, falling back when the value is absent or zero. */
  private static double clamp(double value, double min, double max, double fallback) {
    double resolved = value == 0 ? fallback : value;
    return Math.max(min, Math.min(max, resolved));
  }

  private static double number(Object value) {
    if (value instanceof Number n) {
      return n.doubleValue();
    }
    try {
      return value == null ? 0 : Double.parseDouble(String.valueOf(value));
    } catch (NumberFormatException e) {
      return 0;
    }
  }

  private static String normaliseEmail(String value) {
    return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
  }

  private static String text(JsonNode node, String field) {
    if (node == null) {
      return "";
    }
    JsonNode value = node.get(field);
    return value == null || value.isNull() ? "" : value.asText("");
  }

  private static String clip(String value, int max) {
    String text = orEmpty(value);
    return text.length() <= max ? text : text.substring(0, max);
  }

  private static boolean isTrue(Boolean value) {
    return Boolean.TRUE.equals(value);
  }

  private static String firstNonBlank(String a, String b) {
    return notBlank(a) ? a : orEmpty(b);
  }

  private static boolean notBlank(String value) {
    return value != null && !value.isBlank();
  }

  private static String iso(Instant value) {
    return value == null ? null : value.toString();
  }

  private static String strOr(Object value, String fallback) {
    String text = str(value);
    return text == null ? fallback : text;
  }

  private static String orEmpty(String value) {
    return value == null ? "" : value;
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> castMap(Map<?, ?> supplied) {
    return (Map<String, Object>) supplied;
  }

  private static String str(Object value) {
    if (value == null) {
      return null;
    }
    String text = String.valueOf(value).trim();
    return text.isEmpty() ? null : text;
  }

  private static String newId() {
    return UUID.randomUUID().toString().replace("-", "").substring(0, 24);
  }
}
