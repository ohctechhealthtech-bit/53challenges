package com.fiftythree.challenges.marketing;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fiftythree.challenges.engine.EntryQueryRepository;
import com.fiftythree.challenges.entity.AudienceMemberEntity;
import com.fiftythree.challenges.entity.CategoryRepository;
import com.fiftythree.challenges.entity.EmailCampaignEntity;
import com.fiftythree.challenges.entity.OrganisationEntity;
import com.fiftythree.challenges.entity.PartnerInquiryEntity;
import com.fiftythree.challenges.entity.PartnerInquiryRepository;
import com.fiftythree.challenges.entity.SponsorProfileEntity;
import com.fiftythree.challenges.llm.LlmClient;
import com.fiftythree.challenges.mail.MailService;
import com.fiftythree.challenges.security.CallerResolver;
import com.fiftythree.challenges.support.JsonColumn;
import com.fiftythree.challenges.user.UserRepository;
import com.fiftythree.challenges.support.ApiErrors;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Limit;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * The Java replacement for {@code marketingHub}: audience, campaigns,
 * organisations, sponsors and the partnership pipeline.
 *
 * <p>Three tiers of access, and the middle one matters. Anyone signed in may
 * add themselves to the audience or apply as a sponsor. <b>Admins only</b> may
 * read audience data, send campaigns, or use the AI tools — and note that
 * {@code creator} is <em>not</em> admin here. It is a participant-facing role,
 * and letting it reach the audience list would hand every creator the platform's
 * mailing list.
 *
 * <p>Two actions are not available and say so rather than producing something
 * wrong. {@code generateShareCard} needs image generation. {@code aiFindPartners}
 * needs live web search: its whole purpose is finding <em>real</em> organisations
 * with <em>published</em> contact details, and its own prompt says never to
 * invent one. A model without web access would produce plausible, fabricated
 * businesses and email addresses that someone on the team would then write to.
 * Refusing is the only honest behaviour.
 */
@RestController
public class MarketingHubController {

  private static final Logger log = LoggerFactory.getLogger(MarketingHubController.class);

  private static final int AUDIENCE_LIMIT = 10000;
  private static final int CAMPAIGN_LIMIT = 500;
  private static final int LIST_LIMIT = 200;

  private static final SecureRandom RANDOM = new SecureRandom();

  /** Admin-only. 'creator' is deliberately absent — it is a participant role. */
  private static final Set<String> ADMIN_ACTIONS = Set.of(
      "listAudience", "createCampaign", "sendCampaign", "createOrganisation",
      "listOrganisations", "organisationLeaderboard", "unsubscribe", "listSponsors",
      "saveSponsor", "deleteSponsor", "listCampaigns", "listPipeline",
      "updatePipelineStatus", "generateShareCard", "dashboardSummary",
      "listCanonicalCategories", "aiFindPartners", "aiGenerateInvite",
      "savePartnerProspect", "aiGrowthInsights", "aiCampaignCopy", "aiFollowUpDraft");

  private static final Set<String> PROSPECT_KINDS =
      Set.of("sponsor", "council", "school", "workplace", "other");

  private final LlmClient llm;
  private final MailService mail;
  private final AudienceQueryRepository audience;
  private final CampaignQueryRepository campaigns;
  private final OrganisationQueryRepository organisations;
  private final SponsorQueryRepository sponsors;
  private final PartnerInquiryRepository inquiries;
  private final EntryQueryRepository entries;
  private final CategoryRepository categories;
  private final UserRepository users;
  private final CallerResolver caller;
  private final JsonColumn json;
  private final ObjectMapper mapper;

  public MarketingHubController(
      LlmClient llm,
      MailService mail,
      AudienceQueryRepository audience,
      CampaignQueryRepository campaigns,
      OrganisationQueryRepository organisations,
      SponsorQueryRepository sponsors,
      PartnerInquiryRepository inquiries,
      EntryQueryRepository entries,
      CategoryRepository categories,
      UserRepository users,
      CallerResolver caller,
      JsonColumn json,
      ObjectMapper mapper) {
    this.llm = llm;
    this.mail = mail;
    this.audience = audience;
    this.campaigns = campaigns;
    this.organisations = organisations;
    this.sponsors = sponsors;
    this.inquiries = inquiries;
    this.entries = entries;
    this.categories = categories;
    this.users = users;
    this.caller = caller;
    this.json = json;
    this.mapper = mapper;
  }

