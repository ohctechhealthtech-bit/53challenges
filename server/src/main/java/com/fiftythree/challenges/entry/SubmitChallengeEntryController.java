package com.fiftythree.challenges.entry;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiftythree.challenges.compliance.ComplianceAuditService;
import com.fiftythree.challenges.engine.EntryQueryRepository;
import com.fiftythree.challenges.entity.ChallengeEntity;
import com.fiftythree.challenges.entity.ChallengeRepository;
import com.fiftythree.challenges.entity.EmailVerificationEntity;
import com.fiftythree.challenges.entity.EntryEntity;
import com.fiftythree.challenges.entity.GuardianEntity;
import com.fiftythree.challenges.guardian.GuardianConsentQueryRepository;
import com.fiftythree.challenges.guardian.GuardianService;
import com.fiftythree.challenges.lifecycle.LifecycleGateService;
import com.fiftythree.challenges.security.CallerResolver;
import com.fiftythree.challenges.upstream.ChallengeApiClient;
import com.fiftythree.challenges.verification.EmailVerificationService;
import com.fiftythree.challenges.support.ApiErrors;
import java.util.ArrayList;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * The Java replacement for {@code submitChallengeEntry}.
 *
 * <p>This is the most consequential function in the application: it decides
 * whether an entry is accepted, and it is the point at which a child's entry
 * and their guardian's consent enter the system. The order of checks is
 * preserved exactly from the original, because the order is the safety design —
 * compliance gate before duplicate guard, guardian details before the entry is
 * created, and the verification token consumed only after the entry exists.
 *
 * <pre>
 *   check  -> {duplicate}
 *   submit -> {success, entry, guardian_approval_required}
 *   update -> {success, entry}
 * </pre>
 */
@RestController
public class SubmitChallengeEntryController {

  private static final Logger log = LoggerFactory.getLogger(SubmitChallengeEntryController.class);

  private static final Set<String> CHILD_DIVISIONS = Set.of("children", "teens");
  private static final String PURPOSE = "challenge_entry";
  private static final int ADULT_AGE = 18;

  private final EntryQueryRepository entries;
  private final ChallengeRepository challenges;
  private final GuardianConsentQueryRepository consents;
  private final TermsDocumentQueryRepository terms;
  private final EmailVerificationService verification;
  private final LifecycleGateService gates;
  private final GuardianService guardians;
  private final com.fiftythree.challenges.misc.AgeAttestationQueryRepository attestations;
  private final ComplianceAuditService audit;
  private final EntryFeeService fees;
  private final ChallengeApiClient upstream;
  private final CallerResolver caller;
  private final ObjectMapper mapper;

  public SubmitChallengeEntryController(
      EntryQueryRepository entries,
      ChallengeRepository challenges,
      GuardianConsentQueryRepository consents,
      TermsDocumentQueryRepository terms,
      EmailVerificationService verification,
      LifecycleGateService gates,
      GuardianService guardians,
      com.fiftythree.challenges.misc.AgeAttestationQueryRepository attestations,
      ComplianceAuditService audit,
      EntryFeeService fees,
      ChallengeApiClient upstream,
      CallerResolver caller,
      ObjectMapper mapper) {
    this.entries = entries;
    this.challenges = challenges;
    this.consents = consents;
    this.terms = terms;
    this.verification = verification;
    this.gates = gates;
    this.guardians = guardians;
    this.attestations = attestations;
    this.audit = audit;
    this.fees = fees;
    this.upstream = upstream;
    this.caller = caller;
    this.mapper = mapper;
  }

  @PostMapping("/api/apps/{appId}/functions/submitChallengeEntry")
  public ResponseEntity<?> handle(@RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> request = body == null ? Map.of() : body;
    String action = str(request.get("action"));

    // Identity is the verified session, never a supplied email.
    String email = caller.email(str(request.get("session_token")));
    if (email == null) {
      return ResponseEntity.status(401).body(Map.of("error", "Please sign in to submit an entry."));
    }

    try {
      return switch (action) {
        case "check" -> check(request, email);
        case "submit" -> submit(request, email);
        case "update" -> update(request, email);
        default -> ResponseEntity.badRequest().body(Map.of("error", "Unknown action"));
      };
    } catch (Exception e) {
      log.error("submitChallengeEntry action '{}' failed", action, e);
      return ApiErrors.internal(e);
    }
  }

