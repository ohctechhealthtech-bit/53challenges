package com.fiftythree.challenges.auth;

import com.fiftythree.challenges.llm.LlmClient;
import com.fiftythree.challenges.mail.MailService;
import com.fiftythree.challenges.payments.StripeClient;
import com.fiftythree.challenges.security.JwtService;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.Valid;
import java.sql.Connection;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.Map;
import javax.sql.DataSource;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.info.BuildProperties;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class AuthController {

  private final UpstreamAuthClient upstream;
  private final JwtService jwt;
  private final DataSource dataSource;
  private final String buildStamp;
  private final StripeClient stripe;
  private final MailService mail;
  private final LlmClient llm;

  public AuthController(
      UpstreamAuthClient upstream,
      JwtService jwt,
      DataSource dataSource,
      ObjectProvider<BuildProperties> build,
      StripeClient stripe,
      MailService mail,
      LlmClient llm) {
    this.stripe = stripe;
    this.mail = mail;
    this.llm = llm;
    this.upstream = upstream;
    this.jwt = jwt;
    this.dataSource = dataSource;
    // Absent when the app runs from an IDE rather than a packaged jar, which
    // is fine: the stamp exists to identify a deployed artefact.
    BuildProperties properties = build.getIfAvailable();
    this.buildStamp = properties == null || properties.getTime() == null
        ? "dev"
        : DateTimeFormatter.ISO_INSTANT.format(properties.getTime());
  }

  /**
   * Health probe — process up AND database reachable.
   *
   * <p>The database check is not decoration. This endpoint originally reported
   * {@code ok} without touching the datasource, and {@code /api/auth/me}
   * returns a role that falls back to "user" when the lookup throws. Between
   * them, both endpoints answered 200 for hours while the JDBC URL was
   * malformed and no query had ever succeeded. A health check that cannot fail
   * is not a health check.
   *
   * <p>Returns 503 when the database is unreachable, so the failure is visible
   * to a probe rather than only in the logs.
   */
  @GetMapping("/health")
  public ResponseEntity<Map<String, Object>> health() {
    try (Connection connection = dataSource.getConnection()) {
      if (connection.isValid(2)) {
        return ResponseEntity.ok(status("ok", "ok"));
      }
      return ResponseEntity.status(503).body(status("degraded", "invalid connection"));
    } catch (Exception e) {
      // Exception, not SQLException: a pool that cannot hand out a connection
      // throws unchecked types too, and one escaping here produces an empty
      // response — the least useful possible answer from a health check.
      return ResponseEntity.status(503).body(status("degraded", String.valueOf(e.getMessage())));
    }
  }

  /**
   * The health payload, including which build is answering.
   *
   * <p>The build stamp is here because working out which jar is live has
   * repeatedly meant sshing in to check a file size. A deploy that silently
   * did not take looks exactly like one that did, and the difference only
   * shows up later as a feature that is missing for no reason.
   */
  private Map<String, Object> status(String status, String database) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("status", status);
    out.put("database", database);
    out.put("build", buildStamp);
    // Which optional integrations have credentials, as booleans only. Whether
    // a key is present is operational information worth being able to check
    // from outside; the key itself never appears here, and neither does any
    // hint of its value.
    Map<String, Boolean> integrations = new LinkedHashMap<>();
    integrations.put("stripe", stripe.isConfigured());
    integrations.put("mail", mail.isConfigured());
    integrations.put("llm", llm.isConfigured());
    out.put("integrations", integrations);
    return out;
  }

  @PostMapping("/auth/login")
  public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request) {
    var user = upstream.login(request.email().toLowerCase().trim(), request.password());
    if (user == null) {
      // One message for both "no such account" and "wrong password", so the
      // endpoint cannot be used to enumerate registered addresses.
      return ResponseEntity.status(401).body(Map.of("error", "Invalid email or password."));
    }
    String token = jwt.issue(user.email(), user.name(), user.uid());
    return ResponseEntity.ok(Map.of(
        "success", true,
        "session_token", token,
        "user", Map.of("email", user.email(), "full_name", user.name(), "id", user.uid())));
  }

  /** The signed-in caller, for the client to confirm a token is still good. */
  @GetMapping("/auth/me")
  public Map<String, Object> me(Authentication authentication) {
    return Map.of(
        "email", authentication.getName(),
        "authorities", authentication.getAuthorities());
  }

  public record LoginRequest(
      @NotBlank @Email String email,
      @NotBlank String password) {}
}
