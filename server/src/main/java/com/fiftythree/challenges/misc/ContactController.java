package com.fiftythree.challenges.misc;

import com.fiftythree.challenges.mail.MailService;
import com.fiftythree.challenges.support.RateLimiter;
import com.fiftythree.challenges.user.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Duration;
import java.util.Map;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Limit;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * The contact form.
 *
 * <p>The page had a form that set "thanks, we'll be in touch" and sent
 * nothing — a comment in it said a backend would do this one day. Anyone who
 * used it believed they had made contact and never heard back, which is worse
 * than having no form.
 *
 * <p><b>Unauthenticated by necessity, so rate limited.</b> A contact form
 * cannot require a login, and this one sends mail to every admin — which
 * makes it a relay worth abusing. Submissions are capped per source address,
 * fields are length-limited, and the body is assembled here rather than from
 * anything the sender supplies, so it cannot be used to forge a message that
 * appears to come from us.
 */
@RestController
public class ContactController {

  private static final Logger log = LoggerFactory.getLogger(ContactController.class);

  /** Enough for a real enquiry, far short of useful for a spam payload. */
  private static final int MAX_NAME = 200;
  private static final int MAX_SUBJECT = 200;
  private static final int MAX_MESSAGE = 5000;


  /** Deliberately conservative: it rejects some valid addresses, and that is
   * the right trade for a form that turns into outbound mail. */
  private static final Pattern EMAIL =
      Pattern.compile("^[^@ \t]+@[^@ \t.]+[.][^@ \t]+$");

  private static final int MAX_ADMINS = 5;

  private final MailService mail;
  private final UserRepository users;

  /**
   * Submissions per source address.
   *
   * <p>Five an hour is generous for a contact form and useless as a relay.
   */
  private final RateLimiter submissions = new RateLimiter(5, Duration.ofHours(1));

  public ContactController(MailService mail, UserRepository users) {
    this.mail = mail;
    this.users = users;
  }

  @PostMapping("/api/apps/{appId}/functions/contactUs")
  public ResponseEntity<?> handle(
      @RequestBody(required = false) Map<String, Object> body, HttpServletRequest http) {

    Map<String, Object> request = body == null ? Map.of() : body;
    String name = trimmed(request.get("name"), MAX_NAME);
    String email = trimmed(request.get("email"), MAX_NAME).toLowerCase();
    String subject = trimmed(request.get("subject"), MAX_SUBJECT);
    String message = trimmed(request.get("message"), MAX_MESSAGE);

    if (name.isEmpty() || email.isEmpty() || message.isEmpty()) {
      return ResponseEntity.badRequest()
          .body(Map.of("error", "Name, email and message are required."));
    }
    if (!EMAIL.matcher(email).matches()) {
      return ResponseEntity.badRequest()
          .body(Map.of("error", "That email address does not look right."));
    }
    if (!submissions.allow(clientAddress(http))) {
      return ResponseEntity.status(429)
          .body(Map.of("error", "Too many messages from here. Please try again later."));
    }

    String assembled = "From: " + name + " <" + email + ">\n\n"
        + (subject.isEmpty() ? "" : "Subject: " + subject + "\n\n")
        + message
        + "\n\n— sent from the contact form on 53challenges.com";

    int sent = 0;
    for (String admin : users.findAdminEmails(Limit.of(MAX_ADMINS))) {
      if (mail.send(admin, "Contact form: " + (subject.isEmpty() ? "no subject" : subject),
          assembled)) {
        sent++;
      }
    }

    if (sent == 0) {
      // Never report success for a message nobody received — that is the bug
      // this endpoint exists to fix.
      log.error("Contact form message from {} reached no admin", email);
      return ResponseEntity.status(502).body(Map.of("error",
          "We could not deliver your message. Please email us directly."));
    }
    return ResponseEntity.ok(Map.of("ok", true));
  }

  /**
   * The caller's address.
   *
   * <p>{@code server.forward-headers-strategy: framework} is set, so Spring
   * has already applied X-Forwarded-For from our nginx by the time this runs
   * and getRemoteAddr returns the real client. Parsing the header again here
   * would second-guess that, and get it wrong the day the proxy changes.
   */
  private static String clientAddress(HttpServletRequest http) {
    String address = http.getRemoteAddr();
    return address == null || address.isBlank() ? "unknown" : address;
  }

  private static String trimmed(Object value, int max) {
    if (value == null) {
      return "";
    }
    String text = String.valueOf(value).trim();
    return text.length() <= max ? text : text.substring(0, max);
  }
}
