package com.fiftythree.challenges.entry;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

/**
 * An entry needs age evidence the server put there itself.
 *
 * <p>The attested age is authoritative when it exists. When it did not, the
 * decision fell back to is_minor, derived_age and the division — every one of
 * them from the request body. That made the browser's age gate, a localStorage
 * flag, the only thing between a minor and skipping guardian consent: set the
 * flag, never attest, submit is_minor:false in an adult division, and nothing
 * on the server contradicted it.
 *
 * <p>This reads the source because the rule is an ordering property, not a
 * value: the check has to come before the fallback, or the fallback decides.
 */
class AgeEvidenceRequiredTest {

  private static final Path SOURCE = Path.of(
      "src/main/java/com/fiftythree/challenges/entry/SubmitChallengeEntryController.java");

  @Test
  void anEntryIsRefusedWhenNoAttestationIsOnRecord() throws Exception {
    String source = Files.readString(SOURCE);
    assertTrue(source.contains("needs_age_check"),
        "submission no longer refuses an entrant with no age attestation;"
            + " without it is_minor from the request body decides again");
  }

  @Test
  void theRefusalComesBeforeTheBodyIsConsulted() throws Exception {
    String source = Files.readString(SOURCE);
    int refusal = source.indexOf("needs_age_check");
    int fallback = source.indexOf("truthy(entry.get(\"is_minor\"))");
    assertTrue(refusal > 0 && fallback > 0, "one of the two markers has moved");
    assertTrue(refusal < fallback,
        "the age-evidence check must run before is_minor from the body is read,"
            + " or an entrant with no attestation reaches the fallback anyway");
  }
}
