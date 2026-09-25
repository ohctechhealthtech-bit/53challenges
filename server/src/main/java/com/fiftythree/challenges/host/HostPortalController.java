package com.fiftythree.challenges.host;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiftythree.challenges.admin.DraftRepo;
import com.fiftythree.challenges.engine.EntryQueryRepository;
import com.fiftythree.challenges.entity.ChallengeDraftEntity;
import com.fiftythree.challenges.entity.ChallengeEntity;
import com.fiftythree.challenges.entity.ChallengeRepository;
import com.fiftythree.challenges.entity.EntryEntity;
import com.fiftythree.challenges.entity.HostApplicationDraftEntity;
import com.fiftythree.challenges.entity.HostInvoiceEntity;
import com.fiftythree.challenges.entity.HostNotificationEntity;
import com.fiftythree.challenges.payments.StripeClient;
import com.fiftythree.challenges.security.CallerResolver;
import com.fiftythree.challenges.support.JsonColumn;
import com.fiftythree.challenges.user.UserRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Limit;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * The Java replacement for {@code hostPortal}: the host's workspace, their
 * application wizard and its payment, and the admin queues that review what
 * comes out of it.
 *
 * <p>Three things here are subtle enough to be worth stating, because getting
 * any of them wrong costs somebody money.
 *
 * <p><b>The main app prices the application, not this one.</b> The two have
 * different pricing engines and they disagree — self-service is free here and
 * is not there. The parent's confirmation rejects any payment whose amount
 * differs from its own invoice, so the charge is always the parent's figure,
 * and the code refuses to create a payment intent rather than charge a number
 * the parent will then reject.
 *
 * <p><b>The parent's invoice id is cached on the draft.</b> Pricing pushes an
 * application to the parent to get a real quote; paying must reuse that same
 * invoice rather than push again, or the host ends up with two proposals and
 * two invoices for one application. Every write to a draft preserves those
 * cached fields for exactly that reason.
 *
 * <p><b>Guests are allowed through the payment path.</b> A host who has filled
 * in the whole wizard and is about to pay must not be stopped by an expired
 * session. Those actions fall back to the email on the application, and
 * ownership is re-checked against the invoice rather than assumed.
 */
@RestController
public class HostPortalController {

  private static final Logger log = LoggerFactory.getLogger(HostPortalController.class);

  /**
   * Actions that work without a session.
   *
   * <p>The host has already filled everything in and is about to pay; losing
   * that to a session timeout would lose the application too.
   */
  private static final Set<String> GUEST_ACTIONS = Set.of(
      "price_application", "start_application_payment", "confirm_payment",
      "submit_application", "save_application_draft", "get_application_draft",
      "discard_application_draft");

  private static final Set<String> ADMIN_ACTIONS = Set.of(
      "admin_queues", "admin_grant_host_role", "admin_publish_proposal",
      "admin_preview_challenges", "admin_update_challenge", "admin_create_challenge",
      "admin_decide", "list_idea_submissions", "set_idea_status", "admin_list",
      "request_changes", "decline", "approve");

  /** Cached parent identifiers that a draft save must never wipe. */
  private static final List<String> PRESERVED_KEYS = List.of(
      "main_app_invoice_id", "main_app_proposal_id", "main_app_price");

  private static final Set<String> CHILD_DIVISIONS = Set.of("children", "teens");

  private static final List<String> CHALLENGE_CATEGORIES = List.of(
      "visual-arts", "photography", "writing",
      "digital-creativity", "performance-voice", "open-experimental");

  private static final List<String> IDEA_STATUSES =
      List.of("new", "reviewing", "accepted", "declined", "archived");

  private final HostPricing pricing;
  private final HostOrganisationService organisations;
  private final HostRequestPushService push;
  private final HostIdeaService ideas;
  private final StripeClient stripe;
  private final HostDraftQueryRepository drafts;
  private final HostInvoiceQueryRepository invoices;
  private final HostNotificationQueryRepository notifications;
  private final DraftRepo proposals;
  private final ChallengeRepository challenges;
  private final EntryQueryRepository entries;
  private final CallerResolver caller;
  private final UserRepository users;
  private final JsonColumn json;
  private final ObjectMapper mapper;

  public HostPortalController(
      HostPricing pricing,
      HostOrganisationService organisations,
      HostRequestPushService push,
      HostIdeaService ideas,
      StripeClient stripe,
      HostDraftQueryRepository drafts,
      HostInvoiceQueryRepository invoices,
      HostNotificationQueryRepository notifications,
      DraftRepo proposals,
      ChallengeRepository challenges,
      EntryQueryRepository entries,
      CallerResolver caller,
      UserRepository users,
      JsonColumn json,
      ObjectMapper mapper) {
    this.pricing = pricing;
    this.organisations = organisations;
    this.push = push;
    this.ideas = ideas;
    this.stripe = stripe;
    this.drafts = drafts;
    this.invoices = invoices;
    this.notifications = notifications;
    this.proposals = proposals;
    this.challenges = challenges;
    this.entries = entries;
    this.caller = caller;
    this.users = users;
    this.json = json;
    this.mapper = mapper;
  }

  /** Who is calling, and whether they arrived with a real session. */
  private record Identity(String id, String email, boolean admin, boolean guest) {

    boolean anonymousGuest() {
      return guest && "guest".equals(email);
    }
  }

  @PostMapping("/api/apps/{appId}/functions/hostPortal")
  public ResponseEntity<?> handle(@RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> request = body == null ? Map.of() : body;
    String action = orEmpty(str(request.get("action")));
    Identity identity = resolveIdentity(request, action);

    if (ADMIN_ACTIONS.contains(action) && !identity.admin()) {
      return ResponseEntity.status(403).body(Map.of("error", "Admin only"));
    }

    // Without a known email there is nowhere to attach a draft, so the wizard
    // keeps working from the browser instead of failing.
    if (identity.anonymousGuest()) {
      if ("get_application_draft".equals(action)) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("draft", null);
        return ResponseEntity.ok(out);
      }
      if ("save_application_draft".equals(action) || "discard_application_draft".equals(action)) {
        return ResponseEntity.ok(Map.of("ok", true, "unsaved", true));
      }
    }

    // The dashboard reads without a session — it shows "no workspace yet"
    // rather than an error, because a logged-out visitor landing there is
    // ordinary.
    if (identity.email().isEmpty()) {
      if (Set.of("get_workspace", "register_org", "update_org").contains(action)) {
        return ResponseEntity.ok(Map.of("no_workspace", true));
      }
      if ("get_organisation".equals(action)) {
        return ResponseEntity.ok(Map.of("no_workspace", true,
            "has_organisation", false, "has_paid_application", false));
      }
      if ("dashboard".equals(action)) {
        return ResponseEntity.ok(Map.of(
            "stats", Map.of("live_challenges", 0, "entries", 0, "votes", 0,
                "pending_review", 0),
            "recent_entries", List.of()));
      }
    }

