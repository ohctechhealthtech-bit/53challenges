package com.fiftythree.challenges.plesk;

import com.fiftythree.challenges.entity.AdminSslConfigurationEntity;
import com.fiftythree.challenges.entity.AdminSslConfigurationRepository;
import com.fiftythree.challenges.security.CallerResolver;
import com.fiftythree.challenges.support.ApiErrors;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * The Java replacement for {@code manageAdminSsl}: the default certificate
 * used for challenge subdomains.
 *
 * <p><b>Only metadata ever leaves this endpoint.</b> The certificate and key
 * are written to private storage and the response carries the display name,
 * status and expiry — never the file contents, and never the paths. A private
 * key that reaches a browser is compromised, whoever the browser belonged to.
 *
 * <p>The PEM markers are checked before anything is stored, so a wrong file
 * chosen in the upload dialogue is refused immediately rather than discovered
 * later when a subdomain fails to serve HTTPS. A key bundled inside the
 * certificate PEM is accepted and split out, because that is how several
 * certificate authorities hand them over.
 */
@RestController
public class AdminSslController {

  private static final Logger log = LoggerFactory.getLogger(AdminSslController.class);

  private static final String CERTIFICATE_MARKER = "-----BEGIN CERTIFICATE-----";

  private static final Pattern PRIVATE_KEY_BLOCK = Pattern.compile(
      "-----BEGIN (?:RSA )?PRIVATE KEY-----[\\s\\S]*?-----END (?:RSA )?PRIVATE KEY-----");

  private final AdminSslConfigurationRepository configurations;
  private final PrivateFileStore files;
  private final CallerResolver caller;

  public AdminSslController(
      AdminSslConfigurationRepository configurations,
      PrivateFileStore files,
      CallerResolver caller) {
    this.configurations = configurations;
    this.files = files;
    this.caller = caller;
  }

  @PostMapping("/api/apps/{appId}/functions/manageAdminSsl")
  public ResponseEntity<?> handle(@RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> request = body == null ? Map.of() : body;
    String sessionToken = str(request.get("session_token"));
    if (!caller.isAdmin(sessionToken)) {
      return ResponseEntity.status(403).body(Map.of(
          "error", "Only admins can manage default SSL"));
    }

    String action = strOr(request.get("action"), "get");
    try {
      return switch (action) {
        case "get" -> get();
        case "save" -> save(request, caller.email(sessionToken));
        default -> ResponseEntity.status(400).body(
            Map.of("error", "Unknown action: " + action));
      };
    } catch (PrivateFileStore.StorageException e) {
      return ApiErrors.internal(e);
    } catch (Exception e) {
      // Deliberately opaque. This handler has had certificate and key material
      // in scope, and an exception message here could carry a fragment of it.
      log.error("manageAdminSsl action '{}' failed", action, e);
      return ResponseEntity.status(500).body(Map.of(
          "error", "Could not manage SSL configuration"));
    }
  }

  private ResponseEntity<?> get() {
    Optional<AdminSslConfigurationEntity> active = configurations.findAll().stream()
        .filter(c -> Boolean.TRUE.equals(c.getIsActive()))
        .findFirst();

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("ok", true);
    out.put("configuration", active.map(AdminSslController::metadata).orElse(null));
    return ResponseEntity.ok(out);
  }

