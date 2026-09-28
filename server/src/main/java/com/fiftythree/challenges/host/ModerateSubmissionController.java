package com.fiftythree.challenges.host;

import com.fasterxml.jackson.databind.JsonNode;
import com.fiftythree.challenges.user.UserEntity;
import com.fiftythree.challenges.host.HostAccessService.OwnedChallenges;
import com.fiftythree.challenges.security.CallerResolver;
import com.fiftythree.challenges.upstream.ChallengeApiClient;
import com.fiftythree.challenges.upstream.ChallengeApiClient.UpstreamResponse;
import com.fiftythree.challenges.user.UserRepository;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * The Java replacement for {@code moderateSubmission}: the review queue for
 * participant submissions, which live on the main 53 Challenges site.
 *
 * <p>The main site decides permissions from the acting person's own role there.
 * A host whose review rights come from <em>this</em> app is unknown to it, so
 * when the main site refuses them, the request is retried through an account
 * the main site does accept as an admin — and only for entries on challenges
 * this app can confirm the host owns.
 *
 * <p>That delegation is the sensitive part: it acts with admin authority on
 * someone else's behalf. The ownership check before it is the only thing
 * keeping a host from reviewing entries that are not theirs.
 */
@RestController
public class ModerateSubmissionController {

  private static final Logger log = LoggerFactory.getLogger(ModerateSubmissionController.class);

  /** How many of this app's admins to try when looking for one the main site trusts. */
  private static final int DELEGATE_CANDIDATES = 5;

  private final HostAccessService hostAccess;
  private final UserRepository users;
  private final ChallengeApiClient upstream;
  private final CallerResolver caller;

  public ModerateSubmissionController(
      HostAccessService hostAccess,
      UserRepository users,
      ChallengeApiClient upstream,
      CallerResolver caller) {
    this.hostAccess = hostAccess;
    this.users = users;
    this.upstream = upstream;
    this.caller = caller;
  }

  @PostMapping("/api/apps/{appId}/functions/moderateSubmission")
  public ResponseEntity<?> handle(@RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> request = body == null ? Map.of() : body;

    // Identity comes from the session, never from the body. This read
    // acting_email from the request first and only fell back to the session,
    // so an unauthenticated caller could name any address and act as that
    // person in the moderation queue.
    //
    // A body-supplied address is still honoured for an admin, because acting
    // on someone's behalf is a real administrative need — but it now requires
    // being an admin to do it.
    String sessionToken = str(request.get("session_token"));
    String actingEmail = nz(caller.email(sessionToken));
    if (actingEmail.isEmpty()) {
      return ResponseEntity.status(401).body(Map.of("error", "Please sign in"));
    }
    String onBehalfOf = str(request.get("acting_email"));
    if (!onBehalfOf.isEmpty()
        && !onBehalfOf.equalsIgnoreCase(actingEmail)
        && caller.isAdmin(sessionToken)) {
      actingEmail = onBehalfOf;
    }

    String action = str(request.get("action"));
    Map<String, Object> payload = new LinkedHashMap<>(request);
    payload.put("acting_email", actingEmail);
    payload.remove("session_token");

    try {
      return switch (action) {
        case "queue" -> queue(payload, actingEmail, str(request.get("challenge_id")));
        case "decide" -> decide(payload, actingEmail);
        default -> passThrough(payload);
      };
    } catch (Exception e) {
      log.error("moderateSubmission action '{}' failed", action, e);
      return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
    }
  }

  private ResponseEntity<?> queue(
      Map<String, Object> payload, String actingEmail, String challengeId) {

    UpstreamResponse mine = ask(payload);
    if (mine.status() / 100 != 2) {
      return ResponseEntity.status(mine.status()).body(mine.body());
    }

    // The main site already recognises them as a reviewer.
    if (mine.body().path("is_admin").asBoolean(false)
        || mine.body().path("is_host").asBoolean(false)) {
      Map<String, Object> out = toMap(mine.body());
      out.put("entries", filterByChallenge(mine.body().path("entries"), challengeId));
      return ResponseEntity.ok(out);
    }

    // Not a reviewer there — but this app may have given them the challenge.
    OwnedChallenges owned = hostAccess.ownedBy(actingEmail);
    if (owned.isEmpty()) {
      return ResponseEntity.ok(mine.body());
    }

    Delegate delegate = findDelegate();
    if (delegate == null) {
      return ResponseEntity.ok(mine.body());
    }

    List<Map<String, Object>> entries = new ArrayList<>();
    for (JsonNode e : delegate.queue().path("entries")) {
      if (!owned.owns(e.path("challenge_id").asText(""), e.path("challenge_title").asText(""))) {
        continue;
      }
      if (!challengeId.isEmpty() && !challengeId.equals(e.path("challenge_id").asText(""))) {
        continue;
      }
      entries.add(toMap(e));
    }

    return ResponseEntity.ok(Map.of(
        "entries", entries,
        "is_admin", false,
        "is_host", true,
        "reviewer_email", actingEmail));
  }

