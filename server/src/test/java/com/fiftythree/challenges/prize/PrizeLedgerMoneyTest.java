package com.fiftythree.challenges.prize;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.lang.reflect.Method;
import org.junit.jupiter.api.Test;

/**
 * What the prize ledger will accept as money.
 *
 * <p>This is the record of what was promised in prize money, so a figure that
 * cannot be read should be refused rather than stored as something plausible.
 * The shared toDouble answers 0 for anything unparseable — a reasonable
 * default for a filter and a bad one for a payout.
 */
class PrizeLedgerMoneyTest {

  private static Object call(String name, Object argument) throws Exception {
    Method m = PrizeLedgerController.class.getDeclaredMethod(name, Object.class);
    m.setAccessible(true);
    return m.invoke(null, argument);
  }

  @Test
  void ordinaryAmountsAreAccepted() throws Exception {
    assertEquals(0d, call("money", 0));
    assertEquals(2500d, call("money", 2500));
    assertEquals(199.95d, call("money", "199.95"));
  }

  @Test
  void anAbsentAmountIsZeroRatherThanAFailure() throws Exception {
    assertEquals(0d, call("money", null));
  }

  @Test
  void negativeAndNonFiniteAmountsAreRefused() throws Exception {
    assertNull(call("money", -1));
    assertNull(call("money", "-0.01"));
    assertNull(call("money", Double.POSITIVE_INFINITY));
    assertNull(call("money", Double.NaN));
  }

  @Test
  void currencyIsAThreeLetterCodeOrTheDefault() throws Exception {
    assertEquals("AUD", call("currency", "aud"));
    assertEquals("USD", call("currency", " usd "));
    // Free text was accepted before; anything that is not a code falls back
    // rather than being stored as the currency of a real payout.
    assertEquals("AUD", call("currency", "Australian Dollars"));
    assertEquals("AUD", call("currency", ""));
    assertEquals("AUD", call("currency", null));
  }
}
