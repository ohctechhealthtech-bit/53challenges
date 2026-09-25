package com.fiftythree.challenges.host;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fiftythree.challenges.entity.HostNotificationEntity;
import com.fiftythree.challenges.entity.HostNotificationRepository;
import com.fiftythree.challenges.llm.LlmClient;
import com.fiftythree.challenges.mail.MailService;
import com.fiftythree.challenges.security.CallerResolver;
import com.fiftythree.challenges.upstream.ChallengeApiClient;
import com.fiftythree.challenges.user.UserRepository;
import com.fiftythree.challenges.entity.EmailVerificationEntity;
import com.fiftythree.challenges.verification.EmailVerificationService;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * The Java replacement for {@code hostChallengeRequest}: the public "tell us
 * your idea" form and the fuller host application behind it.
 *
 * <p>Both submission paths require the contact address to have been
 * <b>confirmed with an emailed code</b> before anything is posted. This form is
 * public and unauthenticated, so without that check anyone could file
 * applications in somebody else's name and generate email to them from us.
 *
 * <p>Nothing is stored locally. The enquiry goes to the parent's request API,
 * which is the single source of truth — so a deletion there is reflected here
 * immediately and there is no second copy to drift.
 *
 * <p>Notifications never fail a submission. Admin alerts and the host's
 * confirmation email are attempted and their failures swallowed: an idea the
 * host took time to write must not be lost because a mail server was slow.
 */
@RestController
public class HostChallengeRequestController {

  private static final Logger log =
      LoggerFactory.getLogger(HostChallengeRequestController.class);

  private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");

  private static final String VERIFICATION_PURPOSE = "host_application";

  private static final int MAX_ADMIN_ALERTS = 10;

  private static final Map<String, String> ACTIVITY_LABELS = Map.of(
      "art-craft-making", "Art, craft & making",
      "food-farming-community", "Food, farming & community",
      "music-dance-performance", "Music, dance & performance",
      "outdoor-adventure", "Outdoor & adventure",
      "photography-film-digital", "Photography, film & digital",
      "writing-ideas-innovation", "Writing, ideas & innovation",
      "not_sure", "Not sure yet");

  private static final List<String> REQUIRED_APPLICATION_FIELDS = List.of(
      "company_name", "contact_name", "contact_email",
      "challenge_title", "challenge_description", "audience_description");

  private final LlmClient llm;
  private final MailService mail;
  private final EmailVerificationService verification;
  private final HostIdeaService ideas;
  private final HostNotificationRepository notifications;
  private final ChallengeApiClient upstream;
  private final CallerResolver caller;
  private final UserRepository users;
  private final ObjectMapper mapper;

  public HostChallengeRequestController(
      LlmClient llm,
      MailService mail,
      EmailVerificationService verification,
      HostIdeaService ideas,
      HostNotificationRepository notifications,
      ChallengeApiClient upstream,
      CallerResolver caller,
      UserRepository users,
      ObjectMapper mapper) {
    this.llm = llm;
    this.mail = mail;
    this.verification = verification;
    this.ideas = ideas;
    this.notifications = notifications;
    this.upstream = upstream;
    this.caller = caller;
    this.users = users;
    this.mapper = mapper;
  }

  @PostMapping("/api/apps/{appId}/functions/hostChallengeRequest")
  public ResponseEntity<?> handle(@RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> request = body == null ? Map.of() : body;
    String action = orEmpty(str(request.get("action")));

    try {
      return switch (action) {
        case "submit_idea" -> submitIdea(request);
        case "my_ideas" -> myIdeas(request);
        case "suggest_description" -> suggestDescription(request);
        case "list_idea_templates" -> listTemplates();
        default -> submitApplication(request);
      };
    } catch (Exception e) {
      log.error("hostChallengeRequest action '{}' failed", action, e);
      return ResponseEntity.status(500).body(Map.of(
          "error", e.getMessage() == null ? "Request failed" : e.getMessage()));
    }
  }

  // ---------------------------------------------------------- submit idea