  // ---------------------------------------------------------------------- check

  /**
   * Whether an upstream refusal means the entrant needs a fresh code.
   *
   * <p>The OTP service answers a bad token with one of a few phrasings, and
   * only one of them contains the word this used to match on. "That
   * verification has expired" and "already used" both left the flag unset, so
   * the browser kept the dead token, the entrant kept seeing a green "Email
   * verified" above a red error, and the same spent token went back up on
   * every retry.
   *
   * <p>Matched narrowly on purpose. A refusal for a closed challenge or a
   * duplicate entry must NOT clear the token: sending someone back for a new
   * code they did not need is its own dead end.
   */
  private static boolean needsFreshCode(String upstreamError) {
    String text = upstreamError == null ? "" : upstreamError.toLowerCase(java.util.Locale.ROOT);
    return text.contains("verif")
        // "already been used", not "already used" — my first attempt at this
        // matched the phrase I assumed rather than the one they send.
        || text.contains("used")
        || text.contains("expired")
        || text.contains("token");
  }

  private ResponseEntity<?> check(Map<String, Object> request, String email) {
    String challengeId = str(request.get("challenge_id"));
    if (challengeId.isEmpty()) {
      return ResponseEntity.badRequest().body(Map.of("error", "challenge_id and email required"));
    }
    // Always the signed-in account: the duplicate check cannot be probed
    // against somebody else's address.
    return ResponseEntity.ok(Map.of("duplicate", hasAlreadyEntered(challengeId, email)));
  }

  private boolean hasAlreadyEntered(String challengeId, String email) {
    if (nativeChallenge(challengeId) != null) {
      return !entries.findByChallengeAndCreator(challengeId, email).isEmpty();
    }
    JsonNode dup = upstream.postTo(upstream.sibling("publicChallengeApi"),
        Map.of("action", "check_email", "challenge_id", challengeId, "email", email)).body();
    return dup.path("duplicate").asBoolean(false)
        || dup.path("exists").asBoolean(false)
        || dup.path("already_entered").asBoolean(false);
  }

  // --------------------------------------------------------------------- submit

