package com.fiftythree.challenges.entry;

import com.fasterxml.jackson.databind.JsonNode;
import com.fiftythree.challenges.entity.ChallengeEntity;
import com.fiftythree.challenges.entity.ChallengeRepository;
import com.fiftythree.challenges.upstream.ChallengeApiClient;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/**
 * The entry fee for a challenge, in cents.
 *
 * <p>Always derived server-side. A fee supplied by the client would let anyone
 * turn a paid challenge into a free one by editing a request, so the number is
 * looked up here and the submission path refuses any challenge with a fee —
 * those must go through the payment flow, which verifies the Stripe payment
 * before the entry is created.
 */
@Service
public class EntryFeeService {

  private final ChallengeRepository challenges;
  private final ChallengeApiClient upstream;

  public EntryFeeService(ChallengeRepository challenges, ChallengeApiClient upstream) {
    this.challenges = challenges;
    this.upstream = upstream;
  }

  /**
   * @return the fee in cents; 0 when free
   * @throws IllegalStateException when the challenge cannot be found upstream
   */
  public long feeCents(String challengeId, String divisionId) {
    String id = challengeId == null ? "" : challengeId.trim();
    if (id.isEmpty()) {
      return 0;
    }

    // Native challenges — the ones this app owns — have no entry fee.
    ChallengeEntity native0 = challenges.findById(id).orElse(null);
    if (native0 != null && "native".equals(native0.getSource())) {
      return 0;
    }

    List<JsonNode> found = upstream.challenges(Map.of("id", id));
    if (found.isEmpty()) {
      throw new IllegalStateException("Challenge not found");
    }
    JsonNode challenge = found.get(0);

    // A division override wins over the challenge-wide fee: children's
    // divisions are often free where the adult one is not.
    double fee = challenge.path("entry_fee").asDouble(0);
    for (JsonNode override : challenge.path("division_fee_overrides")) {
      String overrideId = override.path("division_id").asText("");
      String overrideSlug = override.path("division_slug").asText("");
      if (divisionId != null && (divisionId.equals(overrideId) || divisionId.equals(overrideSlug))) {
        fee = override.path("amount").asDouble(fee);
        break;
      }
    }
    return Math.round(fee * 100);
  }
}
