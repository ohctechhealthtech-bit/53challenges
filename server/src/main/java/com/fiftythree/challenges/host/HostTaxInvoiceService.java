package com.fiftythree.challenges.host;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiftythree.challenges.entity.HostInvoiceEntity;
import com.fiftythree.challenges.mail.MailService;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * The paperwork for a host application payment: the breakdown recorded with
 * the charge, and the invoice emailed once Stripe confirms the money moved.
 *
 * <p>Until this existed, a host paid and received nothing but an in-app
 * notification, the local invoice row stored the amount with an empty list of
 * line items, and the only figure an admin ever saw was the one the parent app
 * wrote into its own request notes. The amount here is the amount Stripe
 * charged, to the cent, and everything else on the invoice is reconciled to it.
 *
 * <p>GST: prices are charged GST-inclusive, so the GST component is one
 * eleventh of the total. The document is titled "Tax invoice" only when an ABN
 * is configured — an Australian tax invoice for more than A$82.50 must show
 * the supplier's ABN, and this will not print one that does not exist.
 */
@Service
public class HostTaxInvoiceService {

  private static final Logger log = LoggerFactory.getLogger(HostTaxInvoiceService.class);
  private static final DateTimeFormatter DATE =
      DateTimeFormatter.ofPattern("d MMMM yyyy", Locale.ENGLISH).withZone(ZoneId.of("Australia/Brisbane"));

  private final MailService mail;
  private final ObjectMapper mapper;
  private final String businessName;
  private final String abn;
  private final String address;
  private final boolean gstRegistered;
  private final String adminEmail;

  public HostTaxInvoiceService(
      MailService mail,
      ObjectMapper mapper,
      @Value("${app.billing.business-name:53 Challenges}") String businessName,
      @Value("${app.billing.abn:}") String abn,
      @Value("${app.billing.address:}") String address,
      @Value("${app.billing.gst-registered:true}") boolean gstRegistered,
      @Value("${app.billing.admin-email:}") String adminEmail) {
    this.mail = mail;
    this.mapper = mapper;
    this.businessName = businessName == null ? "" : businessName.trim();
    this.abn = abn == null ? "" : abn.trim();
    this.address = address == null ? "" : address.trim();
    this.gstRegistered = gstRegistered;
    this.adminEmail = adminEmail == null ? "" : adminEmail.trim();
  }

  /**
   * The breakdown stored with a charge: lines, GST and total, in cents.
   *
   * <p>The lines come from the parent's quote when it itemises one. They are
   * only used if they add up to exactly what is being charged; otherwise a
   * single line carries the whole amount. An invoice whose lines disagree with
   * its total is worse than one with fewer lines.
   */
  public Map<String, Object> breakdown(long totalCents, Object parentPrice, String label) {
    List<Map<String, Object>> lines = linesFrom(parentPrice);
    long sum = lines.stream().mapToLong(l -> ((Number) l.get("amount_cents")).longValue()).sum();
    if (lines.isEmpty() || sum != totalCents) {
      lines = new ArrayList<>();
      lines.add(line(label == null || label.isBlank() ? "Challenge application" : label, totalCents));
    }
    long gst = gstRegistered ? Math.round(totalCents / 11d) : 0;

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("currency", "aud");
    out.put("lines", lines);
    out.put("total_cents", totalCents);
    out.put("gst_cents", gst);
    out.put("ex_gst_cents", totalCents - gst);
    out.put("gst_inclusive", gstRegistered);
    return out;
  }

  private List<Map<String, Object>> linesFrom(Object parentPrice) {
    List<Map<String, Object>> out = new ArrayList<>();
    if (parentPrice == null) {
      return out;
    }
    JsonNode price = mapper.valueToTree(parentPrice);
    for (String key : List.of("line_items", "items", "lines", "breakdown")) {
      JsonNode arr = price.path(key);
      if (!arr.isArray() || arr.isEmpty()) {
        continue;
      }
      for (JsonNode item : arr) {
        String name = firstText(item, "name", "label", "title", "description");
        double dollars = firstNumber(item, "amount", "price", "total", "unit_price");
        long cents = Math.round(dollars * 100d);
        if (!name.isEmpty() && cents > 0) {
          out.add(line(name, cents));
        }
      }
      return out;
    }
    return out;
  }

  private static Map<String, Object> line(String name, long cents) {
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("name", name);
    m.put("amount_cents", cents);
    return m;
  }

  private static String firstText(JsonNode n, String... keys) {
    for (String k : keys) {
      String v = n.path(k).asText("").trim();
      if (!v.isEmpty()) {
        return v;
      }
    }
    return "";
  }

  private static double firstNumber(JsonNode n, String... keys) {
    for (String k : keys) {
      if (n.path(k).isNumber() || n.path(k).isTextual()) {
        try {
          return Double.parseDouble(n.path(k).asText("0"));
        } catch (NumberFormatException ignored) {
          // try the next key
        }
      }
    }
    return 0;
  }