  private ResponseEntity<?> submitIdea(Map<String, Object> request) {
    String name = orEmpty(str(request.get("name")));
    String email = orEmpty(str(request.get("email"))).toLowerCase(Locale.ROOT);
    String title = orEmpty(str(request.get("challenge_title")));
    String description = orEmpty(str(request.get("challenge_description")));

    if (name.isEmpty() || title.isEmpty() || description.isEmpty()) {
      return ResponseEntity.status(400).body(Map.of(
          "error", "Please fill in your name, challenge title and description."));
    }
    if (!EMAIL.matcher(email).matches()) {
      return ResponseEntity.status(400).body(Map.of(
          "error", "Please enter a valid email address."));
    }

    ResponseEntity<?> unverified = requireVerified(email, request, false);
    if (unverified != null) {
      return unverified;
    }

    String requestId = ideas.createEnquiry(request);
    if (requestId == null || requestId.isBlank()) {
      return ResponseEntity.status(500).body(Map.of("error",
          "Something went wrong on our end — we couldn't save your idea. "
              + "Please try again in a moment."));
    }

    String activityLabel = ACTIVITY_LABELS.getOrDefault(
        orEmpty(str(request.get("activity_type"))), "To be confirmed");

    alertAdmins(request, requestId, name, email, title, description, activityLabel);
    confirmToHost(name, email, title, description, activityLabel,
        orEmpty(str(request.get("org_type"))));

    return ResponseEntity.ok(Map.of("success", true, "draft_id", requestId));
  }

  /** Both an in-app notification and an email, per admin. Never fatal. */
  private void alertAdmins(
      Map<String, Object> request,
      String requestId,
      String name,
      String email,
      String title,
      String description,
      String activityLabel) {

    try {
      String phone = orEmpty(str(request.get("phone")));
      String organisation = orEmpty(str(request.get("organisation_name")));

      String summary = String.join("\n",
          "A new challenge idea came in through \"Tell us your idea\".",
          "",
          "From: " + name + " (" + email + (phone.isEmpty() ? "" : ", " + phone) + ")",
          "Organisation: " + (organisation.isEmpty() ? "Not given" : organisation),
          "Challenge: " + title,
          "Kind of activity: " + activityLabel,
          "",
          "Their idea:",
          description,
          "",
          "Open the admin dashboard → Host Requests → Idea Submissions to review it.");

      for (String adminEmail : users.findAdminEmails(org.springframework.data.domain.Limit.of(MAX_ADMIN_ALERTS))) {
        Instant now = Instant.now();
        HostNotificationEntity notification = new HostNotificationEntity();
        notification.setId(newId());
        notification.setRecipientEmail(adminEmail);
        notification.setTitle("New challenge idea: " + title);
        notification.setBody(name + " (" + email
            + ") submitted a new idea. Review it under Host Requests → Idea Submissions.");
        notification.setProposalId(requestId);
        notification.setRead(false);
        notification.setCreatedDate(now);
        notification.setUpdatedDate(now);
        notification.setIsSample(false);
        notifications.save(notification);

        mail.send(adminEmail, "New challenge idea: " + title, summary);
      }
    } catch (Exception e) {
      // Never fail the host's submission over an admin alert.
      log.warn("Could not alert admins about idea {}: {}", requestId, e.toString());
    }
  }

  private void confirmToHost(
      String name, String email, String title,
      String description, String activityLabel, String orgType) {

    String body = String.join("\n",
        "Hi " + name + ",",
        "",
        "Thanks for sharing your challenge idea with us — we love hearing what "
            + "people want to create.",
        "",
        "Here's what you sent through:",
        "",
        "Challenge: " + title,
        "Kind of activity: " + activityLabel,
        "Hosting for: " + (orgType.isEmpty() ? "Not specified" : orgType),
        "",
        "Your idea in your words:",
        description,
        "",
        "Our team will read through it and get back to you within 2 business days "
            + "to arrange a short chat about how we can help bring it to life.",
        "",
        "Talk soon,",
        "The 53 Challenges team");

    mail.send(email, "We've received your challenge idea — 53 Challenges", body);
  }

  // ----------------------------------------------------------- my ideas

  private ResponseEntity<?> myIdeas(Map<String, Object> request) {
    String email = caller.email(str(request.get("session_token")));
    if (email == null) {
      return ResponseEntity.ok(Map.of("ideas", List.of()));
    }
    String wanted = email.toLowerCase(Locale.ROOT);

    List<Map<String, Object>> mine = new ArrayList<>();
    for (Map<String, Object> idea : ideas.list(200)) {
      // Matched on the address inside the idea's own answers, which is what
      // ties an anonymous submission back to an account created later.
      Object answers = idea.get("answers");
      String ideaEmail = answers instanceof Map<?, ?> map
          ? orEmpty(str(((Map<?, ?>) map).get("email"))).toLowerCase(Locale.ROOT)
          : "";
      if (wanted.equals(ideaEmail)) {
        mine.add(idea);
      }
    }
    mine.sort((a, b) -> orEmpty(str(b.get("created_date")))
        .compareTo(orEmpty(str(a.get("created_date")))));
    return ResponseEntity.ok(Map.of("ideas", mine));
  }