    try {
      return switch (action) {
        case "get_application_draft" -> getDraft(identity);
        case "save_application_draft" -> saveDraft(request, identity);
        case "discard_application_draft" -> discardDraft(request, identity);
        case "price_application" -> priceApplication(request, identity);
        case "start_application_payment" -> startPayment(request, identity);
        case "confirm_payment" -> confirmPayment(request, identity);
        case "submit_application" -> submitApplication(request, identity);

        case "get_organisation" -> getOrganisation(identity);
        case "register_org", "update_org" -> readBackOrganisation(identity);
        case "get_workspace" -> getWorkspace(identity);
        case "dashboard" -> dashboard(identity);
        case "get_approved_challenges" -> approvedChallenges(identity);
        case "list_my_proposals" -> ResponseEntity.ok(Map.of(
            "proposals", myProposals(identity).stream().map(this::proposalJson).toList()));
        case "get_proposal" -> getProposal(request, identity);
        case "update_proposal" -> updateProposal(request, identity);
        case "submit_proposal" -> submitProposal(request, identity);
        case "mark_notifications_read" -> markNotificationsRead(identity);

        case "admin_queues" -> adminQueues();
        case "admin_list" -> ResponseEntity.ok(Map.of("proposals",
            hostApplications().stream().map(this::proposalJson).toList()));
        case "admin_publish_proposal" -> setReviewStatus(request, "live");
        case "admin_preview_challenges" -> previewChallenges(request);
        case "admin_decide" -> adminDecide(request);
        case "admin_grant_host_role" -> grantHostRole(request);
        case "list_idea_submissions" -> ResponseEntity.ok(
            Map.of("ideas", ideas.list(200)));
        case "set_idea_status" -> setIdeaStatus(request);
        case "request_changes" -> requestChanges(request);
        case "decline" -> declineProposal(request);
        case "approve" -> approveProposal(request);

        default -> ResponseEntity.status(400).body(
            Map.of("error", "Unknown action: " + action));
      };
    } catch (HostRequestPushService.PushFailedException e) {
      return ResponseEntity.status(502).body(Map.of("error", e.getMessage()));
    } catch (StripeClient.StripeException e) {
      return ResponseEntity.status(e.status()).body(Map.of("error", e.getMessage()));
    } catch (Exception e) {
      log.error("hostPortal action '{}' failed", action, e);
      return ResponseEntity.status(500).body(Map.of(
          "error", e.getMessage() == null ? "Host portal request failed" : e.getMessage()));
    }
  }

  /**
   * Resolves the caller.
   *
   * <p>A real session wins. Failing that, and only for the payment and wizard
   * actions, the email on the application stands in — so a host whose session
   * expired mid-wizard can still pay and submit.
   */
  private Identity resolveIdentity(Map<String, Object> request, String action) {
    String sessionToken = str(request.get("session_token"));
    String email = caller.email(sessionToken);
    if (email != null) {
      return new Identity(users.findIdByEmail(email).orElse(""), email,
          caller.isAdmin(sessionToken), false);
    }
    if (!GUEST_ACTIONS.contains(action)) {
      return new Identity("", "", false, false);
    }
    Map<String, Object> answers = answersOf(request);
    String guestEmail = firstNonBlank(
        str(request.get("email")),
        str(answers.get("contact_email")),
        str(answers.get("verified_email")));
    return new Identity("", guestEmail.isEmpty()
        ? "guest" : guestEmail.toLowerCase(Locale.ROOT), false, true);
  }

  // --------------------------------------------------------------- drafts

  private Optional<HostApplicationDraftEntity> activeDraft(Identity identity) {
    return drafts.findActiveFor(identity.email()).stream().findFirst();
  }

  /** A draft by id, but only the caller's own. */
  private Optional<HostApplicationDraftEntity> ownDraft(Object id, Identity identity) {
    String key = str(id);
    if (key == null) {
      return Optional.empty();
    }
    return drafts.findById(key)
        .filter(d -> identity.email().equalsIgnoreCase(nz(d.getOwnerEmail())));
  }

  private ResponseEntity<?> getDraft(Identity identity) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("draft", activeDraft(identity).map(this::draftJson).orElse(null));
    return ResponseEntity.ok(out);
  }

  private ResponseEntity<?> saveDraft(Map<String, Object> request, Identity identity) {
    Map<String, Object> answers = answersOf(request);
    HostApplicationDraftEntity draft = ownDraft(request.get("draft_id"), identity)
        .or(() -> activeDraft(identity))
        .orElse(null);
    double revision = number(request.get("revision"));
    Instant now = Instant.now();

    if (draft == null) {
      HostApplicationDraftEntity created = new HostApplicationDraftEntity();
      created.setId(newId());
      created.setOwnerEmail(identity.email());
      created.setOwnerId(identity.id());
      created.setAnswers(write(answers));
      created.setRevision(revision > 0 ? revision : 1);
      created.setStatus("active");
      created.setCreatedDate(now);
      created.setUpdatedDate(now);
      created.setIsSample(false);
      drafts.save(created);
      return ResponseEntity.ok(Map.of("ok", true,
          "draft_id", created.getId(), "revision", created.getRevision()));
    }

    // Monotonic: an older save arriving late never overwrites a newer one.
    double current = draft.getRevision() == null ? 0 : draft.getRevision();
    if (revision <= current) {
      return ResponseEntity.ok(Map.of("ok", true,
          "draft_id", draft.getId(), "revision", current, "stale", true));
    }

    Map<String, Object> merged = new LinkedHashMap<>(answers);
    // Without this the next pricing call pushes a DUPLICATE application to
    // the main app, and the host ends up with two invoices.
    Map<String, Object> existing = readMap(draft.getAnswers());
    for (String key : PRESERVED_KEYS) {
      if (existing.containsKey(key)) {
        merged.put(key, existing.get(key));
      }
    }

    draft.setAnswers(write(merged));
    draft.setRevision(revision);
    draft.setUpdatedDate(now);
    drafts.save(draft);
    return ResponseEntity.ok(Map.of("ok", true,
        "draft_id", draft.getId(), "revision", revision));
  }

  private ResponseEntity<?> discardDraft(Map<String, Object> request, Identity identity) {
    ownDraft(request.get("draft_id"), identity)
        .or(() -> activeDraft(identity))
        .ifPresent(draft -> {
          draft.setStatus("discarded");
          draft.setUpdatedDate(Instant.now());
          drafts.save(draft);
        });
    return ResponseEntity.ok(Map.of("ok", true));
  }

  // -------------------------------------------------------------- pricing

  /**
   * The price the host will actually be charged.
   *
   * <p>Comes from the main app, which owns the rate card. A cached quote on
   * the draft is reused rather than pushing again, because each push creates a
   * proposal and an invoice on the parent.
   */
  private ResponseEntity<?> priceApplication(Map<String, Object> request, Identity identity) {
    Map<String, Object> answers = answersOf(request);
    HostApplicationDraftEntity draft = ownDraft(request.get("draft_id"), identity).orElse(null);
    Map<String, Object> cached = draft == null ? Map.of() : readMap(draft.getAnswers());

    if (cached.get("main_app_invoice_id") != null && cached.get("main_app_price") != null) {
      long cents = dollarsToCents(cached.get("main_app_price"));
      Map<String, Object> quote = new LinkedHashMap<>();
      quote.put("currency", "aud");
      quote.put("total_amount", cents);
      quote.put("payment_required", cents > 0);
      quote.put("main_app_price", cached.get("main_app_price"));
      return ResponseEntity.ok(Map.of("pricing", quote));
    }

    HostRequestPushService.PushResult result =
        push.push(withContact(answers, identity), null, 0);
    cacheParentIds(draft, answers, result);

    long cents = Math.round(result.amount() * 100d);
    Map<String, Object> quote = new LinkedHashMap<>();
    quote.put("currency", "aud");
    quote.put("total_amount", cents);
    quote.put("payment_required", cents > 0);
    quote.put("main_app_price", result.price());
    return ResponseEntity.ok(Map.of("pricing", quote));
  }

  private void cacheParentIds(
      HostApplicationDraftEntity draft,
      Map<String, Object> answers,
      HostRequestPushService.PushResult result) {

    if (draft == null) {
      return;
    }
    Map<String, Object> merged = new LinkedHashMap<>(answers);
    merged.put("main_app_invoice_id", result.invoiceId());
    merged.put("main_app_proposal_id", result.requestId());
    merged.put("main_app_price", result.price());
    draft.setAnswers(write(merged));
    draft.setUpdatedDate(Instant.now());
    drafts.save(draft);
  }

  private ResponseEntity<?> startPayment(Map<String, Object> request, Identity identity) {
    if (!stripe.isConfigured()) {
      return ResponseEntity.status(500).body(Map.of("error", "Stripe keys not configured"));
    }
    HostApplicationDraftEntity draft = ownDraft(request.get("draft_id"), identity).orElse(null);
    Map<String, Object> supplied = answersOf(request);
    Map<String, Object> answers = supplied.isEmpty() && draft != null
        ? readMap(draft.getAnswers()) : supplied;
    if (draft == null && supplied.isEmpty()) {
      return ResponseEntity.status(404).body(Map.of("error", "Draft not found"));
    }

    Map<String, Object> cached = draft == null ? Map.of() : readMap(draft.getAnswers());
    String parentInvoiceId = orEmpty(str(cached.get("main_app_invoice_id")));
    Object parentPrice = cached.get("main_app_price");
    long cents;

    if (parentInvoiceId.isEmpty()) {
      HostRequestPushService.PushResult result =
          push.push(withContact(answers, identity), null, 0);
      parentInvoiceId = result.invoiceId();
      parentPrice = result.price();
      cents = Math.round(result.amount() * 100d);
      cacheParentIds(draft, answers, result);
    } else {
      cents = dollarsToCents(parentPrice);
    }

    // The parent rejects a payment whose amount differs from its invoice, so
    // a divergence here is refused rather than charged and bounced.
    long quoted = dollarsToCents(parentPrice);
    if (quoted > 0 && cents != quoted) {
      return ResponseEntity.status(500).body(Map.of("error", String.format(
          "Pricing mismatch: the amount to charge (A$%.2f) does not match the "
              + "main app's quote (A$%.2f). Please refresh and try again.",
          cents / 100d, quoted / 100d)));
    }
    if (cents <= 0) {
      return ResponseEntity.status(400).body(Map.of(
          "error", "No payment required for this application"));
    }

    String label = "Challenge application — "
        + orDefault(str(answers.get("challenge_title")), "Your challenge");

    Map<String, String> metadata = new LinkedHashMap<>();
    metadata.put("draft_id", draft == null ? "" : draft.getId());
    metadata.put("owner_email", identity.email());
    metadata.put("main_app_invoice_id", parentInvoiceId);

    JsonNode intent = stripe.createPaymentIntent(cents, "aud",
        identity.email().contains("@") ? identity.email() : null, label, metadata);

    Instant now = Instant.now();
    HostInvoiceEntity invoice = new HostInvoiceEntity();
    invoice.setId(newId());
    invoice.setOwnerEmail(identity.email());
    invoice.setDraftId(draft == null ? "" : draft.getId());
    invoice.setPurpose("application");
    invoice.setLabel(label);
    invoice.setAmount((double) cents);
    invoice.setCurrency("aud");
    invoice.setLineItems(write(List.of()));
    invoice.setStatus("pending");
    invoice.setStripePaymentIntentId(intent.path("id").asText(""));
    invoice.setCreatedDate(now);
    invoice.setUpdatedDate(now);
    invoice.setIsSample(false);
    invoices.save(invoice);

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("client_secret", intent.path("client_secret").asText(""));
    out.put("publishable_key", stripe.publishableKey());
    out.put("invoice_id", invoice.getId());
    out.put("amount", cents);
    out.put("label", label);
    out.put("main_app_invoice_id", parentInvoiceId);
    out.put("main_app_price", parentPrice);
    return ResponseEntity.ok(out);
  }

  private ResponseEntity<?> confirmPayment(Map<String, Object> request, Identity identity) {
    String invoiceId = str(request.get("invoice_id"));
    Optional<HostInvoiceEntity> found = invoiceId == null
        ? Optional.empty() : invoices.findById(invoiceId);
    if (found.isEmpty()) {
      return ResponseEntity.status(404).body(Map.of("error", "Invoice not found"));
    }
    HostInvoiceEntity invoice = found.get();

    // A guest is allowed here — the wizard calls this with only an invoice id
    // — but they must still own it, or hold an admin session.
    boolean owns = identity.email().equalsIgnoreCase(nz(invoice.getOwnerEmail()));
    if (!owns && !identity.admin() && !identity.guest()) {
      return ResponseEntity.status(404).body(Map.of("error", "Invoice not found"));
    }

    if (!"paid".equals(nz(invoice.getStatus()))) {
      if (!stripe.isConfigured()) {
        return ResponseEntity.status(500).body(Map.of("error", "Stripe keys not configured"));
      }
      JsonNode intent = stripe.getPaymentIntent(nz(invoice.getStripePaymentIntentId()));
      if (!"succeeded".equals(intent.path("status").asText(""))) {
        return ResponseEntity.status(409).body(Map.of(
            "error", "Payment has not completed yet"));
      }
      invoice.setStatus("paid");
      invoice.setPaidAt(Instant.now());
      invoice.setUpdatedDate(Instant.now());
      invoices.save(invoice);

      notify(nz(invoice.getOwnerEmail()), "Payment received",
          String.format("We've received your payment of A$%,.2f. Thank you!",
              (invoice.getAmount() == null ? 0 : invoice.getAmount()) / 100d),
          nz(invoice.getProposalId()));
    }

    // Looked up directly rather than through ownDraft: the guest identity has
    // no email to match on, and ownership was already established above.
    HostApplicationDraftEntity draft = nz(invoice.getDraftId()).isEmpty()
        ? null : drafts.findById(invoice.getDraftId()).orElse(null);
    Map<String, Object> answers = draft == null ? Map.of() : readMap(draft.getAnswers());
    String parentInvoiceId = firstNonBlank(
        str(answers.get("main_app_invoice_id")), str(request.get("main_app_invoice_id")));
    String confirmEmail = firstNonBlank(
        draft == null ? null : draft.getOwnerEmail(),
        invoice.getOwnerEmail(),
        identity.email()).toLowerCase(Locale.ROOT);

    if (!parentInvoiceId.isEmpty() && !nz(invoice.getStripePaymentIntentId()).isEmpty()) {
      // Failure is logged inside, not surfaced: the card has been charged and
      // telling the host their payment failed would be untrue.
      push.confirmPayment(parentInvoiceId, invoice.getStripePaymentIntentId(), confirmEmail);
    }

    return ResponseEntity.ok(Map.of("ok", true, "invoice", invoiceJson(invoice)));
  }

  // ----------------------------------------------------------- submission

  private ResponseEntity<?> submitApplication(Map<String, Object> request, Identity identity) {
    HostApplicationDraftEntity draft = ownDraft(request.get("draft_id"), identity).orElse(null);
    Map<String, Object> supplied = answersOf(request);
    Map<String, Object> answers = supplied.isEmpty() && draft != null
        ? readMap(draft.getAnswers()) : supplied;

    String title = orEmpty(str(answers.get("challenge_title")));
    if (title.isEmpty()) {
      return ResponseEntity.status(400).body(Map.of(
          "error", "Please give your challenge a title first"));
    }

    // The parent's price decides whether payment was required, not ours —
    // self-service is free here and is not there.
    Map<String, Object> cached = draft == null ? Map.of() : readMap(draft.getAnswers());
    long parentTotal = dollarsToCents(cached.get("main_app_price"));
    HostPricing.Quote local = pricing.price(answers);
    boolean paymentRequired = parentTotal > 0 || local.paymentRequired();

    HostInvoiceEntity invoice = null;
    if (paymentRequired) {
      String invoiceId = str(request.get("invoice_id"));
      invoice = invoiceId == null ? null : invoices.findById(invoiceId).orElse(null);
      boolean usable = invoice != null
          && "paid".equals(nz(invoice.getStatus()))
          && (identity.guest()
              || identity.email().equalsIgnoreCase(nz(invoice.getOwnerEmail())));
      if (!usable) {
        return ResponseEntity.status(402).body(Map.of(
            "error", "Payment is required before submitting this application"));
      }
    }

    Map<String, String> routing = pricing.score(answers);
    HostOrganisationService.Organisation organisation =
        organisations.byEmail(identity.email());

    String contactName = firstNonBlank(
        str(answers.get("contact_name")), str(answers.get("name")),
        organisation.found() ? organisation.organisation().path("contact_name").asText("") : null,
        organisation.found() ? organisation.organisation().path("name").asText("") : null,
        identity.email().contains("@")
            ? identity.email().substring(0, identity.email().indexOf('@')) : "");

    String organisationName = firstNonBlank(
        str(answers.get("organisation_name")), str(answers.get("org_name")),
        organisation.found() ? organisation.organisation().path("name").asText("") : null,
        contactName, str(answers.get("beneficiary_name")));

    Map<String, Object> proposalAnswers = new LinkedHashMap<>(answers);
    if (answers.get("structured") instanceof Map<?, ?> structured) {
      proposalAnswers.putAll(castMap(structured));
    }
    proposalAnswers.put("routing", routing);
    proposalAnswers.put("host_email", identity.email());
    proposalAnswers.put("contact_name", contactName);
    proposalAnswers.put("contact_email", firstNonBlank(
        str(answers.get("org_contact_email")), str(answers.get("contact_email")),
        identity.email()));
    proposalAnswers.put("organisation_name", organisationName);
    proposalAnswers.put("org_name", organisationName);
    proposalAnswers.put("template_id", orEmpty(str(answers.get("template_id"))));
    proposalAnswers.put("template_name", orEmpty(str(answers.get("template_name"))));
    // A custom idea has to be designed and built by us, so it is flagged for
    // the admin queue rather than treated as a library pick.
    proposalAnswers.put("custom_build", str(answers.get("template_id")) == null);

    Instant now = Instant.now();
    // Re-submitting after a failed push must not create a second proposal.
    ChallengeDraftEntity proposal = draft != null && !nz(draft.getProposalId()).isEmpty()
        ? proposals.findById(draft.getProposalId()).orElse(null)
        : null;
    if (proposal == null) {
      proposal = new ChallengeDraftEntity();
      proposal.setId(newId());
      proposal.setOrigin("host_apply");
      proposal.setCreatedDate(now);
      proposal.setIsTemplate(false);
      proposal.setIsSample(false);
    }
    proposal.setChallengeTitle(title);
    proposal.setChallengeDescription(orEmpty(str(answers.get("challenge_description"))));
    proposal.setCategory(orEmpty(str(answers.get("category"))));
    proposal.setReviewStatus("submitted_for_review");
    proposal.setScaleBand(orEmpty(str(answers.get("participant_range"))));
    proposal.setHostOrganisationId(organisation.id());
    proposal.setTemplateId(orEmpty(str(answers.get("template_id"))));
    proposal.setAnswers(write(proposalAnswers));
    proposal.setUpdatedDate(now);
    proposals.save(proposal);

    if (invoice != null) {
      invoice.setProposalId(proposal.getId());
      invoice.setUpdatedDate(now);
      invoices.save(invoice);
    }
    if (draft != null) {
      draft.setProposalId(proposal.getId());
      draft.setPricingSnapshot(write(local.breakdown()));
      draft.setUpdatedDate(now);
      drafts.save(draft);
    }

    // The application was already pushed during pricing; reuse those ids
    // rather than creating a second proposal on the parent.
    String requestId = firstNonBlank(
        str(cached.get("main_app_proposal_id")), str(answers.get("main_app_proposal_id")));
    if (requestId.isEmpty()) {
      try {
        HostRequestPushService.PushResult result = push.push(
            proposalAnswers,
            invoice == null ? null : invoice.getStripePaymentIntentId(),
            invoice == null || invoice.getAmount() == null ? 0 : invoice.getAmount().longValue());
        requestId = result.requestId();
        if (draft != null) {
          cacheParentIds(draft, readMap(draft.getAnswers()), result);
        }
        if (invoice != null && !result.invoiceId().isEmpty()) {
          push.confirmPayment(result.invoiceId(),
              nz(invoice.getStripePaymentIntentId()), identity.email());
        }
      } catch (HostRequestPushService.PushFailedException e) {
        // Saved locally but not sent. Reported with the proposal id so an
        // admin can find it rather than the host losing the application.
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("error", "We saved your application but could not send it to "
            + "53 Challenges. Please try again in a moment. (" + e.getMessage() + ")");
        out.put("proposal_id", proposal.getId());
        return ResponseEntity.status(502).body(out);
      }
    }

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("ok", true);
    out.put("proposal_id", proposal.getId());
    out.put("request_id", requestId);
    return ResponseEntity.ok(out);
  }

  // ------------------------------------------------------------ workspace

  private ResponseEntity<?> getOrganisation(Identity identity) {
    HostOrganisationService.Organisation organisation =
        organisations.byEmail(identity.email());
    if (!organisation.found()) {
      return ResponseEntity.ok(Map.of("no_workspace", true,
          "has_organisation", false, "has_paid_application", false));
    }
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("has_organisation", true);
    out.put("organisation", organisation.organisation());
    out.put("member", organisation.membership());
    out.put("has_paid_application",
        !invoices.findPaidByOwner(identity.email(), Limit.of(1)).isEmpty());
    return ResponseEntity.ok(out);
  }

  /**
   * Organisation details are owned centrally, so both register and update
   * simply read the current record back — this app never edits them.
   */
  private ResponseEntity<?> readBackOrganisation(Identity identity) {
    HostOrganisationService.Organisation organisation =
        organisations.byEmail(identity.email());
    if (!organisation.found()) {
      Map<String, Object> out = new LinkedHashMap<>();
      out.put("success", false);
      out.put("no_workspace", true);
      out.put("organisation", null);
      out.put("member", null);
      return ResponseEntity.ok(out);
    }
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("ok", true);
    out.put("success", true);
    out.put("already_registered", true);
    out.put("organisation", organisation.organisation());
    out.put("member", organisation.membership());
    return ResponseEntity.ok(out);
  }

  private ResponseEntity<?> getWorkspace(Identity identity) {
    HostOrganisationService.Organisation organisation =
        organisations.byEmail(identity.email());
    if (!organisation.found()) {
      return ResponseEntity.ok(Map.of("no_workspace", true));
    }

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("organisation", organisation.organisation());
    out.put("member", organisation.membership());
    out.put("team", organisations.members(organisation.id()));
    out.put("proposals", myProposals(identity).stream().map(this::proposalJson).toList());
    out.put("addons", addonList());
    out.put("orders", List.of());
    out.put("invoices", invoices.findByOwner(identity.email(), Limit.of(50))
        .stream().map(this::invoiceJson).toList());
    out.put("notifications", notifications.findFor(identity.email(), Limit.of(30))
        .stream().map(this::notificationJson).toList());
    out.put("messages", List.of());
    out.put("posts", List.of());
    out.put("assets", List.of());
    out.put("packages", List.of());
    return ResponseEntity.ok(out);
  }

  private ResponseEntity<?> dashboard(Identity identity) {
    List<ChallengeDraftEntity> live = myProposals(identity).stream()
        .filter(p -> !nz(p.getChallengeId()).isEmpty())
        .limit(5)
        .toList();

    int entriesTotal = 0;
    long votesTotal = 0;
    int pendingReview = 0;
    List<Map<String, Object>> recent = new ArrayList<>();

    for (ChallengeDraftEntity proposal : live) {
      List<EntryEntity> challengeEntries =
          entries.findByChallengeIdOrderByCreatedDateDesc(proposal.getChallengeId());
      entriesTotal += challengeEntries.size();
      for (EntryEntity entry : challengeEntries) {
        votesTotal += entry.getVoteCount() == null ? 0 : entry.getVoteCount().longValue();
        if ("pending".equals(nz(entry.getStatus()))) {
          pendingReview++;
        }
      }
      for (EntryEntity entry : challengeEntries.stream().limit(5).toList()) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", entry.getId());
        row.put("title", entry.getTitle());
        row.put("creator_name", entry.getCreatorName());
        row.put("status", entry.getStatus());
        row.put("created_date", iso(entry.getCreatedDate()));
        row.put("challenge_title", proposal.getChallengeTitle());
        recent.add(row);
      }
    }
    recent.sort(Comparator.comparing(
        (Map<String, Object> r) -> orEmpty((String) r.get("created_date"))).reversed());

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("stats", Map.of(
        "live_challenges", live.size(), "entries", entriesTotal,
        "votes", votesTotal, "pending_review", pendingReview));
    out.put("recent_entries", recent.stream().limit(6).toList());
    return ResponseEntity.ok(out);
  }

  private ResponseEntity<?> approvedChallenges(Identity identity) {
    List<Map<String, Object>> out = new ArrayList<>();
    Set<String> seen = new java.util.LinkedHashSet<>();
    for (ChallengeDraftEntity proposal : myProposals(identity)) {
      String challengeId = nz(proposal.getChallengeId());
      if (challengeId.isEmpty() || !seen.add(challengeId)) {
        continue;
      }
      Map<String, Object> row = new LinkedHashMap<>();
      row.put("proposal_id", proposal.getId());
      row.put("challenge_id", challengeId);
      row.put("challenge_title", proposal.getChallengeTitle());
      row.put("review_status", proposal.getReviewStatus());
      challenges.findById(challengeId).ifPresent(c -> {
        row.put("lifecycle_status", c.getLifecycleStatus());
        row.put("status", c.getStatus());
      });
      out.add(row);
    }
    return ResponseEntity.ok(Map.of("challenges", out));
  }

  private ResponseEntity<?> getProposal(Map<String, Object> request, Identity identity) {
    return ownProposal(request.get("id"), identity)
        .<ResponseEntity<?>>map(p -> ResponseEntity.ok(
            Map.of("proposal", proposalJson(p))))
        .orElseGet(() -> ResponseEntity.status(404).body(
            Map.of("error", "Proposal not found")));
  }

  private ResponseEntity<?> updateProposal(Map<String, Object> request, Identity identity) {
    Optional<ChallengeDraftEntity> found = ownProposal(request.get("id"), identity);
    if (found.isEmpty()) {
      return ResponseEntity.status(404).body(Map.of("error", "Proposal not found"));
    }
    ChallengeDraftEntity proposal = found.get();
    if (request.get("answers") instanceof Map<?, ?> answers) {
      proposal.setAnswers(write(castMap(answers)));
    }
    if (str(request.get("challenge_title")) != null) {
      proposal.setChallengeTitle(str(request.get("challenge_title")));
    }
    if (str(request.get("challenge_description")) != null) {
      proposal.setChallengeDescription(str(request.get("challenge_description")));
    }
    proposal.setUpdatedDate(Instant.now());
    proposals.save(proposal);
    return ResponseEntity.ok(Map.of("ok", true, "proposal", proposalJson(proposal)));
  }

  private ResponseEntity<?> submitProposal(Map<String, Object> request, Identity identity) {
    Optional<ChallengeDraftEntity> found = ownProposal(request.get("id"), identity);
    if (found.isEmpty()) {
      return ResponseEntity.status(404).body(Map.of("error", "Proposal not found"));
    }
    ChallengeDraftEntity proposal = found.get();
    proposal.setReviewStatus("submitted_for_review");
    proposal.setUpdatedDate(Instant.now());
    proposals.save(proposal);
    return ResponseEntity.ok(Map.of("ok", true));
  }

  private ResponseEntity<?> markNotificationsRead(Identity identity) {
    for (HostNotificationEntity notification
        : notifications.findFor(identity.email(), Limit.of(100))) {
      if (!Boolean.TRUE.equals(notification.getRead())) {
        notification.setRead(true);
        notification.setUpdatedDate(Instant.now());
        notifications.save(notification);
      }
    }
    return ResponseEntity.ok(Map.of("ok", true));
  }

  // --------------------------------------------------------------- admin

  private List<ChallengeDraftEntity> hostApplications() {
    return proposals.findHostApplications();
  }

  private ResponseEntity<?> adminQueues() {
    List<ChallengeDraftEntity> applications = hostApplications();

    // Built from the proposals' own answers rather than the organisations API:
    // the name and contact are already stored there, and the external lookup
    // is unreliable from an admin context.
    Map<String, Object> organisationMap = new LinkedHashMap<>();
    for (ChallengeDraftEntity proposal : applications) {
      String organisationId = nz(proposal.getHostOrganisationId());
      if (organisationId.isEmpty() || organisationMap.containsKey(organisationId)) {
        continue;
      }
      Map<String, Object> answers = readMap(proposal.getAnswers());
      Map<String, Object> row = new LinkedHashMap<>();
      row.put("id", organisationId);
      row.put("name", firstNonBlank(
          str(answers.get("organisation_name")), str(answers.get("org_name")),
          str(answers.get("beneficiary_name")), "Unknown org"));
      row.put("contact_email", firstNonBlank(
          str(answers.get("host_email")), str(answers.get("contact_email"))));
      organisationMap.put(organisationId, row);
    }

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("proposals", applications.stream().map(this::proposalJson).toList());
    out.put("organisations", organisationMap);
    out.put("pending_posts", List.of());
    out.put("orders", List.of());
    out.put("invoices", invoices.findAllNewestFirst(Limit.of(200))
        .stream().map(this::invoiceJson).toList());
    return ResponseEntity.ok(out);
  }

  private ResponseEntity<?> setReviewStatus(Map<String, Object> request, String status) {
    String proposalId = str(request.get("proposal_id"));
    if (proposalId == null) {
      return ResponseEntity.status(400).body(Map.of("error", "Proposal ID required"));
    }
    Optional<ChallengeDraftEntity> found = proposals.findById(proposalId);
    if (found.isEmpty()) {
      return ResponseEntity.status(404).body(Map.of("error", "Proposal not found"));
    }
    ChallengeDraftEntity proposal = found.get();
    proposal.setReviewStatus(status);
    proposal.setUpdatedDate(Instant.now());
    proposals.save(proposal);
    return ResponseEntity.ok(Map.of("ok", true));
  }

  private ResponseEntity<?> previewChallenges(Map<String, Object> request) {
    String proposalId = str(request.get("proposal_id"));
    if (proposalId == null) {
      return ResponseEntity.status(400).body(Map.of("error", "Proposal ID required"));
    }
    Optional<ChallengeDraftEntity> found = proposals.findById(proposalId);
    if (found.isEmpty()) {
      return ResponseEntity.status(404).body(Map.of("error", "Proposal not found"));
    }
    List<Map<String, Object>> out = new ArrayList<>();
    String challengeId = nz(found.get().getChallengeId());
    if (!challengeId.isEmpty()) {
      challenges.findById(challengeId).ifPresent(c -> out.add(challengeJson(c)));
    }
    return ResponseEntity.ok(Map.of("challenges", out));
  }

  /**
   * Takes a proposal live.
   *
   * <p>Refuses outright when the challenge carries a children or teens
   * division: those cannot be public until guardian consent is running, and
   * this is the last gate before a child's work is visible.
   */
  private ResponseEntity<?> adminDecide(Map<String, Object> request) {
    String proposalId = str(request.get("proposal_id"));
    if (proposalId == null) {
      return ResponseEntity.status(400).body(Map.of("error", "Proposal ID required"));
    }
    if (!"go_live".equals(str(request.get("decision")))) {
      return ResponseEntity.status(400).body(Map.of("error", "Unknown decision"));
    }
    Optional<ChallengeDraftEntity> found = proposals.findById(proposalId);
    if (found.isEmpty()) {
      return ResponseEntity.status(404).body(Map.of("error", "Proposal not found"));
    }
    ChallengeDraftEntity proposal = found.get();

    String challengeId = nz(proposal.getChallengeId());
    if (!challengeId.isEmpty()) {
      Optional<ChallengeEntity> challenge = challenges.findById(challengeId);
      if (challenge.isPresent()) {
        ChallengeEntity live = challenge.get();
        boolean hasKids = json.stringList(live.getDivisions()).stream()
            .anyMatch(d -> d != null
                && CHILD_DIVISIONS.contains(d.toLowerCase(Locale.ROOT).trim()));
        if (hasKids) {
          return ResponseEntity.status(403).body(Map.of("error",
              "This challenge includes children/teens divisions. Remove those "
                  + "divisions or keep it draft until guardian consent is live."));
        }
        boolean started = live.getStartsAt() != null
            && !live.getStartsAt().isAfter(Instant.now());
        live.setLifecycleStatus(started ? "entry_open" : "published");
        live.setStatus("active");
        live.setUpdatedDate(Instant.now());
        challenges.save(live);
      }
    }

    proposal.setReviewStatus("live");
    proposal.setUpdatedDate(Instant.now());
    proposals.save(proposal);

    String hostEmail = orEmpty(str(readMap(proposal.getAnswers()).get("host_email")));
    if (!hostEmail.isEmpty()) {
      notify(hostEmail, "Your challenge is live",
          "Great news — \"" + nz(proposal.getChallengeTitle())
              + "\" is now live on 53 Challenges. Participants can start entering now.",
          proposal.getId());
    }
    return ResponseEntity.ok(Map.of("ok", true));
  }

  /**
   * Grants host access.
   *
   * <p>The original invited the address as a platform user through Base44's
   * own user API, which this app has no equivalent of. It records the intent
   * as a notification instead and reports that a person must complete the
   * invitation — rather than returning ok for something that did not happen.
   */
  private ResponseEntity<?> grantHostRole(Map<String, Object> request) {
    String email = orEmpty(str(request.get("email"))).toLowerCase(Locale.ROOT);
    if (!email.contains("@")) {
      return ResponseEntity.status(400).body(Map.of("error", "Valid email required"));
    }
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("ok", true);
    out.put("email", email);
    out.put("manual_step_required", true);
    out.put("message", "Base44's user invitation API has no equivalent here. "
        + "Invite " + email + " from the admin user screen to complete this.");
    return ResponseEntity.ok(out);
  }

  private ResponseEntity<?> setIdeaStatus(Map<String, Object> request) {
    String ideaId = str(request.get("id"));
    String status = str(request.get("review_status"));
    if (ideaId == null || status == null || !IDEA_STATUSES.contains(status)) {
      return ResponseEntity.status(400).body(Map.of(
          "error", "A valid idea and status are required"));
    }
    boolean updated = ideas.setStatus(ideaId, status);
    return updated
        ? ResponseEntity.ok(Map.of("ok", true))
        : ResponseEntity.status(502).body(Map.of("error", "Could not update this idea"));
  }

  private ResponseEntity<?> requestChanges(Map<String, Object> request) {
    String feedback = str(request.get("feedback"));
    if (feedback == null) {
      return ResponseEntity.status(400).body(Map.of("error", "feedback required"));
    }
    return decide(request, "changes_requested", feedback, "Changes requested",
        proposal -> proposal.setAdminFeedback(feedback));
  }

  private ResponseEntity<?> declineProposal(Map<String, Object> request) {
    String reason = str(request.get("reason"));
    if (reason == null) {
      return ResponseEntity.status(400).body(Map.of("error", "reason required"));
    }
    return decide(request, "rejected", reason, "Application declined",
        proposal -> proposal.setDeclineReason(reason));
  }

  private ResponseEntity<?> decide(
      Map<String, Object> request,
      String status,
      String message,
      String subject,
      java.util.function.Consumer<ChallengeDraftEntity> apply) {

    String id = str(request.get("id"));
    Optional<ChallengeDraftEntity> found = id == null
        ? Optional.empty() : proposals.findById(id);
    if (found.isEmpty()) {
      return ResponseEntity.status(404).body(Map.of("error", "Proposal not found"));
    }
    ChallengeDraftEntity proposal = found.get();
    proposal.setReviewStatus(status);
    apply.accept(proposal);
    proposal.setUpdatedDate(Instant.now());
    proposals.save(proposal);

    String hostEmail = orEmpty(str(readMap(proposal.getAnswers()).get("host_email")));
    if (!hostEmail.isEmpty()) {
      notify(hostEmail, subject, message, proposal.getId());
    }
    return ResponseEntity.ok(Map.of("ok", true));
  }

  private ResponseEntity<?> approveProposal(Map<String, Object> request) {
    String id = str(request.get("id"));
    Optional<ChallengeDraftEntity> found = id == null
        ? Optional.empty() : proposals.findById(id);
    if (found.isEmpty()) {
      return ResponseEntity.status(404).body(Map.of("error", "Proposal not found"));
    }
    ChallengeDraftEntity proposal = found.get();
    if (!nz(proposal.getChallengeId()).isEmpty()) {
      return ResponseEntity.status(409).body(Map.of(
          "error", "A challenge was already created from this proposal"));
    }

    String title = orDefault(proposal.getChallengeTitle(), "Untitled challenge");
    String category = CHALLENGE_CATEGORIES.contains(nz(proposal.getCategory()))
        ? proposal.getCategory() : "open-experimental";

    Instant now = Instant.now();
    ChallengeEntity challenge = new ChallengeEntity();
    challenge.setId(newId());
    challenge.setTitle(title);
    challenge.setTheme(title);
    challenge.setCategory(category);
    challenge.setBrief(orDefault(proposal.getChallengeDescription(), title));
    challenge.setDivisions(nz(proposal.getDivisions()).isEmpty()
        ? write(List.of()) : proposal.getDivisions());
    challenge.setContentType("host_managed".equals(nz(proposal.getContentType()))
        ? "host_managed" : "admin_managed");
    challenge.setSource("native");
    // Created as a draft. Going live is admin_decide's job, and that is where
    // the children/teens gate lives.
    challenge.setLifecycleStatus("draft");
    challenge.setStatus("draft");
    challenge.setCreatedDate(now);
    challenge.setUpdatedDate(now);
    challenge.setIsSample(false);
    challenges.save(challenge);

    proposal.setChallengeId(challenge.getId());
    proposal.setReviewStatus("approved");
    proposal.setUpdatedDate(now);
    proposals.save(proposal);

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("ok", true);
    out.put("challenge_id", challenge.getId());
    return ResponseEntity.ok(out);
  }

  // -------------------------------------------------------------- helpers

  private List<ChallengeDraftEntity> myProposals(Identity identity) {
    String email = identity.email().toLowerCase(Locale.ROOT);
    List<ChallengeDraftEntity> mine = new ArrayList<>();
    for (ChallengeDraftEntity proposal : hostApplications()) {
      Map<String, Object> answers = readMap(proposal.getAnswers());
      String hostEmail = orEmpty(str(answers.get("host_email"))).toLowerCase(Locale.ROOT);
      if (email.equals(hostEmail)) {
        mine.add(proposal);
      }
    }
    return mine;
  }

  private Optional<ChallengeDraftEntity> ownProposal(Object id, Identity identity) {
    String key = str(id);
    if (key == null) {
      return Optional.empty();
    }
    return proposals.findById(key).filter(p -> {
      if (identity.admin()) {
        return true;
      }
      String hostEmail = orEmpty(str(readMap(p.getAnswers()).get("host_email")));
      return identity.email().equalsIgnoreCase(hostEmail);
    });
  }

  private void notify(String email, String title, String body, String proposalId) {
    if (email == null || email.isBlank()) {
      return;
    }
    Instant now = Instant.now();
    HostNotificationEntity notification = new HostNotificationEntity();
    notification.setId(newId());
    notification.setRecipientEmail(email);
    notification.setTitle(title);
    notification.setBody(body);
    notification.setProposalId(orEmpty(proposalId));
    notification.setRead(false);
    notification.setCreatedDate(now);
    notification.setUpdatedDate(now);
    notification.setIsSample(false);
    notifications.save(notification);
  }

  /** The contact fields the parent's guest_apply insists on. */
  private Map<String, Object> withContact(Map<String, Object> answers, Identity identity) {
    HostOrganisationService.Organisation organisation =
        organisations.byEmail(identity.email());
    String contactName = firstNonBlank(
        str(answers.get("contact_name")), str(answers.get("name")),
        organisation.found() ? organisation.organisation().path("contact_name").asText("") : null,
        identity.email().contains("@")
            ? identity.email().substring(0, identity.email().indexOf('@')) : "");
    String organisationName = firstNonBlank(
        str(answers.get("organisation_name")), str(answers.get("org_name")),
        organisation.found() ? organisation.organisation().path("name").asText("") : null,
        contactName);

    Map<String, Object> out = new LinkedHashMap<>(answers);
    out.put("host_email", identity.email());
    out.put("contact_name", contactName);
    out.put("contact_email", firstNonBlank(
        str(answers.get("contact_email")), identity.email()));
    out.put("organisation_name", organisationName);
    out.put("org_name", organisationName);
    return out;
  }

  private List<Map<String, Object>> addonList() {
    List<Map<String, Object>> out = new ArrayList<>();
    pricing.addonCatalogue().forEach((key, value) -> {
      Map<String, Object> row = new LinkedHashMap<>();
      row.put("key", key);
      if (value instanceof Map<?, ?> fee) {
        row.put("name", ((Map<?, ?>) fee).get("name"));
        row.put("amount", ((Map<?, ?>) fee).get("amount"));
      }
      out.add(row);
    });
    return out;
  }

  /** The parent quotes in dollars; Stripe charges in cents. */
  private long dollarsToCents(Object price) {
    if (price == null) {
      return 0;
    }
    JsonNode node = mapper.valueToTree(price);
    return Math.round(node.path("total_price").asDouble(0) * 100d);
  }

  // -------------------------------------------------------------- shapes

  private Map<String, Object> draftJson(HostApplicationDraftEntity d) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", d.getId());
    out.put("owner_email", d.getOwnerEmail());
    out.put("answers", node(d.getAnswers()));
    out.put("revision", d.getRevision());
    out.put("status", d.getStatus());
    out.put("pricing_snapshot", node(d.getPricingSnapshot()));
    out.put("proposal_id", d.getProposalId());
    out.put("created_date", iso(d.getCreatedDate()));
    return out;
  }

  private Map<String, Object> invoiceJson(HostInvoiceEntity i) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", i.getId());
    out.put("owner_email", i.getOwnerEmail());
    out.put("draft_id", i.getDraftId());
    out.put("proposal_id", i.getProposalId());
    out.put("purpose", i.getPurpose());
    out.put("label", i.getLabel());
    out.put("amount", i.getAmount());
    out.put("currency", i.getCurrency());
    out.put("line_items", node(i.getLineItems()));
    out.put("status", i.getStatus());
    // The Stripe intent id is deliberately absent: the browser has the client
    // secret it needs, and this identifies the payment to anyone holding it.
    out.put("paid_at", iso(i.getPaidAt()));
    out.put("created_date", iso(i.getCreatedDate()));
    return out;
  }

  private Map<String, Object> notificationJson(HostNotificationEntity n) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", n.getId());
    out.put("title", n.getTitle());
    out.put("body", n.getBody());
    out.put("proposal_id", n.getProposalId());
    out.put("read", n.getRead());
    out.put("created_date", iso(n.getCreatedDate()));
    return out;
  }

  private Map<String, Object> proposalJson(ChallengeDraftEntity p) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", p.getId());
    out.put("origin", p.getOrigin());
    out.put("challenge_id", p.getChallengeId());
    out.put("challenge_title", p.getChallengeTitle());
    out.put("challenge_description", p.getChallengeDescription());
    out.put("category", p.getCategory());
    out.put("review_status", p.getReviewStatus());
    out.put("scale_band", p.getScaleBand());
    out.put("host_organisation_id", p.getHostOrganisationId());
    out.put("template_id", p.getTemplateId());
    out.put("admin_feedback", p.getAdminFeedback());
    out.put("decline_reason", p.getDeclineReason());
    out.put("answers", node(p.getAnswers()));
    out.put("created_date", iso(p.getCreatedDate()));
    return out;
  }

  private Map<String, Object> challengeJson(ChallengeEntity c) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", c.getId());
    out.put("title", c.getTitle());
    out.put("theme", c.getTheme());
    out.put("category", c.getCategory());
    out.put("brief", c.getBrief());
    out.put("divisions", json.stringList(c.getDivisions()));
    out.put("lifecycle_status", c.getLifecycleStatus());
    out.put("status", c.getStatus());
    out.put("starts_at", iso(c.getStartsAt()));
    return out;
  }

  private JsonNode node(String raw) {
    if (raw == null || raw.isBlank()) {
      return mapper.createObjectNode();
    }
    try {
      return mapper.readTree(raw);
    } catch (Exception e) {
      return mapper.createObjectNode();
    }
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> readMap(String raw) {
    if (raw == null || raw.isBlank()) {
      return new LinkedHashMap<>();
    }
    try {
      Object parsed = mapper.readValue(raw, Map.class);
      return parsed instanceof Map ? (Map<String, Object>) parsed : new LinkedHashMap<>();
    } catch (Exception e) {
      return new LinkedHashMap<>();
    }
  }

  private String write(Object value) {
    try {
      return mapper.writeValueAsString(value);
    } catch (Exception e) {
      throw new IllegalStateException("Could not serialise a host portal column", e);
    }
  }

  private Map<String, Object> answersOf(Map<String, Object> request) {
    return request.get("answers") instanceof Map<?, ?> answers
        ? castMap(answers) : new LinkedHashMap<>();
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> castMap(Map<?, ?> supplied) {
    return new LinkedHashMap<>((Map<String, Object>) supplied);
  }

  private static double number(Object value) {
    if (value instanceof Number n) {
      return n.doubleValue();
    }
    try {
      return value == null ? 0 : Double.parseDouble(String.valueOf(value));
    } catch (NumberFormatException e) {
      return 0;
    }
  }

  private static String firstNonBlank(String... values) {
    for (String value : values) {
      if (value != null && !value.isBlank()) {
        return value;
      }
    }
    return "";
  }

  private static String iso(Instant value) {
    return value == null ? null : value.toString();
  }

  private static String orDefault(String value, String fallback) {
    return value == null || value.isBlank() ? fallback : value;
  }

  private static String orEmpty(String value) {
    return value == null ? "" : value;
  }

  private static String nz(String value) {
    return value == null ? "" : value;
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
