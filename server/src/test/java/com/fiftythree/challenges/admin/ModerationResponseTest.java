package com.fiftythree.challenges.admin;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Field;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;

/**
 * What a moderation decision is allowed to say back.
 *
 * <p>The decision response used to serialise the whole EntryEntity and remove
 * creator_email — a denylist. The entity also carries the guardian's name,
 * email, mobile and address, so a host confirming an approve or a reject on a
 * child's entry was handed that household's contact details, and any field
 * added to the entity later would have joined them without anyone deciding to
 * share it.
 *
 * <p>This test guards the shape of the entity rather than the response: if
 * someone reintroduces whole-entity serialisation, the list of what would
 * escape is here in plain sight.
 */
class ModerationResponseTest {

  private static Set<String> entryFieldNames() {
    return Arrays.stream(com.fiftythree.challenges.entity.EntryEntity.class.getDeclaredFields())
        .map(Field::getName)
        .collect(Collectors.toSet());
  }

  /** The fields that must never travel with a decision. */
  private static final List<String> PERSONAL = List.of(
      "creatorEmail", "guardianName", "guardianEmail", "guardianMobile", "guardianAddress");

  @Test
  void theEntityStillCarriesTheFieldsThisGuardsAgainst() {
    Set<String> fields = entryFieldNames();
    for (String personal : PERSONAL) {
      assertTrue(fields.contains(personal),
          personal + " is gone from EntryEntity — if it moved, move this test with it,"
              + " and if it was removed, this guard is one field weaker than it reads");
    }
  }

  /**
   * The decision response is built from four named values, so the only way a
   * personal field reaches it is by someone serialising the entity again.
   */
  @Test
  void theDecisionResponseNamesItsFields() throws Exception {
    String source = java.nio.file.Files.readString(java.nio.file.Path.of(
        "src/main/java/com/fiftythree/challenges/admin/ContentModerationController.java"));
    assertFalse(source.contains("mapper.convertValue"),
        "the decision response is serialising an entity again; build it field by field,"
            + " as queue() does");
  }
}
