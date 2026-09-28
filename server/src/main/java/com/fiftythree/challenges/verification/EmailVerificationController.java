package com.fiftythree.challenges.verification;

import com.fiftythree.challenges.support.ApiErrors;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * The Java replacement for the {@code emailVerification} function.
 *
 * <p>Public by necessity: sponsors, judges and guardians must be able to verify
 * an address before they have an account at all.
 *
 * <pre>
 *   {action: 'send',   email, purpose} -> {success, expires_at}
 *   {action: 'verify', email, purpose, code} -> {success, verification_token}
 * </pre>
 */
@RestController
public class EmailVerificationController {

  private static final Logger log = LoggerFactory.getLogger(EmailVerificationController.class);

  private final EmailVerificationService verification;

  public EmailVerificationController(EmailVerificationService verification) {
    this.verification = verification;
  }

  @PostMapping("/api/apps/{appId}/functions/emailVerification")
  public ResponseEntity<?> handle(@RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> request = body == null ? Map.of() : body;
    String purpose = str(request.get("purpose"));

    // The purpose is checked against a fixed list first. It decides which OTP
    // template the main site sends, so an unrecognised one must be refused here
    // rather than forwarded.
    if (!verification.isKnownPurpose(purpose)) {
      return ResponseEntity.badRequest().body(Map.of("error", "Unknown verification purpose"));
    }

    String action = str(request.get("action"));
    try {
      if ("send".equals(action)) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("success", true);
        out.putAll(verification.send(str(request.get("email")), purpose));
        return ResponseEntity.ok(out);
      }
      if ("verify".equals(action)) {
        Map<String, Object> result =
            verification.confirm(str(request.get("email")), purpose, str(request.get("code")));
        if (result.containsKey("error")) {
          return ResponseEntity.badRequest().body(result);
        }
        return ResponseEntity.ok(result);
      }
      return ResponseEntity.badRequest().body(Map.of("error", "Unknown action: " + action));
    } catch (IllegalArgumentException | IllegalStateException e) {
      // These carry a message written for the person reading it, so it is
      // returned rather than replaced with something generic.
      return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
    } catch (Exception e) {
      log.error("emailVerification action '{}' failed", action, e);
      return ApiErrors.internal(e);
    }
  }

  private static String str(Object v) {
    return v == null ? "" : String.valueOf(v);
  }
}
