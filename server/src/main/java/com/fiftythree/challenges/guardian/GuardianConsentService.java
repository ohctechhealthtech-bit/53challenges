package com.fiftythree.challenges.guardian;

import com.fiftythree.challenges.entity.EntryEntity;
import com.fiftythree.challenges.entity.GuardianConsentEntity;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/**
 * What a guardian's consent actually permits.
 *
 * <p>Consent is not one flag. A guardian can allow a child to enter and have
 * their work judged without agreeing to it being shown publicly, used in
 * promotion, or used to contact the child directly. Each of those is a separate
 * scope, and every rule here reads the specific scope rather than a general
 * "consented" boolean.
 *
 * <p>All checks fail closed: no consent record, a record that is not granted,
 * or a missing scope all mean not permitted.
 */
@Service
public class GuardianConsentService {

  /**
   * Without all three, there is no usable consent at all — these cover
   * entering, accepting the terms, and processing the child's personal
   * information.
   */
  public static final List<String> MINIMUM_SCOPES = List.of(
      "scopes_entering_challenge",
      "scopes_terms_acceptance",
      "scopes_personal_info_processing");

  public static final List<String> ALL_SCOPES = List.of(
      "scopes_entering_challenge",
      "scopes_terms_acceptance",
      "scopes_personal_info_processing",
      "scopes_public_display_name",
      "scopes_public_display_age_bracket",
      "scopes_publication_of_entry_media",
      "scopes_promotional_reuse",
      "scopes_direct_communication_with_minor",
      "scopes_public_voting_participation",
      "scopes_prize_acceptance_payment",
      "scopes_event_travel_attendance",
      "scopes_appears_in_entry");

  /** Divisions shown to judges, who never see an exact age or identity. */
  private static final Map<String, String> BRACKETS = Map.of(
      "children", "Under 13",
      "teens", "13–17",
      "adults", "18+",
      "ndi", "NDI");

  private final GuardianConsentQueryRepository consents;

  public GuardianConsentService(GuardianConsentQueryRepository consents) {
    this.consents = consents;
  }

  /** Granted, with all three minimum scopes. */
  public boolean hasMinimumConsent(GuardianConsentEntity c) {
    if (c == null || !"granted".equals(nz(c.getStatus()))) {
      return false;
    }
    return Boolean.TRUE.equals(c.getScopesEnteringChallenge())
        && Boolean.TRUE.equals(c.getScopesTermsAcceptance())
        && Boolean.TRUE.equals(c.getScopesPersonalInfoProcessing());
  }

  /**
   * Whether an entry may appear in the public gallery and voting.
   *
   * <p>A child's entry stays invisible until publication of their media is
   * specifically granted — the minimum scopes are not enough, because agreeing
   * to enter is not agreeing to be published.
   */
  public boolean isVisibleToPublic(EntryEntity entry, GuardianConsentEntity consent) {
    if (entry == null) {
      return false;
    }
    if (!Boolean.TRUE.equals(entry.getIsMinor())) {
      return true;
    }
    return consent != null
        && "granted".equals(nz(consent.getStatus()))
        && Boolean.TRUE.equals(consent.getScopesPublicationOfEntryMedia());
  }

  /**
   * Whether an entry may be judged.
   *
   * <p>Entry-level consent is enough: judges see the work and an eligibility
   * bracket, never the child's name, age or identity — so judging does not
   * require the publication scope that public display does.
   */
  public boolean isValidForJudging(EntryEntity entry, GuardianConsentEntity consent) {
    if (entry == null) {
      return false;
    }
    if (!Boolean.TRUE.equals(entry.getIsMinor())) {
      return true;
    }
    return hasMinimumConsent(consent);
  }

  /**
   * A child's displayed name: first name only.
   *
   * <p>The platform floor is first name and state, never a full name, age or
   * date of birth.
   */
  public static String maskMinorName(String fullName) {
    if (fullName == null || fullName.isBlank()) {
      return "";
    }
    return fullName.trim().split("\\s+")[0];
  }

  /** The bracket a judge sees instead of an age. */
  public static String eligibilityBracket(EntryEntity entry) {
    if (entry == null) {
      return "";
    }
    String division = entry.getDivision() == null || entry.getDivision().isBlank()
        ? "adults" : entry.getDivision();
    return BRACKETS.getOrDefault(division, "Eligible");
  }

  /** Prize money for a child goes to the verified guardian, when that is consented. */
  public boolean routesPrizeToGuardian(EntryEntity entry, GuardianConsentEntity consent) {
    if (entry == null || !Boolean.TRUE.equals(entry.getIsMinor())) {
      return false;
    }
    return consent != null
        && "granted".equals(nz(consent.getStatus()))
        && Boolean.TRUE.equals(consent.getScopesPrizeAcceptancePayment());
  }

  /** The consent_status an entry should carry, given its consent record. */
  public String deriveEntryConsentStatus(GuardianConsentEntity consent) {
    if (consent == null) {
      return "pending_consent";
    }
    if ("withdrawn".equals(nz(consent.getStatus()))) {
      return "withdrawn";
    }
    return hasMinimumConsent(consent) ? "valid" : "pending_consent";
  }

  /** The most recent consent for a child's entry, or null. */
  public GuardianConsentEntity forEntry(EntryEntity entry) {
    if (entry == null || !Boolean.TRUE.equals(entry.getIsMinor())) {
      return null;
    }
    return consents.findForEntry(nz(entry.getChallengeId()), nz(entry.getId()))
        .stream().findFirst().orElse(null);
  }

  private static String nz(String v) {
    return v == null ? "" : v;
  }
}
