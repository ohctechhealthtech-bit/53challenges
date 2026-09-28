package com.fiftythree.challenges.misc;

import com.fiftythree.challenges.mail.MailService;
import com.fiftythree.challenges.user.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
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

  private static final int MAX_PER_WINDOW = 5;
  private static final Duration WINDOW = Duration.ofHours(1);

  /** Deliberately conservative: it rejects some valid addresses, and that is
   * the right trade for a form that turns into outbound mail. */
  private static final Pattern EMAIL =
      Pattern.compile("^[^@ \t]+@[^@ \t.]+[.][^@ \t]+$");

  private static final int MAX_ADMINS = 5;

  private final MailService mail;
  private final UserRepository users;

  /**
   * Recent submissions per source address.
   *
   * <p>In memory, so it resets on restart and is per-instance. That is
   * adequate for a contact form — it stops the obvious flood without needing
   * shared state — and it is stated plainly rather than implied.
   */
  private final Map<String, Window> recent = new LinkedHashMap<>() {
    @Override
    protected boolean removeEldestEntry(Map.Entry<String, Window> eldest) {
      // Bounded, so the limiter cannot itself become the memory leak.
      return size() > 10_000;
    }
  };

  private record Window(Instant start, int count) {}

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
    if (!allow(clientAddress(http))) {
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

  /** Whether this source may send another message now. */
  private synchronized boolean allow(String key) {
    Instant now = Instant.now();
    Window window = recent.get(key);
    if (window == null || window.start().isBefore(now.minus(WINDOW))) {
      recent.put(key, new Window(now, 1));
      return true;
    }
    if (window.count() >= MAX_PER_WINDOW) {
      return false;
    }
    recent.put(key, new Window(window.start(), window.count() + 1));
    return true;
  }

  /**
   * The caller's address as nginx saw it.
   *
   * <p>Only the first hop of X-Forwarded-For is taken, and only because this
   * app sits behind our own proxy which sets it. A client can append to that
   * header, so the last entries are not trustworthy — but the first is what
   * our nginx recorded.
   */
  private static String clientAddress(HttpServletRequest http) {
    String forwarded = http.getHeader("X-Forwarded-For");
    if (forwarded != null && !forwarded.isBlank()) {
      return forwarded.split(",")[0].trim();
    }
    return http.getRemoteAddr() == null ? "unknown" : http.getRemoteAddr();
  }

  private static String trimmed(Object value, int max) {
    if (value == null) {
      return "";
    }
    String text = String.valueOf(value).trim();
    return text.length() <= max ? text : text.substring(0, max);
  }
}