  // -------------------------------------------------------- suggest text

  private ResponseEntity<?> suggestDescription(Map<String, Object> request) {
    String title = orEmpty(str(request.get("challenge_title")));
    if (title.length() < 3) {
      return ResponseEntity.status(400).body(Map.of(
          "error", "Please add a challenge title first."));
    }

    StringBuilder prompt = new StringBuilder(
        "A person is telling us about a community challenge idea they'd like to "
            + "host in Australia.\n\nWorking title: \"" + title + "\"\n");

    String activityLabel = ACTIVITY_LABELS.get(orEmpty(str(request.get("activity_type"))));
    if (activityLabel != null) {
      prompt.append("Kind of activity: ").append(activityLabel).append('\n');
    }
    String orgType = str(request.get("org_type"));
    if (orgType != null) {
      prompt.append("They are hosting for: ").append(orgType).append('\n');
    }
    String notes = str(request.get("current_description"));
    if (notes != null) {
      prompt.append("Their rough notes so far: ").append(notes).append('\n');
    }

    prompt.append("""

        Write a short description of this challenge idea, written in first person \
        as the host (using "we"), in 3 to 4 plain-English sentences. Cover who \
        would take part, what they would actually do, and what would make it \
        special. Warm and simple, no marketing hype, no headings, no bullet \
        points.""");

    ObjectNode description = mapper.createObjectNode();
    description.put("type", "string");
    description.put("description", "The description text, and nothing else.");
    ObjectNode properties = mapper.createObjectNode();
    properties.set("description", description);
    ObjectNode schema = mapper.createObjectNode();
    schema.put("type", "object");
    schema.set("properties", properties);
    schema.set("required", mapper.valueToTree(List.of("description")));

    try {
      JsonNode result = llm.invoke(prompt.toString(), schema);
      return ResponseEntity.ok(Map.of(
          "description", result.path("description").asText("").trim()));
    } catch (LlmClient.LlmUnavailableException e) {
      return ResponseEntity.status(503).body(Map.of("error", e.getMessage()));
    }
  }

  private ResponseEntity<?> listTemplates() {
    return ResponseEntity.ok(Map.of("templates", ideas.activeTemplates()));
  }

  // ------------------------------------------------------ full application

  private ResponseEntity<?> submitApplication(Map<String, Object> request) {
    if (!(request.get("form_data") instanceof Map<?, ?> supplied)) {
      return ResponseEntity.status(400).body(Map.of("error", "Missing form_data"));
    }
    Map<String, Object> form = castMap(supplied);

    List<String> missing = new ArrayList<>();
    for (String field : REQUIRED_APPLICATION_FIELDS) {
      if (orEmpty(str(form.get(field))).isEmpty()) {
        missing.add(field);
      }
    }
    if (!missing.isEmpty()) {
      return ResponseEntity.status(400).body(Map.of(
          "error", "Missing required fields: " + String.join(", ", missing)));
    }

    String email = orEmpty(str(form.get("contact_email"))).toLowerCase(Locale.ROOT);
    if (!EMAIL.matcher(email).matches()) {
      return ResponseEntity.status(400).body(Map.of("error", "Invalid contact_email"));
    }

    ResponseEntity<?> unverified = requireVerified(email, request, true);
    if (unverified != null) {
      return unverified;
    }

    String requestId = ideas.pushRequestToParent(form);
    if (requestId == null || requestId.isBlank()) {
      return ResponseEntity.status(502).body(Map.of("error",
          "We couldn't confirm your submission with our system. Please try again."));
    }
    return ResponseEntity.ok(Map.of("success", true, "request_id", requestId));
  }

  /**
   * Refuses unless the address has been confirmed with an emailed code.
   *
   * <p>Returns null when verified. The application path adds
   * {@code needs_verification} so the form can reopen the code step rather
   * than showing a dead end.
   */
  private ResponseEntity<?> requireVerified(
      String email, Map<String, Object> request, boolean flagNeedsVerification) {

    String token = str(request.get("verification_token"));
    EmailVerificationEntity verified =
        verification.check(email, VERIFICATION_PURPOSE, token);
    if (verified != null) {
      verification.consume(verified);
      return null;
    }

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("error", "Please confirm your email address with the code we sent you.");
    if (flagNeedsVerification) {
      out.put("needs_verification", true);
    }
    return ResponseEntity.status(400).body(out);
  }

  // ------------------------------------------------------------- helpers

  @SuppressWarnings("unchecked")
  private static Map<String, Object> castMap(Map<?, ?> supplied) {
    return (Map<String, Object>) supplied;
  }

  private static String orEmpty(String value) {
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
