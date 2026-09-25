package com.fiftythree.challenges.llm;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fiftythree.challenges.entity.PartnerInquiryEntity;
import com.fiftythree.challenges.entity.PartnerInquiryRepository;
import com.fiftythree.challenges.security.CallerResolver;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * The Java replacement for {@code planChallengeFromProposal}: drafts a
 * structured challenge plan from a corporate partner's enquiry.
 *
 * <p>Called two ways, and the authorisation reflects that. A workflow invokes
 * it with no user at all when an enquiry is created, so an anonymous call is
 * allowed; but if somebody <em>is</em> signed in, they must be an admin. That
 * is the original's rule and it is worth keeping deliberately rather than
 * tightening: requiring a session would break the automatic path, and allowing
 * any signed-in caller would let a competitor spend the API budget.
 *
 * <p>The plan is a draft for the partnerships team to refine with the client.
 * It is written to {@code ai_plan} and the enquiry moves to {@code planning};
 * nothing here contacts the partner or commits to anything.
 */
@RestController
public class PlanChallengeController {

  private static final Logger log = LoggerFactory.getLogger(PlanChallengeController.class);

  /** The categories a plan may choose from. */
  private static final List<String> CATEGORIES = List.of(
      "visual-arts",
      "photography",
      "writing",
      "digital-creativity",
      "performance-voice",
      "open-experimental");

  private final LlmClient llm;
  private final PartnerInquiryRepository inquiries;
  private final CallerResolver caller;
  private final ObjectMapper mapper;

  public PlanChallengeController(
      LlmClient llm,
      PartnerInquiryRepository inquiries,
      CallerResolver caller,
      ObjectMapper mapper) {
    this.llm = llm;
    this.inquiries = inquiries;
    this.caller = caller;
    this.mapper = mapper;
  }

  @PostMapping("/api/apps/{appId}/functions/planChallengeFromProposal")
  public ResponseEntity<?> handle(@RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> request = body == null ? Map.of() : body;
    String inquiryId = str(request.get("inquiry_id"));
    if (inquiryId == null) {
      return ResponseEntity.status(400).body(Map.of("error", "Missing inquiry_id"));
    }

    String sessionToken = str(request.get("session_token"));
    String email = caller.email(sessionToken);
    // No user means the workflow called it. A user who is not an admin is a
    // person who should not be here.
    if (email != null && !caller.isAdmin(sessionToken)) {
      return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
    }

    Optional<PartnerInquiryEntity> found = inquiries.findById(inquiryId);
    if (found.isEmpty()) {
      return ResponseEntity.status(404).body(Map.of("error", "Inquiry not found"));
    }
    PartnerInquiryEntity inquiry = found.get();

    JsonNode plan;
    try {
      plan = llm.invoke(prompt(inquiry), schema());
    } catch (LlmClient.LlmUnavailableException e) {
      // 503, not 500: the request was fine and retrying later may well work.
      return ResponseEntity.status(503).body(Map.of("error", e.getMessage()));
    }

    try {
      inquiry.setAiPlan(mapper.writeValueAsString(plan));
    } catch (Exception e) {
      log.error("Could not serialise the generated plan for inquiry {}", inquiryId, e);
      return ResponseEntity.status(500).body(Map.of("error", "Could not store the plan"));
    }
    inquiry.setStatus("planning");
    inquiry.setUpdatedDate(Instant.now());
    inquiries.save(inquiry);

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("success", true);
    out.put("plan", plan);
    return ResponseEntity.ok(out);
  }

  /**
   * The proposal as the model sees it.
   *
   * <p>Every field is labelled and missing ones read "n/a" rather than being
   * dropped, so the model can tell the difference between a budget of nothing
   * and a budget nobody stated.
   */
  private String prompt(PartnerInquiryEntity inquiry) {
    List<String> lines = new ArrayList<>();
    lines.add("Company: " + nz(inquiry.getCompanyName()));
    lines.add("Industry: " + orNa(inquiry.getIndustry()));
    lines.add("Website: " + orNa(inquiry.getCompanyWebsite()));
    lines.add("Working title / theme: " + nz(inquiry.getChallengeTitle()));
    lines.add("Challenge type: " + orNa(inquiry.getChallengeType()));
    lines.add("Main goal: " + orNa(inquiry.getChallengeGoal()));
    lines.add("Description: " + nz(inquiry.getChallengeDescription()));
    lines.add("Target participants: " + nz(inquiry.getAudienceDescription()));
    lines.add("Expected participants: " + orNa(inquiry.getAudienceSize()));
    lines.add("Geographic scope: " + orNa(inquiry.getGeographicScope()));
    lines.add("Launch timing: " + orNa(inquiry.getLaunchTiming()));
    lines.add("Budget: " + orNa(inquiry.getEstimatedBudget()));
    lines.add("Prize format: " + orNa(inquiry.getPrizeFormat()));
    lines.add("Additional notes: " + orNa(inquiry.getAdditionalNotes()));

    return """
        You are Ty, the challenge planning assistant for 53 Challenges — \
        Australia's creative competition platform. A brand or partner has \
        submitted a proposal to host a challenge. Read the proposal below and \
        draft a clear, actionable challenge plan that the partnerships team \
        can refine with the client.

        Be practical, encouraging and specific to the proposal. Write in \
        Australian English.

        Proposal details:
        """ + String.join("\n", lines);
  }

  /** The structure the plan must come back in, mirroring the original schema. */
  private JsonNode schema() {
    ObjectNode properties = mapper.createObjectNode();
    properties.set("recommended_title",
        field("string", "A punchy public-facing title."));
    properties.set("theme", field("string", "A one-line creative theme."));

    ObjectNode category = field("string", "Exactly one of the allowed categories.");
    category.set("enum", mapper.valueToTree(CATEGORIES));
    properties.set("category", category);

    properties.set("brief",
        field("string", "Two to three sentences on what participants should create."));
    properties.set("target_audience",
        field("string", "A refined target-audience description."));
    properties.set("suggested_timeline",
        field("string", "Proposed submission and voting duration, "
            + "e.g. '2 weeks submissions + 1 week voting'."));
    properties.set("prize_structure",
        field("string", "Recommended prize approach given the budget and prize format."));

    ObjectNode nextSteps = field("array", "Three to five concise next steps.");
    nextSteps.set("items", mapper.createObjectNode().put("type", "string"));
    properties.set("next_steps", nextSteps);

    properties.set("summary",
        field("string", "A one to two sentence plain-language summary."));

    ObjectNode schema = mapper.createObjectNode();
    schema.put("type", "object");
    schema.set("properties", properties);
    schema.set("required", mapper.valueToTree(List.of(
        "recommended_title", "theme", "category", "brief", "target_audience",
        "suggested_timeline", "prize_structure", "next_steps", "summary")));
    return schema;
  }

  private ObjectNode field(String type, String description) {
    ObjectNode node = mapper.createObjectNode();
    node.put("type", type);
    node.put("description", description);
    return node;
  }

  private static String orNa(String value) {
    return value == null || value.isBlank() ? "n/a" : value;
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
}