  @PostMapping("/api/apps/{appId}/functions/marketingHub")
  public ResponseEntity<?> handle(@RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> p = body == null ? Map.of() : body;
    String sessionToken = str(p.get("session_token"));
    String email = caller.email(sessionToken);
    String action = orEmpty(str(p.get("action")));

    if (ADMIN_ACTIONS.contains(action)) {
      if (email == null) {
        return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
      }
      if (!caller.isAdmin(sessionToken)) {
        return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
      }
    }

    try {
      return switch (action) {
        case "addAudience" -> requireSignedIn(email, () -> addAudience(p));
        case "sendLifecycle" -> sendLifecycle(p, email, sessionToken);
        case "mySponsorProfile" -> requireSignedIn(email, () -> mySponsorProfile(email));
        case "applyAsSponsor" -> requireSignedIn(email, () -> applyAsSponsor(p, email));

        case "listAudience" -> listAudience(p);
        case "unsubscribe" -> unsubscribe(p);
        case "createCampaign" -> createCampaign(p, email);
        case "sendCampaign" -> sendCampaign(p);
        case "createOrganisation" -> createOrganisation(p);
        case "listOrganisations" -> ResponseEntity.ok(Map.of("organisations",
            organisations.findActive(Limit.of(LIST_LIMIT)).stream()
                .map(this::organisationJson).toList()));
        case "organisationLeaderboard" -> leaderboard(p);
        case "listSponsors" -> ResponseEntity.ok(Map.of("sponsors",
            sponsors.findAllNewestFirst(Limit.of(LIST_LIMIT)).stream()
                .map(this::sponsorJson).toList()));
        case "saveSponsor" -> saveSponsor(p);
        case "deleteSponsor" -> deleteSponsor(p);
        case "listCampaigns" -> ResponseEntity.ok(Map.of("campaigns",
            campaigns.findAllNewestFirst(Limit.of(LIST_LIMIT)).stream()
                .map(this::campaignJson).toList()));
        case "listPipeline" -> ResponseEntity.ok(Map.of("items",
            inquiries.findAll().stream().map(this::inquiryJson).toList()));
        case "updatePipelineStatus" -> updatePipelineStatus(p);
        case "listCanonicalCategories" -> listCategories();
        case "dashboardSummary" -> dashboardSummary();
        case "savePartnerProspect" -> savePartnerProspect(p);

        case "aiGenerateInvite" -> aiGenerateInvite(p);
        case "aiCampaignCopy" -> aiCampaignCopy(p);
        case "aiFollowUpDraft" -> aiFollowUpDraft(p);
        case "aiGrowthInsights" -> aiGrowthInsights();

        case "generateShareCard" -> unavailable(
            "Image generation is not available on this platform.");
        case "aiFindPartners" -> unavailable(
            "The partner finder needs live web search to identify real "
                + "organisations and published contact details, which is not "
                + "available on this platform. Without it the results would be "
                + "invented, so it is disabled rather than guessing.");

        default -> ResponseEntity.status(400).body(
            Map.of("error", "Unknown action: " + action));
      };
    } catch (LlmClient.LlmUnavailableException e) {
      return ResponseEntity.status(503).body(Map.of("error", e.getMessage()));
    } catch (Exception e) {
      log.error("marketingHub action '{}' failed", action, e);
      return ApiErrors.internal(e);
    }
  }

  private ResponseEntity<?> requireSignedIn(
      String email, java.util.function.Supplier<ResponseEntity<?>> handler) {
    return email == null
        ? ResponseEntity.status(401).body(Map.of("error", "Unauthorized"))
        : handler.get();
  }

  private static ResponseEntity<?> unavailable(String reason) {
    // 501: the request is valid and this deployment cannot do it. A 500 would
    // suggest a fault somebody could retry past.
    return ResponseEntity.status(501).body(Map.of("error", reason, "unavailable", true));
  }

  // ------------------------------------------------------------ audience

  private ResponseEntity<?> addAudience(Map<String, Object> p) {
    String email = orEmpty(str(p.get("email"))).toLowerCase(Locale.ROOT);
    if (email.isEmpty()) {
      return ResponseEntity.status(400).body(Map.of("error", "Email required"));
    }
    Instant now = Instant.now();
    Optional<AudienceMemberEntity> existing = audience.findByEmail(email).stream().findFirst();

    AudienceMemberEntity member;
    if (existing.isPresent()) {
      // Only the fields actually supplied are touched, so a later signup with
      // fewer details does not erase what an earlier one recorded.
      member = existing.get();
      if (str(p.get("name")) != null) {
        member.setName(str(p.get("name")));
      }
      if (str(p.get("audience_type")) != null) {
        member.setAudienceType(str(p.get("audience_type")));
      }
      if (str(p.get("state")) != null) {
        member.setState(str(p.get("state")));
      }
      if (p.get("categories") != null) {
        member.setCategoryInterests(write(stringList(p.get("categories"))));
      }
      if (str(p.get("source")) != null) {
        member.setSource(str(p.get("source")));
      }
      if (str(p.get("organisation_id")) != null) {
        member.setOrganisationId(str(p.get("organisation_id")));
        member.setOrganisationName(orEmpty(str(p.get("organisation_name"))));
      }
      if (p.get("participated_before") != null) {
        member.setParticipatedBefore(Boolean.TRUE.equals(p.get("participated_before")));
      }
      member.setUpdatedDate(now);
      audience.save(member);
    } else {
      member = new AudienceMemberEntity();
      member.setId(newId());
      member.setEmail(email);
      member.setName(orEmpty(str(p.get("name"))));
      member.setAudienceType(strOr(p.get("audience_type"), "creator"));
      member.setState(orEmpty(str(p.get("state"))));
      member.setCategoryInterests(write(stringList(p.get("categories"))));
      member.setSource(strOr(p.get("source"), "coming_soon"));
      member.setOrganisationId(orEmpty(str(p.get("organisation_id"))));
      member.setOrganisationName(orEmpty(str(p.get("organisation_name"))));
      member.setParticipatedBefore(Boolean.TRUE.equals(p.get("participated_before")));
      member.setCreatedDate(now);
      member.setUpdatedDate(now);
      member.setIsSample(false);
      audience.save(member);

      // A failed welcome must not lose the signup, so it is sent after the
      // record exists and its result only stamps welcomed_at.
      if (mail.send(email, "Welcome to 53 Challenges", welcomeBody(member.getName()))) {
        member.setWelcomedAt(now);
        audience.save(member);
      }
    }
    return ResponseEntity.ok(Map.of("member", memberJson(member)));
  }