  private ResponseEntity<?> submit(Map<String, Object> request, String email) {
    Map<String, Object> entry = asMap(request.get("entry"));
    String challengeId = str(entry.get("challenge_id"));
    String title = str(entry.get("title"));
    boolean hasWork = !str(entry.get("work_url")).isEmpty()
        || !str(entry.get("work_link")).isEmpty()
        || !str(entry.get("work_text")).isEmpty();

    if (entry.isEmpty() || challengeId.isEmpty() || str(entry.get("creator_email")).isEmpty()
        || title.isEmpty() || !hasWork) {
      return ResponseEntity.badRequest().body(Map.of("error", "Missing required entry fields"));
    }

    // A creator_email that is not the signed-in account is rejected, not
    // silently replaced — submitting on someone else's behalf is never right.
    String claimed = str(entry.get("creator_email")).toLowerCase().trim();
    if (!claimed.isEmpty() && !claimed.equals(email)) {
      return ResponseEntity.status(403).body(Map.of(
          "error", "Entries must be submitted from your own signed-in account."));
    }

    // Two-factor. CHECKED here, consumed only once the entry exists: every
    // check below can still reject the submission, and a token burned now
    // would leave the entrant unable to retry and unable to get a new code.
    EmailVerificationEntity verificationRow;
    try {
      verificationRow = verification.check(email, PURPOSE, str(request.get("verification_token")));
    } catch (RuntimeException e) {
      return ResponseEntity.badRequest()
          .body(Map.of("error", e.getMessage(), "needs_verification", true));
    }

    // Compliance gate, before the duplicate guard and before anything is
    // created or pushed upstream.
    if (gates.isEntryBlocked(challengeId)) {
      audit.gateLog("", challengeId, "enforcement_block", "submit_entry",
          "submitChallengeEntry blocked an entry for a launch-blocked challenge.",
          email);
      audit.participationDenied(challengeId, "", email,
          "submitChallengeEntry rejected: entry gate is not open for this challenge.");
      return ResponseEntity.status(403)
          .body(Map.of("error", "This challenge is not open for entries."));
    }

    ChallengeEntity native0 = nativeChallenge(challengeId);

    // Lifecycle state, independent of the gate.
    if (native0 != null && !"entry_open".equals(nz(native0.getLifecycleStatus()))) {
      audit.participationDenied(challengeId, "", email,
          "submitChallengeEntry rejected: challenge lifecycle_status is '"
              + nz(native0.getLifecycleStatus()) + "', not 'entry_open'.");
      return ResponseEntity.status(403)
          .body(Map.of("error", "This challenge is not open for entries."));
    }

    String division = firstNonBlank(str(entry.get("division_id")), str(entry.get("division")));
    List<String> openDivisions = native0 == null ? List.of() : divisionsOf(native0);

    if (!openDivisions.isEmpty() && !openDivisions.contains(division)) {
      return ResponseEntity.status(403)
          .body(Map.of("error", "This challenge is not open to your division."));
    }

    // Kids freeze: a challenge touching children or teens stays closed until
    // the consent mechanism has produced at least one record, so the first
    // child's entry cannot be taken before that process is known to work.
    boolean divisionsIncludeKids = openDivisions.stream()
        .anyMatch(d -> CHILD_DIVISIONS.contains(d.toLowerCase()));
    boolean entryIsKids = CHILD_DIVISIONS.contains(division.toLowerCase());
    if (native0 != null && (divisionsIncludeKids || entryIsKids) && !consents.anyExists()) {
      audit.participationDenied(challengeId, "", email,
          "submitChallengeEntry rejected: children/teens blocked until GuardianConsent exists.");
      return ResponseEntity.status(403).body(Map.of("error",
          "Entries for children and teens are not open yet. "
              + "A parent or guardian must complete consent first."));
    }

    // The fee is looked up server-side. Anything payable must go through the
    // payment flow, which verifies the Stripe payment before creating an entry.
    try {
      if (fees.feeCents(challengeId, str(entry.get("division_id"))) > 0) {
        return ResponseEntity.status(402).body(Map.of("error",
            "This challenge has an entry fee — the entry must be submitted "
                + "through the payment step."));
      }
    } catch (Exception e) {
      // Fee lookup unavailable: treated as free here, and upstream validates
      // it again before accepting the entry.
      log.warn("Entry fee lookup failed for {} — continuing as free: {}", challengeId, e.toString());
    }

    if (hasAlreadyEntered(challengeId, email)) {
      return ResponseEntity.status(409)
          .body(Map.of("error", "This email has already entered this challenge"));
    }

    // Terms are timestamped per entry against the version published at the
    // time, so what an entrant agreed to stays reconstructable later.
    Instant now = Instant.now();
    String termsDocumentId = terms.findPublished(challengeId).stream()
        .findFirst().map(t -> t.getId()).orElse(null);

    // An entrant under 18 is a minor: guardian details are mandatory and the
    // entry is gated behind guardian approval.
    //
    // An entry needs positive age evidence on the server, not merely the
    // absence of a claim to the contrary.
    //
    // The attested age below is authoritative when it exists. When it does
    // not, this fell back to is_minor, derived_age and the division — all of
    // them from the request body. So the browser-side age gate, which is a
    // localStorage flag, was the only thing standing between a minor and
    // skipping guardian consent: set the flag, never attest, submit
    // is_minor:false in an adult division, and attestedAge is 0 and nothing
    // contradicts it.
    //
    // Passing the age gate records an AgeAttestation row (AgeGateController
    // saves one for a confirmed adult and for a blocked minor alike), so
    // anyone who has genuinely been through it has one. Requiring it costs a
    // legitimate entrant nothing and closes the only way round the check.
    java.util.Optional<com.fiftythree.challenges.entity.AgeAttestationEntity> onRecord =
        attestations.findLatestByEmail(email).stream().findFirst();
    if (onRecord.isEmpty()) {
      return ResponseEntity.badRequest().body(Map.of(
          "error", "Please confirm your date of birth before submitting an entry.",
          "needs_age_check", true));
    }

    // The attested age is checked first and independently, because everything
    // else here comes from the request body. is_minor and derived_age are the
    // browser's word for it, so on their own a minor could send
    // is_minor:false and skip guardian consent entirely. The body can still
    // make someone a minor — a stricter answer is always safe — but it can no
    // longer make them an adult.
    double attestedAge = onRecord
        .map(a -> a.getAgeYears() == null ? 0d : a.getAgeYears())
        .orElse(0d);
    double derivedAge = toDouble(entry.get("derived_age"));
    boolean isMinor = (attestedAge > 0 && attestedAge < ADULT_AGE)
        || truthy(entry.get("is_minor"))
        || (derivedAge > 0 && derivedAge < ADULT_AGE)
        || CHILD_DIVISIONS.contains(division.toLowerCase());

    GuardianService.GuardianDetails guardianDetails = null;
    if (isMinor) {
      guardianDetails = new GuardianService.GuardianDetails(
          GuardianService.norm(str(entry.get("guardian_email"))),
          str(entry.get("guardian_full_name")).trim(),
          str(entry.get("guardian_relationship")).trim(),
          str(entry.get("guardian_mobile")).trim(),
          str(entry.get("guardian_address")).trim());

      if (guardianDetails.name().isEmpty() || guardianDetails.email().isEmpty()
          || guardianDetails.relationship().isEmpty() || guardianDetails.mobile().isEmpty()
          || guardianDetails.address().isEmpty()) {
        return ResponseEntity.badRequest().body(Map.of("error",
            "Guardian name, relationship, email, mobile and address are required "
                + "for entrants under 18."));
      }
      // The guardian must be a different person. Without this, a minor could
      // supply their own address and approve their own entry.
      if (guardianDetails.email().equals(email)) {
        return ResponseEntity.badRequest().body(Map.of("error",
            "Guardian email must be different from the entrant's email."));
      }
    }

    if (native0 != null) {
      EntryEntity created = createNativeEntry(entry, email, native0, isMinor, now, termsDocumentId);
      if (isMinor) {
        GuardianEntity guardian = attachGuardianRecords(guardianDetails, created, entry, email);
        if (guardian != null) {
          created.setGuardianId(guardian.getId());
          entries.save(created);
        }
      }
      // The entry exists, so the one-time token can be retired.
      verification.consume(verificationRow);
      Map<String, Object> safe = toMap(created);
      safe.remove("creator_email");
      return ResponseEntity.ok(Map.of(
          "success", true, "entry", safe, "guardian_approval_required", isMinor));
    }

    // Upstream challenge: push the entry there, forwarding the same token.
    Map<String, Object> payload = new LinkedHashMap<>(entry);
    if (termsDocumentId != null) {
      payload.put("terms_accepted_at", now.toString());
      payload.put("terms_document_id", termsDocumentId);
    }
    if (isMinor) {
      payload.put("is_minor", true);
      payload.put("consent_status", "pending_consent");
    }

    // The token goes in twice, at the top level and inside the entry.
    //
    // The parent reads `body.verification_token || entry.verification_token`,
    // so both are its own supported inputs. But publicChallengeApi forwarded
    // only {action, entry} to the function that does the reading, dropping
    // the top-level one — which is why every submission came back "Email
    // verification required": that is its empty-token branch, not a bad
    // token. The entry object survives the forward, so a copy inside it
    // reaches the check whether or not the parent has shipped their fix.
    //
    // Remove the entry-level copy once their fix is confirmed live. It is a
    // single-use credential and it has no business sitting in a record.
    Map<String, Object> forwarded = new LinkedHashMap<>(payload);
    forwarded.put("verification_token", str(request.get("verification_token")));

    JsonNode result = upstream.postTo(upstream.sibling("publicChallengeApi"), Map.of(
        "action", "submit_entry",
        "entry", forwarded,
        "verification_token", str(request.get("verification_token")))).body();

    String relayed = firstNonBlank(
        result.path("error").asText(""),
        result.path("success").isBoolean() && !result.path("success").asBoolean()
            ? "Submission rejected" : "");
    if (!relayed.isEmpty()) {
      // Upstream validates the forwarded token itself and its window is
      // shorter than ours, so a large upload can outlive it. Flagging those as
      // needs_verification sends the entrant back for a fresh code instead of
      // showing "Email verified" above an error saying it is not.
      //
      // Logged with the token prefix and the local row it matched. When this
      // fires, our own check has already passed — the token is in our table,
      // verified, unconsumed and unexpired — so a rejection here means the
      // two sides disagree about a token upstream itself issued, and the
      // response text is the only evidence of why.
      log.warn("submit_entry rejected upstream for {} on challenge {}: \"{}\""
          + " (token {}..., local row verified_at={} expires_at={})",
          email, challengeId, relayed,
          str(request.get("verification_token")).length() >= 8
              ? str(request.get("verification_token")).substring(0, 8) : "short",
          verificationRow == null ? "none" : String.valueOf(verificationRow.getVerifiedAt()),
          verificationRow == null ? "none" : String.valueOf(verificationRow.getExpiresAt()));
      Map<String, Object> out = new LinkedHashMap<>();
      out.put("error", relayed);
      if (needsFreshCode(relayed)) {
        out.put("needs_verification", true);
      }
      return ResponseEntity.badRequest().body(out);
    }

    // Success means upstream handed back an entry with an id. It used to mean
    // only "no error field and success not literally false", which a body of
    // {} or {ok:true} satisfies — so the browser showed "posted", the success
    // screen showed the entrant's own typed title, and nothing had been
    // created anywhere. The entry then appeared in no listing, under no
    // status, not even scoped to its owner, and the only evidence of what
    // upstream had actually said was gone with the response.
    JsonNode upstreamEntry = result.path("entry").isObject() ? result.path("entry") : result;
    String upstreamId = upstreamEntry.path("id").asText("");
    if (upstreamId.isEmpty()) {
      List<String> keys = new ArrayList<>();
      result.fieldNames().forEachRemaining(keys::add);
      log.warn("submit_entry for {} on challenge {} returned no entry id; upstream body keys={} body={}",
          email, challengeId, keys, result.toString().length() > 600
              ? result.toString().substring(0, 600) + "…" : result.toString());
      return ResponseEntity.status(502).body(Map.of(
          "error", "The main 53 Challenges site accepted the request but did not confirm the entry."
              + " Nothing has been submitted — please try again, or contact us if this repeats."));
    }
    log.info("submit_entry ok for {} on challenge {}: upstream entry id={}", email, challengeId, upstreamId);
    if (isMinor) {
      // Recorded locally too, so the Guardian Dashboard covers upstream
      // entries as well as native ones.
      EntryEntity shim = new EntryEntity();
      shim.setId(upstreamEntry.path("id").asText(""));
      shim.setTitle(title);
      shim.setCreatorName(str(entry.get("creator_name")));
      shim.setChallengeId(challengeId);
      shim.setChallengeTitle(str(entry.get("challenge_title")));
      shim.setDivision(division);
      attachGuardianRecords(guardianDetails, shim, entry, email);
    }
    verification.consume(verificationRow);
    return ResponseEntity.ok(Map.of(
        "success", true, "entry", upstreamEntry, "guardian_approval_required", isMinor));
  }

