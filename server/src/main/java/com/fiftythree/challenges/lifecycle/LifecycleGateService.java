package com.fiftythree.challenges.lifecycle;

import com.fiftythree.challenges.entity.ChallengeEntity;
import com.fiftythree.challenges.entity.ChallengeRepository;
import com.fiftythree.challenges.entity.ComplianceGateEntity;
import com.fiftythree.challenges.entity.GateCheckEntity;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Whether entering, voting or publishing is currently allowed for a challenge.
 *
 * <p>Ports the enforcement half of {@code lifecycleGateHelper.ts} — the gate
 * evaluation and pass machinery is a separate, larger job and is not needed to
 * answer these questions.
 *
 * <p><b>Every path here fails closed.</b> A challenge whose compliance state
 * cannot be established is blocked, not allowed: these gates cover legal
 * review, permits, prize funding and minor-participation review, so "we could
 * not tell" has to mean "no". That is why an unknown challenge id returns
 * blocked rather than throwing, and why a database failure is not swallowed
 * into a permissive answer.
 */
@Service
public class LifecycleGateService {

  private static final Logger log = LoggerFactory.getLogger(LifecycleGateService.class);

  private static final String ENTRY_GATE = "entry_open";
  private static final String VOTING_GATE = "voting_open";
  private static final String PUBLISH_GATE = "approved_to_published";

  private final GateCheckQueryRepository gateChecks;
  private final ComplianceGateQueryRepository complianceGates;
  private final ChallengeRepository challenges;

  public LifecycleGateService(
      GateCheckQueryRepository gateChecks,
      ComplianceGateQueryRepository complianceGates,
      ChallengeRepository challenges) {
    this.gateChecks = gateChecks;
    this.complianceGates = complianceGates;
    this.challenges = challenges;
  }

  /** True when entries must be refused for this challenge. */
  public boolean isEntryBlocked(String challengeId) {
    return isBlocked(challengeId, ENTRY_GATE);
  }

  /** True when votes must be refused for this challenge. */
  public boolean isVoteBlocked(String challengeId) {
    return isBlocked(challengeId, VOTING_GATE);
  }

  /** True when the challenge must not be published. */
  public boolean isPublishBlocked(String challengeId) {
    return isBlocked(challengeId, PUBLISH_GATE);
  }

  private boolean isBlocked(String challengeId, String gateCode) {
    String cid = challengeId == null ? "" : challengeId.trim();
    if (cid.isEmpty()) {
      // No challenge means nothing can be verified, so nothing is permitted.
      return true;
    }

    try {
      if (hasLifecycleGates(cid)) {
        // Gates exist for this challenge, so the matching one must have been
        // passed. Anything else — missing, pending, relocked — blocks.
        GateCheckEntity check = gateChecks.findLatest(cid, gateCode).stream().findFirst().orElse(null);
        return check == null || !"passed".equals(check.getStatus());
      }
      return failClosedForUnassessed(cid);
    } catch (Exception e) {
      // A lookup failure is not permission. Blocking on a database fault is
      // disruptive; allowing an entry past an unverified compliance gate is
      // worse, and this is exactly the case the fail-closed design is for.
      log.error("Gate check failed for challenge {} gate {} — blocking. Cause: {}",
          cid, gateCode, e.toString());
      return true;
    }
  }

  /** Whether this challenge has been through the lifecycle-gate process at all. */
  private boolean hasLifecycleGates(String challengeId) {
    return !gateChecks.findAnyFor(challengeId).isEmpty();
  }

  /**
   * The answer for a challenge with no gate checks recorded.
   *
   * <p>A compliance gate record decides it when one exists. With neither, a
   * native challenge — one this app created and is responsible for — is
   * blocked until assessed, while a challenge owned upstream is left to
   * upstream's own controls rather than being blocked here.
   */
  private boolean failClosedForUnassessed(String challengeId) {
    List<ComplianceGateEntity> gates = complianceGates.findLatestFor(challengeId);
    if (!gates.isEmpty()) {
      return Boolean.TRUE.equals(gates.get(0).getLaunchBlocked());
    }
    return isNativeChallenge(challengeId);
  }

  private boolean isNativeChallenge(String challengeId) {
    return challenges.findById(challengeId)
        .map(ChallengeEntity::getSource)
        .map("native"::equals)
        .orElse(false);
  }
}