  private ResponseEntity<?> listAudience(Map<String, Object> p) {
    List<AudienceMemberEntity> all = audience.findAllNewestFirst(Limit.of(AUDIENCE_LIMIT));
    List<AudienceMemberEntity> matching = all.stream()
        .filter(m -> matchesSegment(m, p))
        .toList();

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("members", matching.stream().map(this::memberJson).toList());
    out.put("count", matching.size());
    out.put("total", all.size());
    return ResponseEntity.ok(out);
  }

  private ResponseEntity<?> unsubscribe(Map<String, Object> p) {
    String email = orEmpty(str(p.get("email"))).toLowerCase(Locale.ROOT);
    for (AudienceMemberEntity member : audience.findByEmail(email)) {
      member.setStatus("unsubscribed");
      member.setUnsubscribedAt(Instant.now());
      member.setUpdatedDate(Instant.now());
      audience.save(member);
    }
    return ResponseEntity.ok(Map.of("ok", true));
  }

  /** Whether a member falls inside a campaign's segment. Empty means "all". */
  private boolean matchesSegment(AudienceMemberEntity m, Map<String, Object> segment) {
    List<String> types = stringList(segment.get("audience_types"));
    if (!types.isEmpty() && !types.contains(nz(m.getAudienceType()))) {
      return false;
    }
    List<String> states = stringList(segment.get("states"));
    if (!states.isEmpty() && !states.contains(nz(m.getState()))) {
      return false;
    }
    List<String> wanted = stringList(segment.get("categories"));
    if (!wanted.isEmpty()) {
      List<String> interests = json.stringList(m.getCategoryInterests());
      if (wanted.stream().noneMatch(interests::contains)) {
        return false;
      }
    }
    return !Boolean.TRUE.equals(segment.get("participated_only"))
        || Boolean.TRUE.equals(m.getParticipatedBefore());
  }

  // ----------------------------------------------------------- campaigns

  private ResponseEntity<?> createCampaign(Map<String, Object> p, String email) {
    Instant now = Instant.now();
    EmailCampaignEntity campaign = new EmailCampaignEntity();
    campaign.setId(newId());
    campaign.setName(orEmpty(str(p.get("name"))));
    campaign.setType(strOr(p.get("type"), "announcement"));
    campaign.setAudienceTypes(write(stringList(p.get("audience_types"))));
    campaign.setStates(write(stringList(p.get("states"))));
    campaign.setCategories(write(stringList(p.get("categories"))));
    campaign.setParticipatedOnly(Boolean.TRUE.equals(p.get("participated_only")));
    campaign.setCompetitionId(orEmpty(str(p.get("competition_id"))));
    campaign.setSubject(orEmpty(str(p.get("subject"))));
    campaign.setBody(orEmpty(str(p.get("body"))));
    campaign.setStatus("draft");
    campaign.setCreatedBy(orEmpty(email));
    campaign.setCreatedDate(now);
    campaign.setUpdatedDate(now);
    campaign.setIsSample(false);
    campaigns.save(campaign);
    return ResponseEntity.ok(Map.of("campaign", campaignJson(campaign)));
  }

  private ResponseEntity<?> sendCampaign(Map<String, Object> p) {
    String campaignId = str(p.get("campaign_id"));
    Optional<EmailCampaignEntity> found = campaignId == null
        ? Optional.empty() : campaigns.findById(campaignId);
    if (found.isEmpty()) {
      return ResponseEntity.status(404).body(Map.of("error", "Campaign not found"));
    }
    EmailCampaignEntity campaign = found.get();

    Map<String, Object> segment = new LinkedHashMap<>();
    segment.put("audience_types", json.stringList(campaign.getAudienceTypes()));
    segment.put("states", json.stringList(campaign.getStates()));
    segment.put("categories", json.stringList(campaign.getCategories()));
    segment.put("participated_only", Boolean.TRUE.equals(campaign.getParticipatedOnly()));

    List<AudienceMemberEntity> targets = audience.findAllNewestFirst(Limit.of(AUDIENCE_LIMIT))
        .stream()
        .filter(m -> !"unsubscribed".equals(nz(m.getStatus())))
        .filter(m -> matchesSegment(m, segment))
        .toList();

    int sent = 0;
    int skipped = 0;
    for (AudienceMemberEntity member : targets) {
      String body = nz(campaign.getBody())
          .replace("{{name}}", nz(member.getName()))
          .replace("{{email}}", nz(member.getEmail()));
      if (mail.send(member.getEmail(), campaign.getSubject(), body)) {
        sent++;
      } else {
        skipped++;
      }
    }

    Instant now = Instant.now();
    campaign.setStatus("sent");
    campaign.setSentCount((double) sent);
    campaign.setSkippedUnregistered((double) skipped);
    campaign.setAudienceCount((double) targets.size());
    campaign.setSentAt(now);
    campaign.setUpdatedDate(now);
    campaigns.save(campaign);

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("sent", sent);
    out.put("skipped", skipped);
    out.put("audience_count", targets.size());
    out.put("campaign", campaignJson(campaign));
    return ResponseEntity.ok(out);
  }