  private ResponseEntity<?> decide(Map<String, Object> payload, String actingEmail) {
    // Try as the person themselves first: if the main site already trusts them,
    // no delegation is needed and the decision is recorded under their name.
    UpstreamResponse direct = ask(payload);
    boolean directWorked = direct.status() / 100 == 2
        && direct.body().path("error").asText("").isEmpty();
    if (directWorked) {
      return ResponseEntity.ok(direct.body());
    }

    OwnedChallenges owned = hostAccess.ownedBy(actingEmail);
    if (owned.isEmpty()) {
      return ResponseEntity.status(direct.status()).body(direct.body());
    }

    Delegate delegate = findDelegate();
    if (delegate == null) {
      return ResponseEntity.status(direct.status()).body(direct.body());
    }

    // The entry must be in the delegate's queue AND belong to a challenge this
    // host owns. Without both, delegation would let any host decide on any
    // entry the delegate can see.
    String entryId = str(payload.get("entry_id"));
    JsonNode entry = null;
    for (JsonNode e : delegate.queue().path("entries")) {
      if (entryId.equals(e.path("id").asText(""))) {
        entry = e;
        break;
      }
    }
    if (entry == null
        || !owned.owns(entry.path("challenge_id").asText(""), entry.path("challenge_title").asText(""))) {
      return ResponseEntity.status(direct.status()).body(direct.body());
    }

    Map<String, Object> viaDelegate = new LinkedHashMap<>(payload);
    viaDelegate.put("acting_email", delegate.email());
    UpstreamResponse result = ask(viaDelegate);
    return ResponseEntity.status(result.status() / 100 == 2 ? 200 : result.status())
        .body(result.body());
  }

  private ResponseEntity<?> passThrough(Map<String, Object> payload) {
    UpstreamResponse res = ask(payload);
    return ResponseEntity.status(res.status() / 100 == 2 ? 200 : res.status()).body(res.body());
  }

  /**
   * An account the main site treats as an admin, with its queue.
   *
   * <p>Returns null when none of this app's admins are known there, in which
   * case the host's own refusal stands rather than being worked around.
   */
  private Delegate findDelegate() {
    List<UserEntity> admins = users.findAll().stream()
        .filter(u -> "admin".equals(u.getRole()))
        .limit(DELEGATE_CANDIDATES)
        .toList();

    for (UserEntity admin : admins) {
      if (admin.getEmail() == null || admin.getEmail().isBlank()) {
        continue;
      }
      try {
        UpstreamResponse res = ask(Map.of("action", "queue", "acting_email", admin.getEmail()));
        if (res.body().path("is_admin").asBoolean(false)) {
          return new Delegate(admin.getEmail(), res.body());
        }
      } catch (Exception e) {
        log.debug("Delegate candidate {} rejected by the main site: {}",
            admin.getEmail(), e.toString());
      }
    }
    return null;
  }

  private UpstreamResponse ask(Map<String, Object> payload) {
    return upstream.postTo(upstream.sibling("moderateSubmission"), payload);
  }

  private static List<Map<String, Object>> filterByChallenge(JsonNode entries, String challengeId) {
    List<Map<String, Object>> out = new ArrayList<>();
    for (JsonNode e : entries) {
      if (challengeId.isEmpty() || challengeId.equals(e.path("challenge_id").asText(""))) {
        out.add(toMap(e));
      }
    }
    return out;
  }

  private static Map<String, Object> toMap(JsonNode node) {
    Map<String, Object> out = new LinkedHashMap<>();
    node.fields().forEachRemaining(f -> {
      JsonNode v = f.getValue();
      if (v.isNull()) {
        out.put(f.getKey(), null);
      } else if (v.isNumber()) {
        out.put(f.getKey(), v.numberValue());
      } else if (v.isBoolean()) {
        out.put(f.getKey(), v.booleanValue());
      } else if (v.isTextual()) {
        out.put(f.getKey(), v.textValue());
      } else {
        out.put(f.getKey(), v);
      }
    });
    return out;
  }

  private record Delegate(String email, JsonNode queue) {}

  private static String nz(String v) {
    return v == null ? "" : v;
  }

  private static String str(Object v) {
    return v == null ? "" : String.valueOf(v);
  }
}
