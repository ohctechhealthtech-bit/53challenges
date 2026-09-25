package com.fiftythree.challenges.misc;

import com.fiftythree.challenges.entity.AgeAttestationEntity;
import com.fiftythree.challenges.security.CallerResolver;
import java.time.Instant;
import java.time.LocalDate;
import java.time.Period;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * The Java replacement for {@code recordAgeGate}: records a self-declared date
 * of birth and refuses accounts for children under 16.
 *
 * <p>The under-16 rule is a child-safety control, not a product preference:
 * someone below that age must have an account created by a parent or guardian.
 * A blocked attempt is still written to {@code age_attestation} with status
 * {@code blocked_underage}, so the refusal is on record rather than leaving no
 * trace of it.
 */
@RestController
public class AgeGateController {

  private static final Logger log = LoggerFactory.getLogger(AgeGateController.class);

  private static final int MIN_SELF_REGISTER_AGE = 16;
  /** Above this, the date is a typo rather than a person. */
  private static final int MAX_PLAUSIBLE_AGE = 120;

  private final AgeAttestationQueryRepository attestations;
  private final CallerResolver caller;

  public AgeGateController(AgeAttestationQueryRepository attestations, CallerResolver caller) {
    this.attestations = attestations;
    this.caller = caller;
  }

  @PostMapping("/api/apps/{appId}/functions/recordAgeGate")
  public ResponseEntity<?> handle(@RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> request = body == null ? Map.of() : body;
    String email = caller.email(str(request.get("session_token")));
    if (email == null) {
      return ResponseEntity.status(401).body(Map.of("error", "You must be signed in."));
    }

    try {
      if ("status".equals(str(request.get("action")))) {
        List<AgeAttestationEntity> rows = attestations.findLatestByEmail(email);
        AgeAttestationEntity row = rows.isEmpty() ? null : rows.get(0);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("ok", row != null && "confirmed".equals(nz(row.getStatus())));
        out.put("status", row == null ? "missing" : nz(row.getStatus()));
        out.put("age_years", row == null ? null : row.getAgeYears());
        return ResponseEntity.ok(out);
      }

      String dob = str(request.get("date_of_birth"));
      Integer age = ageFrom(dob);
      if (age == null) {
        return ResponseEntity.badRequest().body(Map.of("error", "Enter a valid date of birth."));
      }

      if (age < MIN_SELF_REGISTER_AGE) {
        // Recorded before the refusal is returned, so an under-age attempt
        // leaves an audit trail even though the account is not created.
        save(email, dob, age, "blocked_underage");
        return ResponseEntity.status(403).body(Map.of(
            "error", "Accounts for people under 16 must be created by a parent or guardian.",
            "blocked", true,
            "age", age));
      }

      save(email, dob, age, "confirmed");
      return ResponseEntity.ok(Map.of("ok", true, "age", age));
    } catch (Exception e) {
      log.error("recordAgeGate failed", e);
      return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
    }
  }

  private void save(String email, String dob, int age, String status) {
    AgeAttestationEntity row = new AgeAttestationEntity();
    row.setId(UUID.randomUUID().toString().replace("-", "").substring(0, 24));
    row.setEmail(email);
    row.setDateOfBirth(LocalDate.parse(dob));
    row.setAgeYears((double) age);
    row.setStatus(status);
    row.setUserId("");
    row.setCreatedDate(Instant.now());
    row.setUpdatedDate(Instant.now());
    row.setIsSample(false);
    attestations.save(row);
  }

  /**
   * Age in whole years from a YYYY-MM-DD date, or null when the input is not a
   * real date.
   *
   * <p>The format is checked strictly. {@code LocalDate.parse} rejects
   * "2010-02-30" outright, which is the behaviour wanted here: a gate that
   * quietly rolls an impossible date forward to a valid one would let a wrong
   * answer through. Ages are computed in UTC so the result does not depend on
   * the server's timezone.
   */
  private static Integer ageFrom(String iso) {
    String s = iso == null ? "" : iso.trim();
    if (!s.matches("\\d{4}-\\d{2}-\\d{2}")) {
      return null;
    }
    try {
      LocalDate dob = LocalDate.parse(s);
      int age = Period.between(dob, LocalDate.now(ZoneOffset.UTC)).getYears();
      return age < 0 || age > MAX_PLAUSIBLE_AGE ? null : age;
    } catch (DateTimeParseException e) {
      return null;
    }
  }

  private static String nz(String v) {
    return v == null ? "" : v;
  }

  private static String str(Object v) {
    return v == null ? "" : String.valueOf(v);
  }
}