  private ResponseEntity<?> save(Map<String, Object> request, String actorEmail) {
    String name = str(request.get("name"));
    if (name == null) {
      return ResponseEntity.status(400).body(Map.of(
          "error", "Certificate display name is required"));
    }
    String certBase64 = str(request.get("cert_content_b64"));
    if (certBase64 == null) {
      return ResponseEntity.status(400).body(Map.of(
          "error", "SSL certificate file is required"));
    }
    String keyBase64 = str(request.get("key_content_b64"));
    if (keyBase64 == null) {
      return ResponseEntity.status(400).body(Map.of(
          "error", "SSL private key file is required"));
    }

    String certificate;
    try {
      certificate = decode(certBase64);
    } catch (IllegalArgumentException e) {
      return ResponseEntity.status(400).body(Map.of(
          "error", "Could not decode certificate file"));
    }
    String key;
    try {
      key = decode(keyBase64);
    } catch (IllegalArgumentException e) {
      return ResponseEntity.status(400).body(Map.of(
          "error", "Could not decode private key file"));
    }

    if (!certificate.contains(CERTIFICATE_MARKER)) {
      return ResponseEntity.status(400).body(Map.of(
          "error", "Certificate file must contain " + CERTIFICATE_MARKER));
    }

    if (!PRIVATE_KEY_BLOCK.matcher(key).find()) {
      // Several authorities hand over one PEM containing both, and people
      // upload that file twice rather than splitting it.
      Matcher embedded = PRIVATE_KEY_BLOCK.matcher(certificate);
      if (embedded.find()) {
        key = embedded.group();
      } else {
        return ResponseEntity.status(400).body(Map.of("error",
            "Private key must contain -----BEGIN PRIVATE KEY----- "
                + "or -----BEGIN RSA PRIVATE KEY-----"));
      }
    }

    if (!files.isConfigured()) {
      return ResponseEntity.status(500).body(Map.of("error",
          "Private file storage is not configured. Set PRIVATE_FILES_DIR."));
    }

    String certificatePath = files.write("default-cert", certificate);
    String keyPath = files.write("default-key", key);

    Instant now = Instant.now();
    // Exactly one configuration is active, so provisioning never has to choose
    // between two certificates.
    for (AdminSslConfigurationEntity existing : configurations.findAll()) {
      if (Boolean.TRUE.equals(existing.getIsActive())) {
        existing.setIsActive(false);
        existing.setUpdatedDate(now);
        configurations.save(existing);
      }
    }

    AdminSslConfigurationEntity configuration = new AdminSslConfigurationEntity();
    configuration.setId(newId());
    configuration.setName(name);
    configuration.setCertificateFileReference(certificatePath);
    configuration.setPrivateKeyFileReference(keyPath);
    configuration.setCertificateStatus("configured");
    configuration.setExpiresAt(parseDate(str(request.get("expires_at"))));
    configuration.setIsActive(true);
    configuration.setUpdatedBy(actorEmail == null ? "" : actorEmail);
    configuration.setCreatedDate(now);
    configuration.setUpdatedDate(now);
    configuration.setIsSample(false);
    configurations.save(configuration);

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("ok", true);
    out.put("configuration", metadata(configuration));
    return ResponseEntity.ok(out);
  }

  /** Metadata only — no file references, no content. */
  private static Map<String, Object> metadata(AdminSslConfigurationEntity c) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", c.getId());
    out.put("name", c.getName());
    out.put("certificate_status", c.getCertificateStatus());
    out.put("expires_at", c.getExpiresAt() == null ? "" : c.getExpiresAt().toString());
    out.put("is_active", Boolean.TRUE.equals(c.getIsActive()));
    out.put("updated_at", c.getUpdatedDate() == null ? "" : c.getUpdatedDate().toString());
    out.put("updated_by", c.getUpdatedBy() == null ? "" : c.getUpdatedBy());
    return out;
  }

  private static String decode(String base64) {
    return new String(Base64.getDecoder().decode(base64),
        java.nio.charset.StandardCharsets.UTF_8);
  }

  /** An unparseable expiry is left unset rather than failing the upload. */
  private static LocalDate parseDate(String value) {
    if (value == null || value.isBlank()) {
      return null;
    }
    try {
      return LocalDate.parse(value.length() > 10 ? value.substring(0, 10) : value);
    } catch (Exception e) {
      log.warn("Ignoring unparseable certificate expiry '{}'", value);
      return null;
    }
  }

  private static String strOr(Object value, String fallback) {
    String text = str(value);
    return text == null ? fallback : text;
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
