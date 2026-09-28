package com.fiftythree.challenges.judging;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.lang.reflect.Method;
import org.junit.jupiter.api.Test;

/**
 * How a category is normalised before a declaration is stored.
 *
 * <p>Categories arrive spelled several ways, and a judge who declared for
 * "Visual Arts" must not be asked again for "visual-arts". The frontend
 * normalises the same way; if the two drift, the gate reappears on entries
 * the judge has already cleared.
 */
class JudgeAttestationTest {

  private static String norm(String category) throws Exception {
    Method m = JudgeApiController.class.getDeclaredMethod("normaliseCategory", String.class);
    m.setAccessible(true);
    return (String) m.invoke(null, category);
  }

  @Test
  void theThreeSpellingsOfACategoryAreOne() throws Exception {
    assertEquals("visual_arts", norm("visual-arts"));
    assertEquals("visual_arts", norm("visual_arts"));
    assertEquals("visual_arts", norm("Visual Arts"));
    assertEquals("visual_arts", norm("  VISUAL   ARTS  "));
  }

  /** A declaration with no category covers everything rather than nothing. */
  @Test
  void anAbsentCategoryBecomesAll() throws Exception {
    assertEquals("all", norm(null));
    assertEquals("all", norm(""));
    assertEquals("all", norm("   "));
  }

  @Test
  void separatorRunsCollapseToOne() throws Exception {
    assertEquals("music_dance_performance", norm("Music - Dance _ Performance"));
  }
}