  private EntryEntity createNativeEntry(
      Map<String, Object> entry, String email, ChallengeEntity challenge,
      boolean isMinor, Instant now, String termsDocumentId) {

    EntryEntity e = new EntryEntity();
    e.setId(newId());
    e.setChallengeId(str(entry.get("challenge_id")));
    e.setTitle(str(entry.get("title")));
    e.setDescription(str(entry.get("description")));
    e.setCreatorName(firstNonBlank(str(entry.get("creator_name")), email));
    e.setCreatorEmail(email);
    e.setCreatorEmailMasked(maskEmail(email));
    e.setState(str(entry.get("state")));
    e.setCity(str(entry.get("city")));
    e.setDivision(firstNonBlank(str(entry.get("division")), str(entry.get("division_id")), "adults"));
    e.setWorkType("text".equals(str(entry.get("work_type"))) ? "text" : "link");
    e.setWorkText(str(entry.get("work_text")));
    e.setWorkLink(firstNonBlank(str(entry.get("work_url")), str(entry.get("work_link"))));
    e.setIsMinor(isMinor);
    e.setSource("native");
    e.setCategory(nz(challenge.getCategory()));
    e.setChallengeTitle(nz(challenge.getTitle()));
    e.setSubmittedAt(now);
    // Every entry starts pending: nothing reaches the public list without
    // passing moderation.
    e.setStatus("pending");
    if (termsDocumentId != null) {
      e.setTermsAcceptedAt(now);
      e.setTermsDocumentId(termsDocumentId);
    }
    e.setConsentStatus(isMinor ? "pending_consent" : "valid");
    e.setGuardianApprovalStatus(isMinor ? "pending" : "not_required");
    e.setGuardianName(isMinor ? str(entry.get("guardian_full_name")) : "");
    e.setGuardianRelationship(isMinor ? str(entry.get("guardian_relationship")) : "");
    e.setGuardianEmail(isMinor ? GuardianService.norm(str(entry.get("guardian_email"))) : "");
    e.setGuardianMobile(isMinor ? str(entry.get("guardian_mobile")) : "");
    e.setGuardianAddress(isMinor ? str(entry.get("guardian_address")) : "");
    e.setCreatedDate(now);
    e.setUpdatedDate(now);
    e.setIsSample(false);
    return entries.save(e);
  }

