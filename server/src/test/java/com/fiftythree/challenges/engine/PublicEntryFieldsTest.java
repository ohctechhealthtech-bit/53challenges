package com.fiftythree.challenges.engine;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * What the unauthenticated entry listing is allowed to publish.
 *
 * <p>The listing action takes no session and returns approved entries to
 * anyone. It used to serialise the whole EntryEntity and remove creator_email,
 * and that entity carries the guardian's name, email, mobile and address — so
 * an approved child's entry would have published their household's contact
 * details to the open internet. Nothing was exposed in practice only because
 * no entry had yet passed the approval filter.
 *
 * <p>Reading the source is the point: the risk is not a wrong value today, it
 * is someone restoring whole-entity serialisation later and the fields
 * arriving back silently.
 */
class PublicEntryFieldsTest {

  private static final Path SOURCE = Path.of(
      "src/main/java/com/fiftythree/challenges/engine/ChallengeEngineController.java");

  /** Contact details, and the flags that would identify a child. */
  private static final List<String> MUST_NOT_PUBLISH = List.of(
      "getCreatorEmail", "getGuardianName", "getGuardianEmail",
      "getGuardianMobile", "getGuardianAddress", "getIsMinor",
      "getGuardianApprovalStatus");

  @Test
  void theProjectionReadsNoPersonalField() throws Exception {
    String source = Files.readString(SOURCE);
    int start = source.indexOf("private static Map<String, Object> publicEntry");
    assertTrue(start > 0, "publicEntry is gone — the listing is building its rows some other way");
    int end = source.indexOf("\n  }", start);
    String body = source.substring(start, end);

    for (String getter : MUST_NOT_PUBLISH) {
      assertFalse(body.contains(getter),
          "publicEntry reads " + getter + ", which the unauthenticated listing publishes");
    }
  }

  @Test
  void noEntityIsSerialisedWholesaleIntoAnEntryResponse() throws Exception {
    String source = Files.readString(SOURCE);
    assertFalse(source.contains("convertValue(e,") || source.contains("convertValue(entry,"),
        "an entry is being serialised wholesale again; name the fields, as publicEntry does");
  }
}