  /**
   * Sends one of the fixed lifecycle emails.
   *
   * <p>Admin or creator, unlike the rest of the admin block: this is used by
   * automated flows around entries and voting, and the templates are fixed —
   * the caller chooses which one, never its wording.
   */
  private ResponseEntity<?> sendLifecycle(
      Map<String, Object> p, String email, String sessionToken) {

    if (email == null) {
      return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
    }
    if (!caller.isAdmin(sessionToken)) {
      return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
    }

    String type = orEmpty(str(p.get("lifecycle_type")));
    Map<String, Object> context = p.get("context") instanceof Map<?, ?> c
        ? castMap(c) : Map.of();
    String name = orEmpty(str(p.get("recipient_name")));
    String title = orEmpty(str(context.get("title")));
    String challenge = orDefault(str(context.get("challenge")), "the challenge");

    String subject;
    String body;
    switch (type) {
      case "welcome" -> {
        subject = "Welcome to 53 Challenges";
        body = welcomeBody(name);
      }
      case "entry_confirmed" -> {
        subject = "Your entry \"" + title + "\" is confirmed";
        body = greeting(name) + "Your entry to " + challenge
            + " has been received and confirmed. Good luck — share it to gather "
            + "community votes!\n\n— The 53 Challenges team";
      }
      case "voting_open" -> {
        subject = "Voting is open: " + challenge;
        body = greeting(name) + "Voting is now open for " + challenge
            + ". Cast your vote for your favourite creators.\n\n— The 53 Challenges team";
      }
      case "results_announced" -> {
        subject = "Results are in: " + challenge;
        body = greeting(name) + "The results for " + challenge
            + " have been announced. Visit the challenge page to see the winners."
            + "\n\n— The 53 Challenges team";
      }
      default -> {
        return ResponseEntity.status(400).body(Map.of("error", "Unknown lifecycle type"));
      }
    }

    boolean sent = mail.send(str(p.get("recipient_email")), subject, body);
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("sent", sent);
    if (!sent) {
      out.put("reason", "The email could not be delivered.");
    }
    return ResponseEntity.ok(out);
  }

  private static String greeting(String name) {
    return "Hi " + (name == null || name.isBlank() ? "there" : name) + ",\n\n";
  }

  private static String welcomeBody(String name) {
    return greeting(name)
        + "Welcome to 53 Challenges — Australia's creative competition platform. "
        + "We'll let you know when new challenges open, voting goes live, and "
        + "results are announced.\n\n"
        + "Explore live challenges at https://53challenges.com/challenges\n\n"
        + "— The 53 Challenges team";
  }

  // ------------------------------------------------- organisations, sponsors

  private ResponseEntity<?> createOrganisation(Map<String, Object> p) {
    Instant now = Instant.now();
    OrganisationEntity organisation = new OrganisationEntity();
    organisation.setId(newId());
    organisation.setName(orEmpty(str(p.get("name"))));
    organisation.setKind(strOr(p.get("kind"), "club"));
    organisation.setSignupCode(strOr(p.get("signup_code"), signupCode()));
    organisation.setContactEmail(orEmpty(str(p.get("contact_email"))));
    organisation.setState(orEmpty(str(p.get("state"))));
    organisation.setLeaderboardEnabled(!Boolean.FALSE.equals(p.get("leaderboard_enabled")));
    organisation.setStatus("active");
    organisation.setCreatedDate(now);
    organisation.setUpdatedDate(now);
    organisation.setIsSample(false);
    organisations.save(organisation);
    return ResponseEntity.ok(Map.of("organisation", organisationJson(organisation)));
  }

  private ResponseEntity<?> leaderboard(Map<String, Object> p) {
    String organisationId = orEmpty(str(p.get("organisation_id")));
    List<AudienceMemberEntity> members = audience.findByOrganisation(organisationId);

    List<Map<String, Object>> rows = new ArrayList<>();
    double totalEntries = 0;
    double totalVotes = 0;
    for (AudienceMemberEntity m : members) {
      double memberEntries = m.getEntryCount() == null ? 0 : m.getEntryCount();
      double memberVotes = m.getVoteCount() == null ? 0 : m.getVoteCount();
      totalEntries += memberEntries;
      totalVotes += memberVotes;

      Map<String, Object> row = new LinkedHashMap<>();
      row.put("name", nz(m.getName()).isEmpty() ? m.getEmail() : m.getName());
      row.put("entries", memberEntries);
      row.put("votes", memberVotes);
      rows.add(row);
    }
    rows.sort(Comparator.comparingDouble((Map<String, Object> r) ->
        (Double) r.get("entries") + (Double) r.get("votes")).reversed());

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("rows", rows);
    out.put("totals", Map.of("entries", totalEntries, "votes", totalVotes));
    out.put("members", members.size());
    return ResponseEntity.ok(out);
  }