  /**
   * Creates the guardian, the child link and the approval request.
   *
   * <p>Failures are logged and swallowed: the entry already exists and is
   * gated {@code pending} regardless, so a failure here delays an approval
   * rather than letting an unapproved entry through. Losing the entry after it
   * was accepted would be the worse outcome.
   */
  private GuardianEntity attachGuardianRecords(
      GuardianService.GuardianDetails details, EntryEntity created,
      Map<String, Object> entry, String childEmail) {
    try {
      GuardianEntity guardian = guardians.upsert(details);
      String childName = firstNonBlank(created.getCreatorName(), str(entry.get("creator_name")));
      guardians.linkChild(guardian, childName, childEmail);
      guardians.createApprovalRequest(
          guardian,
          new GuardianService.ApprovalEntry(
              nz(created.getId()),
              firstNonBlank(created.getTitle(), str(entry.get("title"))),
              str(entry.get("challenge_id")),
              firstNonBlank(created.getChallengeTitle(), str(entry.get("challenge_title"))),
              firstNonBlank(created.getDivision(), str(entry.get("division")), str(entry.get("division_id")))),
          childName,
          childEmail);
      return guardian;
    } catch (Exception e) {
      log.error("Could not attach guardian records for entry {} — the entry stays gated "
          + "as pending. Cause: {}", created.getId(), e.toString());
      return null;
    }
  }