  /** The number printed on the invoice. Derived from the invoice id, so it is stable. */
  public static String invoiceNumber(HostInvoiceEntity invoice) {
    String id = invoice.getId() == null ? "" : invoice.getId();
    String tail = id.length() > 8 ? id.substring(id.length() - 8) : id;
    return "53C-" + tail.toUpperCase(Locale.ROOT);
  }

  /**
   * Emails the invoice to the host, and a copy to the billing admin address
   * when one is configured. Returns true when the host's copy was handed to the
   * mail server; a failure is logged, never thrown — the payment stands.
   */
  public boolean send(HostInvoiceEntity invoice, String hostEmail, String hostName,
      String organisation) {
    Map<String, Object> b = readBreakdown(invoice);
    String number = invoiceNumber(invoice);
    String body = render(invoice, b, number, hostEmail, hostName, organisation);
    String title = abn.isEmpty() ? "Invoice" : "Tax invoice";

    boolean sent = mail.send(hostEmail, title + " " + number + " — " + businessName, body);
    if (!sent) {
      log.warn("Invoice {} could not be emailed to {}", number, hostEmail);
    }
    if (abn.isEmpty()) {
      log.warn("Invoice {} sent without an ABN; set BILLING_ABN to issue tax invoices", number);
    }
    if (!adminEmail.isEmpty()) {
      mail.send(adminEmail, "[Payment received] " + number + " " + money((Long) b.get("total_cents"))
          + " from " + (hostEmail == null ? "" : hostEmail), body);
    }
    return sent;
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> readBreakdown(HostInvoiceEntity invoice) {
    long total = invoice.getAmount() == null ? 0 : Math.round(invoice.getAmount());
    try {
      JsonNode stored = mapper.readTree(invoice.getLineItems() == null ? "" : invoice.getLineItems());
      if (stored != null && stored.path("total_cents").asLong(-1) == total) {
        Map<String, Object> m = mapper.convertValue(stored, Map.class);
        m.put("total_cents", total);
        m.put("gst_cents", stored.path("gst_cents").asLong(0));
        m.put("ex_gst_cents", stored.path("ex_gst_cents").asLong(total));
        return m;
      }
    } catch (Exception ignored) {
      // An older invoice with an empty list: rebuild from the amount alone.
    }
    return breakdown(total, null, invoice.getLabel());
  }

  @SuppressWarnings("unchecked")
  private String render(HostInvoiceEntity invoice, Map<String, Object> b, String number,
      String hostEmail, String hostName, String organisation) {
    String nl = System.lineSeparator();
    StringBuilder s = new StringBuilder();
    s.append(abn.isEmpty() ? "INVOICE" : "TAX INVOICE").append(nl).append(nl);
    s.append(businessName).append(nl);
    if (!abn.isEmpty()) {
      s.append("ABN ").append(abn).append(nl);
    }
    if (!address.isEmpty()) {
      s.append(address).append(nl);
    }
    s.append(nl);
    s.append("Invoice number: ").append(number).append(nl);
    s.append("Date: ").append(DATE.format(invoice.getPaidAt() != null
        ? invoice.getPaidAt() : java.time.Instant.now())).append(nl);
    s.append("Status: PAID").append(nl).append(nl);

    s.append("Billed to:").append(nl);
    if (organisation != null && !organisation.isBlank()) {
      s.append("  ").append(organisation).append(nl);
    }
    if (hostName != null && !hostName.isBlank()) {
      s.append("  ").append(hostName).append(nl);
    }
    s.append("  ").append(hostEmail == null ? "" : hostEmail).append(nl).append(nl);

    s.append("Description").append(nl);
    for (Map<String, Object> l : (List<Map<String, Object>>) b.get("lines")) {
      s.append("  ").append(l.get("name")).append("  ")
          .append(money(((Number) l.get("amount_cents")).longValue())).append(nl);
    }
    s.append(nl);
    long total = ((Number) b.get("total_cents")).longValue();
    long gst = ((Number) b.get("gst_cents")).longValue();
    if (gst > 0) {
      s.append("Subtotal (excl. GST): ").append(money(total - gst)).append(nl);
      s.append("GST (10%): ").append(money(gst)).append(nl);
      s.append("Total (incl. GST): ").append(money(total)).append(nl);
    } else {
      s.append("Total: ").append(money(total)).append(nl);
    }
    s.append("Amount paid: ").append(money(total)).append(" (card, via Stripe)").append(nl);
    s.append(nl);
    s.append("For: ").append(invoice.getLabel() == null ? "" : invoice.getLabel()).append(nl);
    s.append(nl).append("Thank you — keep this email for your records.").append(nl);
    return s.toString();
  }

  /** A$1,199.00 */
  public static String money(long cents) {
    return String.format(Locale.ENGLISH, "A$%,.2f", cents / 100d);
  }
}
