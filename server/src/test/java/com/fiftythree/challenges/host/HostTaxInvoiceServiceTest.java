package com.fiftythree.challenges.host;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * The invoice must agree with what Stripe charged, to the cent.
 *
 * <p>Hosts were charged one amount and the admin view showed another. These
 * tests hold the invoice to the charged total: GST is one eleventh of it, the
 * lines add up to it, and an itemisation that does not add up is replaced by
 * a single line rather than printed wrong.
 */
class HostTaxInvoiceServiceTest {

  private final HostTaxInvoiceService gstRegistered = new HostTaxInvoiceService(
      null, new ObjectMapper(), "53 Challenges", "12 345 678 901", "", true, "");
  private final HostTaxInvoiceService notRegistered = new HostTaxInvoiceService(
      null, new ObjectMapper(), "53 Challenges", "", "", false, "");

  @Test
  void gstIsOneEleventhOfTheChargedTotal() {
    Map<String, Object> b = gstRegistered.breakdown(119900, null, "Challenge application");
    assertEquals(119900L, b.get("total_cents"));
    assertEquals(10900L, b.get("gst_cents"));
    assertEquals(109000L, b.get("ex_gst_cents"));
  }

  @Test
  void itemisedLinesAreUsedOnlyWhenTheyAddUpToTheCharge() {
    Map<String, Object> price = Map.of("line_items", List.of(
        Map.of("name", "Supported package", "amount", 149.00),
        Map.of("name", "Legal review", "amount", 1050.00)));
    Map<String, Object> b = gstRegistered.breakdown(119900, price, "x");
    assertEquals(2, ((List<?>) b.get("lines")).size());
  }

  @Test
  void linesThatDisagreeWithTheChargeBecomeOneLine() {
    Map<String, Object> price = Map.of("line_items", List.of(
        Map.of("name", "Something", "amount", 1050.00)));
    Map<String, Object> b = gstRegistered.breakdown(119900, price, "Challenge application");
    List<?> lines = (List<?>) b.get("lines");
    assertEquals(1, lines.size());
    assertEquals(119900L, ((Map<?, ?>) lines.get(0)).get("amount_cents"));
  }

  @Test
  void noGstWhenNotRegistered() {
    Map<String, Object> b = notRegistered.breakdown(119900, null, "x");
    assertEquals(0L, b.get("gst_cents"));
    assertEquals(119900L, b.get("ex_gst_cents"));
  }

  @Test
  void moneyFormatsAsAustralianDollars() {
    assertEquals("A$1,199.00", HostTaxInvoiceService.money(119900));
  }
}