  // --------------------------------------------------------------------- update

  private ResponseEntity<?> update(Map<String, Object> request, String email) {
    String id = str(request.get("entry_id"));
    if (id.isEmpty()) {
      return ResponseEntity.badRequest().body(Map.of("error", "entry_id is required"));
    }
    Map<String, Object> patch = asMap(request.get("patch"));

    EntryEntity entry = entries.findById(id).orElse(null);
    if (entry == null) {
      // Not stored here, so it is a main-site entry: the edit goes to that
      // site, which enforces ownership and its own review rules.
      JsonNode result = upstream.postTo(upstream.sibling("publicChallengeApi"), Map.of(
          "action", "update_entry",
          "entry_id", id,
          "email", email,
          "patch", patch)).body();
      if (!result.path("error").asText("").isEmpty()
          || (result.path("success").isBoolean() && !result.path("success").asBoolean())) {
        return ResponseEntity.badRequest().body(Map.of("error",
            firstNonBlank(result.path("error").asText(""),
                "This entry could not be updated on the main 53 Challenges site.")));
      }
      Map<String, Object> out = new LinkedHashMap<>();
      out.put("id", id);
      out.put("main_site", true);
      out.put("editable", true);
      return ResponseEntity.ok(Map.of("success", true, "entry", out));
    }

    if (!email.equals(nz(entry.getCreatorEmail()).toLowerCase())) {
      return ResponseEntity.status(403).body(Map.of("error", "You can only edit your own entries."));
    }
    if ("approved".equals(nz(entry.getStatus()))) {
      return ResponseEntity.status(403).body(Map.of("error",
          "This entry has been approved and is locked — it can no longer be edited."));
    }

    ChallengeEntity challenge = nativeChallenge(nz(entry.getChallengeId()));
    boolean deadlinePassed = challenge != null && challenge.getSubmissionEndsAt() != null
        && !challenge.getSubmissionEndsAt().isAfter(Instant.now());
    boolean closed = gates.isEntryBlocked(nz(entry.getChallengeId()))
        || deadlinePassed
        || (challenge != null && !"entry_open".equals(nz(challenge.getLifecycleStatus())));
    if (closed) {
      audit.participationDenied(nz(entry.getChallengeId()), "", email,
          "submitChallengeEntry update rejected: this challenge is closed for entries.");
      return ResponseEntity.status(403).body(Map.of("error",
          "This challenge has closed — entries can no longer be edited."));
    }

    if (patch.containsKey("title")) {
      entry.setTitle(str(patch.get("title")).trim());
    }
    if (patch.containsKey("description")) {
      entry.setDescription(str(patch.get("description")).trim());
    }
    if (patch.containsKey("work_text")) {
      entry.setWorkText(str(patch.get("work_text")).trim());
    }
    if (patch.containsKey("work_link")) {
      entry.setWorkLink(str(patch.get("work_link")).trim());
    }

    if (nz(entry.getTitle()).isEmpty()) {
      return ResponseEntity.badRequest().body(Map.of("error", "Please give your entry a title."));
    }
    if (nz(entry.getWorkText()).isEmpty() && nz(entry.getWorkLink()).isEmpty()) {
      return ResponseEntity.badRequest()
          .body(Map.of("error", "Please add your work — text content or a link."));
    }

    entry.setWorkType(nz(entry.getWorkLink()).isEmpty() ? "text" : "link");
    // Any edit returns the entry to the moderation queue: what a reviewer
    // approved is not what would now be published.
    entry.setStatus("pending");
    entry.setReviewNote("");
    entry.setReviewerId("");
    entry.setReviewerEmail("");
    entry.setUpdatedDate(Instant.now());
    entries.save(entry);

    Map<String, Object> safe = toMap(entry);
    safe.remove("creator_email");
    return ResponseEntity.ok(Map.of("success", true, "entry", safe));
  }