  private ResponseEntity<?> mySponsorProfile(String email) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("profile", findSponsor(email).map(this::sponsorJson).orElse(null));
    return ResponseEntity.ok(out);
  }

  private ResponseEntity<?> applyAsSponsor(Map<String, Object> p, String email) {
    Optional<SponsorProfileEntity> existing = findSponsor(email);
    if (existing.isPresent()) {
      return ResponseEntity.ok(Map.of(
          "profile", sponsorJson(existing.get()), "already", true));
    }

    Instant now = Instant.now();
    SponsorProfileEntity sponsor = new SponsorProfileEntity();
    sponsor.setId(newId());
    sponsor.setName(clip(strOr(p.get("name"), email), 200));
    sponsor.setOrganisation(clip(orEmpty(str(p.get("organisation"))), 200));
    sponsor.setContactName(clip(orEmpty(str(p.get("contact_name"))), 120));
    // Always the session's address, never one supplied in the body.
    sponsor.setContactEmail(email);
    sponsor.setUserId(users.findIdByEmail(email).orElse(""));
    sponsor.setCompetitionIds(write(List.of()));
    sponsor.setStatus("pending");
    sponsor.setCreatedDate(now);
    sponsor.setUpdatedDate(now);
    sponsor.setIsSample(false);
    sponsors.save(sponsor);

    return ResponseEntity.ok(Map.of("profile", sponsorJson(sponsor)));
  }

  private Optional<SponsorProfileEntity> findSponsor(String email) {
    String userId = users.findIdByEmail(email).orElse("");
    return sponsors.findAllNewestFirst(Limit.of(LIST_LIMIT)).stream()
        .filter(s -> email.equalsIgnoreCase(nz(s.getContactEmail()))
            || (!userId.isEmpty() && userId.equals(s.getUserId())))
        .findFirst();
  }

  private ResponseEntity<?> saveSponsor(Map<String, Object> p) {
    String id = str(p.get("id"));
    Instant now = Instant.now();

    SponsorProfileEntity sponsor = id == null ? null : sponsors.findById(id).orElse(null);
    boolean isNew = sponsor == null;
    if (isNew) {
      sponsor = new SponsorProfileEntity();
      sponsor.setId(newId());
      sponsor.setCreatedDate(now);
      sponsor.setIsSample(false);
    }
    sponsor.setName(orEmpty(str(p.get("name"))));
    sponsor.setOrganisation(orEmpty(str(p.get("organisation"))));
    sponsor.setContactName(orEmpty(str(p.get("contact_name"))));
    sponsor.setContactEmail(orEmpty(str(p.get("contact_email"))));
    sponsor.setCompetitionIds(write(stringList(p.get("competition_ids"))));
    sponsor.setStatus(isNew ? "active" : strOr(p.get("status"), "active"));
    sponsor.setUpdatedDate(now);
    sponsors.save(sponsor);

    return ResponseEntity.ok(Map.of("sponsor", sponsorJson(sponsor)));
  }

  private ResponseEntity<?> deleteSponsor(Map<String, Object> p) {
    String id = str(p.get("id"));
    if (id != null) {
      sponsors.findById(id).ifPresent(sponsors::delete);
    }
    return ResponseEntity.ok(Map.of("ok", true));
  }

  // ------------------------------------------------------------ pipeline

  private ResponseEntity<?> updatePipelineStatus(Map<String, Object> p) {
    String id = str(p.get("id"));
    String status = str(p.get("pipeline_status"));
    if (id == null || status == null) {
      return ResponseEntity.status(400).body(Map.of(
          "error", "id and pipeline_status are required"));
    }
    Optional<PartnerInquiryEntity> found = inquiries.findById(id);
    if (found.isEmpty()) {
      return ResponseEntity.status(404).body(Map.of("error", "Inquiry not found"));
    }
    PartnerInquiryEntity item = found.get();
    item.setPipelineStatus(status);
    item.setUpdatedDate(Instant.now());
    inquiries.save(item);
    return ResponseEntity.ok(Map.of("item", inquiryJson(item)));
  }

  private ResponseEntity<?> savePartnerProspect(Map<String, Object> p) {
    String name = clip(orEmpty(str(p.get("name"))), 200);
    if (name.isEmpty()) {
      return ResponseEntity.status(400).body(Map.of("error", "Prospect name required"));
    }
    String kind = orEmpty(str(p.get("kind"))).toLowerCase(Locale.ROOT);

    Instant now = Instant.now();
    PartnerInquiryEntity item = new PartnerInquiryEntity();
    item.setId(newId());
    item.setCompanyName(name);
    item.setOrganisationKind(PROSPECT_KINDS.contains(kind) ? kind : "other");
    item.setContactName("AI prospect (no contact yet)");
    // A deliberately invalid placeholder: better an address that cannot be
    // emailed by accident than a plausible one nobody checked.
    item.setContactEmail(clipOr(str(p.get("contact_email")), 160,
        "unknown@prospect.invalid"));
    item.setCompanyWebsite(clip(orEmpty(str(p.get("website"))), 200));
    item.setChallengeTitle("AI-sourced partnership prospect");
    item.setChallengeDescription(clipOr(str(p.get("why_fit")), 800,
        "Sourced via AI partner finder."));
    item.setAudienceDescription(clipOr(str(p.get("location")), 200, "To be confirmed"));
    item.setAdditionalNotes(clip(orEmpty(str(p.get("angle"))), 500));
    item.setHowHeard("AI partner finder");
    item.setPipelineStatus("new");
    item.setCreatedDate(now);
    item.setUpdatedDate(now);
    item.setIsSample(false);
    inquiries.save(item);

    return ResponseEntity.ok(Map.of("item", inquiryJson(item)));
  }

  // --------------------------------------------------------- dashboards

  private ResponseEntity<?> listCategories() {
    List<Map<String, Object>> out = new ArrayList<>();
    categories.findAll().stream()
        .filter(c -> "active".equals(nz(c.getStatus())))
        .forEach(c -> {
          Map<String, Object> row = new LinkedHashMap<>();
          row.put("id", c.getId());
          row.put("name", c.getName());
          row.put("slug", c.getSlug());
          out.add(row);
        });
    return ResponseEntity.ok(Map.of("categories", out));
  }

  private ResponseEntity<?> dashboardSummary() {
    return ResponseEntity.ok(snapshot());
  }

  /** The live numbers, shared by the dashboard and the growth insights. */
  private Map<String, Object> snapshot() {
    List<AudienceMemberEntity> members = audience.findAllNewestFirst(Limit.of(AUDIENCE_LIMIT));
    List<EmailCampaignEntity> allCampaigns =
        campaigns.findAllNewestFirst(Limit.of(CAMPAIGN_LIMIT));
    List<PartnerInquiryEntity> pipeline = inquiries.findAll();

    long sentCampaigns = allCampaigns.stream()
        .filter(c -> "sent".equals(nz(c.getStatus()))).count();
    double delivered = allCampaigns.stream()
        .filter(c -> "sent".equals(nz(c.getStatus())))
        .mapToDouble(c -> c.getSentCount() == null ? 0 : c.getSentCount())
        .sum();

    long totalEntries = entries.count();
    long approved = entries.findAll().stream()
        .filter(e -> "approved".equals(nz(e.getStatus()))).count();
    long pending = entries.findAll().stream()
        .filter(e -> "pending".equals(nz(e.getStatus()))).count();

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("audience", Map.of(
        "total", members.size(),
        "unsubscribed", members.stream()
            .filter(m -> "unsubscribed".equals(nz(m.getStatus()))).count()));
    out.put("campaigns", Map.of(
        "total", allCampaigns.size(),
        "drafts", allCampaigns.stream()
            .filter(c -> "draft".equals(nz(c.getStatus()))).count(),
        "sent", sentCampaigns,
        "emails_delivered", delivered));
    out.put("entries", Map.of(
        "total", totalEntries, "approved", approved, "pending", pending));
    out.put("organisations", organisations.findActive(Limit.of(CAMPAIGN_LIMIT)).size());
    out.put("pipeline", Map.of(
        "total", pipeline.stream()
            .filter(i -> !nz(i.getPipelineStatus()).isEmpty()).count(),
        "new", pipeline.stream()
            .filter(i -> "new".equals(nz(i.getPipelineStatus()))).count()));
    return out;
  }

  // ------------------------------------------------------------ ai tools

  private ResponseEntity<?> aiGenerateInvite(Map<String, Object> p) {
    String name = clip(orEmpty(str(p.get("name"))), 120);
    if (name.isEmpty()) {
      return ResponseEntity.status(400).body(Map.of("error", "Prospect name required"));
    }
    String location = clip(orEmpty(str(p.get("location"))), 80);

    String prompt = "Write a partnership invitation email from the 53 Challenges team "
        + "(an Australian creative competition platform) to " + name
        + (location.isEmpty() ? "" : " in " + location) + ".\n\n"
        + "Context about them: " + clip(orEmpty(str(p.get("why_fit"))), 400) + "\n"
        + "Suggested angle: " + clip(orEmpty(str(p.get("angle"))), 300) + "\n"
        + "Partnership type: " + clip(strOr(p.get("partner_kind"), "sponsor"), 40) + "\n"
        + notes(p.get("extra_notes"), "Extra notes from our team: ", 300)
        + "\nKeep it under 180 words, warm and specific (no generic filler), "
        + "Australian English, one clear call to action to book a 15-minute chat. "
        + "No placeholders other than the recipient's name.";

    return ResponseEntity.ok(subjectAndBody(llm.invoke(prompt, emailSchema())));
  }

  private ResponseEntity<?> aiCampaignCopy(Map<String, Object> p) {
    String prompt = "Write a marketing email for 53 Challenges, an Australian creative "
        + "competition platform.\n\n"
        + "Campaign name: " + clip(orEmpty(str(p.get("name"))), 120) + "\n"
        + "Campaign type: " + clip(strOr(p.get("type"), "announcement"), 40) + "\n"
        + "Audience types: " + joinOr(p.get("audience_types"), "all") + "\n"
        + "States: " + joinOr(p.get("states"), "all of Australia") + "\n"
        + "Categories of interest: "
        + joinOr(p.get("categories"), "all creative categories") + "\n"
        + notes(p.get("notes"), "Extra notes: ", 300)
        + "\nAustralian English, warm and energetic, under 150 words, one clear call "
        + "to action. Use {{name}} once for personalisation.";

    return ResponseEntity.ok(subjectAndBody(llm.invoke(prompt, emailSchema())));
  }

  private ResponseEntity<?> aiFollowUpDraft(Map<String, Object> p) {
    String id = str(p.get("id"));
    if (id == null) {
      return ResponseEntity.status(400).body(Map.of("error", "Inquiry id required"));
    }
    Optional<PartnerInquiryEntity> found = inquiries.findById(id);
    if (found.isEmpty()) {
      return ResponseEntity.status(404).body(Map.of("error", "Inquiry not found"));
    }
    PartnerInquiryEntity item = found.get();

    String prompt = "Write the next outreach message from the 53 Challenges team "
        + "(an Australian creative competition platform) to a partner inquiry.\n\n"
        + "Organisation: " + clip(nz(item.getCompanyName()), 160) + "\n"
        + "Contact: " + clip(nz(item.getContactName()), 120) + "\n"
        + "Organisation kind: " + clip(nz(item.getOrganisationKind()), 60) + "\n"
        + "Their idea / notes: " + clip(nz(item.getChallengeDescription()), 600) + "\n"
        + "Audience they described: " + clip(nz(item.getAudienceDescription()), 300) + "\n"
        + "Current pipeline stage: "
        + clip(nz(item.getPipelineStatus()).isEmpty() ? "new" : item.getPipelineStatus(), 40)
        + "\n\nMatch the message to the stage — a first approach for \"new\", a gentle "
        + "nudge for \"contacted\", next-step detail for \"replied\" or "
        + "\"in_discussion\", onboarding for \"confirmed\", and a warm close for "
        + "\"declined\". Under 150 words, Australian English, one clear call to action.";

    return ResponseEntity.ok(subjectAndBody(llm.invoke(prompt, emailSchema())));
  }

  private ResponseEntity<?> aiGrowthInsights() {
    Map<String, Object> snapshot = snapshot();
    String prompt = "You are the growth strategist for 53 Challenges, an Australian "
        + "creative competition platform. Here is a live snapshot of the marketing "
        + "data:\n\n" + write(snapshot) + "\n\n"
        + "Give the 3 highest-impact actions the team should take this week. Base "
        + "every claim strictly on the numbers above — never invent metrics. For each "
        + "action give a short title, one or two sentences of reasoning that cites the "
        + "relevant numbers, and a concrete first step. Also return one sentence "
        + "summarising the overall state of the funnel.";

    ObjectNode action = mapper.createObjectNode();
    action.put("type", "object");
    ObjectNode actionProperties = mapper.createObjectNode();
    actionProperties.set("title", field("string", "A short action title."));
    actionProperties.set("why", field("string", "Reasoning citing the numbers."));
    actionProperties.set("first_step", field("string", "A concrete first step."));
    action.set("properties", actionProperties);

    ObjectNode actions = mapper.createObjectNode();
    actions.put("type", "array");
    actions.set("items", action);

    ObjectNode properties = mapper.createObjectNode();
    properties.set("summary", field("string", "One sentence on the funnel overall."));
    properties.set("actions", actions);

    ObjectNode schema = mapper.createObjectNode();
    schema.put("type", "object");
    schema.set("properties", properties);
    schema.set("required", mapper.valueToTree(List.of("summary", "actions")));

    JsonNode result = llm.invoke(prompt, schema);
    List<JsonNode> top = new ArrayList<>();
    for (JsonNode a : result.path("actions")) {
      if (top.size() >= 3) {
        break;
      }
      top.add(a);
    }

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("summary", result.path("summary").asText(""));
    out.put("actions", top);
    // Returned alongside so the reader can check the advice against the data
    // it was based on, rather than taking the model's word for the numbers.
    out.put("snapshot", snapshot);
    return ResponseEntity.ok(out);
  }

  private JsonNode emailSchema() {
    ObjectNode properties = mapper.createObjectNode();
    properties.set("subject", field("string", "The subject line."));
    properties.set("body", field("string", "The email body."));
    ObjectNode schema = mapper.createObjectNode();
    schema.put("type", "object");
    schema.set("properties", properties);
    schema.set("required", mapper.valueToTree(List.of("subject", "body")));
    return schema;
  }

  private ObjectNode field(String type, String description) {
    ObjectNode node = mapper.createObjectNode();
    node.put("type", type);
    node.put("description", description);
    return node;
  }

  private static Map<String, Object> subjectAndBody(JsonNode result) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("subject", result.path("subject").asText(""));
    out.put("body", result.path("body").asText(""));
    return out;
  }

  // -------------------------------------------------------------- shapes

  private Map<String, Object> memberJson(AudienceMemberEntity m) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", m.getId());
    out.put("email", m.getEmail());
    out.put("name", m.getName());
    out.put("audience_type", m.getAudienceType());
    out.put("state", m.getState());
    out.put("category_interests", json.stringList(m.getCategoryInterests()));
    out.put("participated_before", m.getParticipatedBefore());
    out.put("entry_count", m.getEntryCount());
    out.put("vote_count", m.getVoteCount());
    out.put("source", m.getSource());
    out.put("organisation_id", m.getOrganisationId());
    out.put("organisation_name", m.getOrganisationName());
    out.put("status", m.getStatus());
    out.put("unsubscribed_at", iso(m.getUnsubscribedAt()));
    out.put("welcomed_at", iso(m.getWelcomedAt()));
    out.put("created_date", iso(m.getCreatedDate()));
    return out;
  }

  private Map<String, Object> campaignJson(EmailCampaignEntity c) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", c.getId());
    out.put("name", c.getName());
    out.put("type", c.getType());
    out.put("audience_types", json.stringList(c.getAudienceTypes()));
    out.put("states", json.stringList(c.getStates()));
    out.put("categories", json.stringList(c.getCategories()));
    out.put("participated_only", c.getParticipatedOnly());
    out.put("competition_id", c.getCompetitionId());
    out.put("subject", c.getSubject());
    out.put("body", c.getBody());
    out.put("status", c.getStatus());
    out.put("audience_count", c.getAudienceCount());
    out.put("sent_count", c.getSentCount());
    out.put("skipped_unregistered", c.getSkippedUnregistered());
    out.put("sent_at", iso(c.getSentAt()));
    out.put("created_date", iso(c.getCreatedDate()));
    return out;
  }

  private Map<String, Object> organisationJson(OrganisationEntity o) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", o.getId());
    out.put("name", o.getName());
    out.put("kind", o.getKind());
    out.put("signup_code", o.getSignupCode());
    out.put("contact_email", o.getContactEmail());
    out.put("state", o.getState());
    out.put("member_count", o.getMemberCount());
    out.put("entry_count", o.getEntryCount());
    out.put("vote_count", o.getVoteCount());
    out.put("leaderboard_enabled", o.getLeaderboardEnabled());
    out.put("status", o.getStatus());
    return out;
  }

  private Map<String, Object> sponsorJson(SponsorProfileEntity s) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", s.getId());
    out.put("name", s.getName());
    out.put("organisation", s.getOrganisation());
    out.put("contact_name", s.getContactName());
    out.put("contact_email", s.getContactEmail());
    out.put("user_id", s.getUserId());
    out.put("competition_ids", json.stringList(s.getCompetitionIds()));
    out.put("status", s.getStatus());
    out.put("created_date", iso(s.getCreatedDate()));
    return out;
  }

  private Map<String, Object> inquiryJson(PartnerInquiryEntity i) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", i.getId());
    out.put("company_name", i.getCompanyName());
    out.put("contact_name", i.getContactName());
    out.put("contact_email", i.getContactEmail());
    out.put("company_website", i.getCompanyWebsite());
    out.put("organisation_kind", i.getOrganisationKind());
    out.put("challenge_title", i.getChallengeTitle());
    out.put("challenge_description", i.getChallengeDescription());
    out.put("audience_description", i.getAudienceDescription());
    out.put("additional_notes", i.getAdditionalNotes());
    out.put("how_heard", i.getHowHeard());
    out.put("pipeline_status", i.getPipelineStatus());
    out.put("status", i.getStatus());
    out.put("created_date", iso(i.getCreatedDate()));
    return out;
  }

  // ------------------------------------------------------------- helpers

  /** Six characters from a real CSPRNG, unlike the original's Math.random. */
  private static String signupCode() {
    String alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    StringBuilder code = new StringBuilder(6);
    for (int i = 0; i < 6; i++) {
      code.append(alphabet.charAt(RANDOM.nextInt(alphabet.length())));
    }
    return code.toString();
  }

  private static String notes(Object value, String label, int max) {
    String text = str(value);
    return text == null ? "" : label + clip(text, max) + "\n";
  }

  private static String joinOr(Object value, String fallback) {
    List<String> items = stringList(value);
    return items.isEmpty() ? fallback : clip(String.join(", ", items), 200);
  }

  private String write(Object value) {
    try {
      return mapper.writeValueAsString(value);
    } catch (Exception e) {
      return "[]";
    }
  }

  private static List<String> stringList(Object value) {
    if (!(value instanceof List<?> list)) {
      return List.of();
    }
    return list.stream().map(String::valueOf).toList();
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> castMap(Map<?, ?> supplied) {
    return (Map<String, Object>) supplied;
  }

  private static String clip(String value, int max) {
    String text = nz(value);
    return text.length() <= max ? text : text.substring(0, max);
  }

  private static String clipOr(String value, int max, String fallback) {
    String text = nz(value);
    return text.isEmpty() ? fallback : clip(text, max);
  }

  private static String iso(Instant value) {
    return value == null ? null : value.toString();
  }

  private static String orDefault(String value, String fallback) {
    return value == null || value.isBlank() ? fallback : value;
  }

  private static String strOr(Object value, String fallback) {
    String text = str(value);
    return text == null ? fallback : text;
  }

  private static String orEmpty(String value) {
    return value == null ? "" : value;
  }

  private static String nz(String value) {
    return value == null ? "" : value;
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
