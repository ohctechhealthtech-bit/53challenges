package com.fiftythree.challenges.mail;

import com.fiftythree.challenges.entity.GuardianApprovalRequestEntity;
import com.fiftythree.challenges.entity.GuardianApprovalRequestRepository;
import com.fiftythree.challenges.security.CallerResolver;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

/**
 * The Java replacement for {@code guardianStatusNotify}: tells a guardian an
 * approval is waiting, and tells the entrant what was decided.
 *
 * <p><b>Notification is not the gate.</b> The entry is already on hold in the
 * database and the Guardian Dashboard is the channel that always works; this
 * is a prompt to go and look at it. So a send that fails returns
 * {@code sent: false} with a 200 and changes nothing else — a bounced email
 * must never leave an entry in a different state than a delivered one.
 *
 * <p>{@code notified_at} is stamped only on a successful send, so it means
 * "we reached them", not "we tried".
 */
@RestController
public class GuardianNotifyController {

  private static final Logger log = LoggerFactory.getLogger(GuardianNotifyController.class);

  private final MailService mail;
  private final GuardianApprovalRequestRepository requests;
  private final CallerResolver caller;

  public GuardianNotifyController(
      MailService mail,
      GuardianApprovalRequestRepository requests,
      CallerResolver caller) {
    this.mail = mail;
    this.requests = requests;
    this.caller = caller;
  }

  @PostMapping("/api/apps/{appId}/functions/guardianStatusNotify")
  public ResponseEntity<?> handle(
      @RequestBody(required = false) Map<String, Object> body,
      @RequestHeader(value = "Origin", required = false) String origin) {

    Map<String, Object> request = body == null ? Map.of() : body;
    if (caller.email(str(request.get("session_token"))) == null) {
      return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
    }

    String requestId = str(request.get("request_id"));
    if (requestId == null) {
      return ResponseEntity.status(400).body(Map.of("error", "request_id required"));
    }
    Optional<GuardianApprovalRequestEntity> found = requests.findById(requestId);
    if (found.isEmpty()) {
      return ResponseEntity.status(404).body(Map.of("error", "Request not found"));
    }
    GuardianApprovalRequestEntity approval = found.get();
    String action = str(request.get("action"));

    return switch (action == null ? "" : action) {
      case "notify_request" -> notifyGuardian(approval, orEmpty(origin));
      case "notify_decision" -> notifyEntrant(approval);
      default -> ResponseEntity.status(400).body(Map.of("error", "Unknown action"));
    };
  }

  private ResponseEntity<?> notifyGuardian(GuardianApprovalRequestEntity r, String appUrl) {
    String subject = "Approval needed: " + orDefault(r.getChildName(), "your child")
        + " entered \"" + orDefault(r.getChallengeTitle(), "a challenge") + "\"";

    String body = String.join("\n",
        "Hi " + orDefault(r.getGuardianName(), "there") + ",",
        "",
        orDefault(r.getChildName(), "A young entrant") + " has submitted the entry \""
            + nz(r.getEntryTitle()) + "\" to the challenge \"" + nz(r.getChallengeTitle())
            + "\" on 53 Challenges and listed you as their parent/guardian.",
        "",
        "The entry stays on hold until you approve it. To review and approve or decline:",
        "1. Sign in (or register) on 53 Challenges with this email address.",
        "2. Open the Guardian Dashboard: " + appUrl + "/guardian",
        "",
        "If you did not expect this, you can decline the request with a reason "
            + "from the same page.");

    boolean sent = mail.send(r.getGuardianEmail(), subject, body);
    if (sent) {
      r.setNotifiedAt(Instant.now());
      r.setUpdatedDate(Instant.now());
      requests.save(r);
    }
    return ok(sent);
  }

  private ResponseEntity<?> notifyEntrant(GuardianApprovalRequestEntity r) {
    String status = nz(r.getStatus());
    String decision = switch (status) {
      case "approved" -> "approved";
      case "declined" -> "declined";
      default -> "updated";
    };

    String detail = "approved".equals(status)
        ? "Great news — your guardian approved your entry \"" + nz(r.getEntryTitle())
            + "\" for \"" + nz(r.getChallengeTitle())
            + "\". It now continues through the normal review process."
        : "Your guardian " + decision + " your entry \"" + nz(r.getEntryTitle())
            + "\" for \"" + nz(r.getChallengeTitle()) + "\"."
            + (isBlank(r.getDeclineReason()) ? "" : " Reason: " + r.getDeclineReason());

    String body = String.join("\n",
        "Hi " + orDefault(r.getChildName(), "there") + ",",
        "",
        detail);

    boolean sent = mail.send(r.getChildEmail(),
        "Your entry \"" + nz(r.getEntryTitle()) + "\" was " + decision + " by your guardian",
        body);
    return ok(sent);
  }

  private static ResponseEntity<?> ok(boolean sent) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("ok", true);
    out.put("sent", sent);
    return ResponseEntity.ok(out);
  }

  private static boolean isBlank(String value) {
    return value == null || value.isBlank();
  }

  private static String orDefault(String value, String fallback) {
    return isBlank(value) ? fallback : value;
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
}