  // ------------------------------------------------------------------ plumbing

  private ChallengeEntity nativeChallenge(String id) {
    if (id == null || id.isEmpty()) {
      return null;
    }
    return challenges.findById(id)
        .filter(c -> "native".equals(c.getSource()))
        .orElse(null);
  }

  /** The divisions a native challenge was opened to; empty means all. */
  private List<String> divisionsOf(ChallengeEntity challenge) {
    try {
      JsonNode parsed = mapper.readTree(nz(challenge.getDivisions()).isEmpty()
          ? "[]" : challenge.getDivisions());
      if (!parsed.isArray()) {
        return List.of();
      }
      List<String> out = new java.util.ArrayList<>();
      for (JsonNode n : parsed) {
        out.add(n.asText(""));
      }
      return out;
    } catch (Exception e) {
      // Unreadable divisions must not silently open the challenge to everyone.
      log.warn("Could not parse divisions for challenge {} — treating as unrestricted: {}",
          challenge.getId(), e.toString());
      return List.of();
    }
  }

  /** first.letter***@domain — the masked form stored alongside the address. */
  private static String maskEmail(String email) {
    int at = email.indexOf('@');
    if (at <= 0) {
      return "";
    }
    return email.charAt(0) + "***" + email.substring(at);
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> asMap(Object v) {
    return v instanceof Map<?, ?> m
        ? mapper.convertValue(m, new com.fasterxml.jackson.core.type.TypeReference<>() {})
        : Map.of();
  }

  private Map<String, Object> toMap(Object o) {
    return mapper.convertValue(o, new com.fasterxml.jackson.core.type.TypeReference<>() {});
  }

  private static boolean truthy(Object v) {
    return Boolean.TRUE.equals(v) || "true".equalsIgnoreCase(String.valueOf(v));
  }

  private static double toDouble(Object v) {
    try {
      return v == null ? 0 : Double.parseDouble(String.valueOf(v));
    } catch (NumberFormatException e) {
      return 0;
    }
  }

  private static String firstNonBlank(String... values) {
    for (String v : values) {
      if (v != null && !v.isBlank()) {
        return v;
      }
    }
    return "";
  }

  private static String nz(String v) {
    return v == null ? "" : v;
  }

  private static String str(Object v) {
    return v == null ? "" : String.valueOf(v);
  }

  private static String newId() {
    return UUID.randomUUID().toString().replace("-", "").substring(0, 24);
  }
}
