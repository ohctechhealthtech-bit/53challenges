package com.fiftythree.challenges.misc;

import com.fasterxml.jackson.databind.JsonNode;
import com.fiftythree.challenges.entity.EmailVerificationEntity;
import com.fiftythree.challenges.upstream.ChallengeApiClient;
import com.fiftythree.challenges.verification.EmailVerificationService;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * The Java replacement for {@code sponsorApplication}: forwards sponsorship
 * enquiries to the parent site so the API key never reaches the browser.
 *
 * <p>Public by necessity — a prospective sponsor has no account — so the
 * emailed verification code is the only thing establishing that the person
 * filling this in controls the address they gave.
 */
@RestController
public class SponsorApplicationController {

  private static final Logger log = LoggerFactory.getLogger(SponsorApplicationController.class);

  private static final String PURPOSE = "sponsor_application";

  private static final List<String> REQUIRED = List.of(
      "organisation_name", "contact_name", "contact_email",
      "challenge_title", "challenge_description");

  private final ChallengeApiClient upstream;
  private final EmailVerificationService verification;

  public SponsorApplicationController(
      ChallengeApiClient upstream, EmailVerificationService verification) {
    this.upstream = upstream;
    this.verification = verification;
  }

  @PostMapping("/api/apps/{appId}/functions/sponsorApplication")
  public ResponseEntity<?> handle(@RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> request = body == null ? Map.of() : body;
    String action = firstNonBlank(str(request.get("action")), "submit");
    if (!"submit".equals(action)) {
      return ResponseEntity.badRequest().body(Map.of("error", "Unknown action: " + action));
    }

    for (String field : REQUIRED) {
      if (str(request.get(field)).trim().isEmpty()) {
        return ResponseEntity.badRequest()
            .body(Map.of("error", field.replace('_', ' ') + " is required"));
      }
    }

    String email = str(request.get("contact_email"));

    // Checked, not consumed, until the enquiry has actually been accepted
    // upstream — otherwise a failure there leaves the sponsor unable to retry
    // and unable to request a new code.
    EmailVerificationEntity token;
    try {
      token = verification.check(email, PURPOSE, str(request.get("verification_token")));
    } catch (RuntimeException e) {
      return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
    }

    try {
      Map<String, Object> params = new LinkedHashMap<>();
      params.put("action", "submit_sponsor_application");
      params.put("organisation_type",
          firstNonBlank(str(request.get("organisation_type")), "Sponsor / Brand"));
      params.put("organisation_name", str(request.get("organisation_name")));
      params.put("contact_name", str(request.get("contact_name")));
      params.put("contact_email", email);
      params.put("phone", str(request.get("phone")));
      params.put("website", str(request.get("website")));
      params.put("geographic_scope",
          firstNonBlank(str(request.get("geographic_scope")), "National"));
      params.put("challenge_title", str(request.get("challenge_title")));
      params.put("challenge_description", str(request.get("challenge_description")));
      params.put("audience", str(request.get("audience")));
      params.put("audience_size", str(request.get("audience_size")));
      params.put("estimated_budget", str(request.get("estimated_budget")));
      params.put("launch_timing", str(request.get("launch_timing")));

      JsonNode result = upstream.postTo(upstream.sibling("publicChallengeApi"), params).body();

      String error = result.path("error").asText("");
      if (!error.isEmpty()) {
        boolean duplicate = result.path("duplicate").asBoolean(false);
        // A duplicate is 409 rather than 400: nothing is wrong with the
        // submission, it has simply already been sent.
        return ResponseEntity.status(duplicate ? 409 : 400)
            .body(Map.of("error", error, "duplicate", duplicate));
      }

      verification.consume(token);
      return ResponseEntity.ok(Map.of(
          "success", true,
          "application_id", firstNonBlank(
              result.path("application_id").asText(""), result.path("id").asText(""))));
    } catch (Exception e) {
      log.error("sponsorApplication failed", e);
      return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
    }
  }

  private static String firstNonBlank(String... values) {
    for (String v : values) {
      if (v != null && !v.isBlank()) {
        return v;
      }
    }
    return "";
  }

  private static String str(Object v) {
    return v == null ? "" : String.valueOf(v);
  }
}
