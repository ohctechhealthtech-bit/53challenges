package com.fiftythree.challenges.host;

import com.fasterxml.jackson.databind.JsonNode;
import com.fiftythree.challenges.upstream.ChallengeApiClient;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * A host's organisation, read from the Host Organisations API.
 *
 * <p>Nothing about an organisation is stored in this app's database, and that
 * is deliberate: the parent owns organisations, memberships and ownership, so
 * a change made there is visible here immediately rather than needing a sync
 * that could disagree.
 *
 * <p>An unreachable parent returns "no organisation" rather than throwing. The
 * host dashboard then shows its "no workspace yet" state, which is wrong but
 * harmless, where an exception would show a broken page.
 */
@Service
public class HostOrganisationService {

  private static final Logger log = LoggerFactory.getLogger(HostOrganisationService.class);

  private final ChallengeApiClient upstream;

  public HostOrganisationService(ChallengeApiClient upstream) {
    this.upstream = upstream;
  }

  /** What the parent knows about one host's organisation. */
  public record Organisation(
      boolean found, JsonNode organisation, JsonNode membership, boolean isOwner) {

    public String id() {
      return found && organisation != null ? organisation.path("id").asText("") : "";
    }

    public Map<String, Object> toMap() {
      Map<String, Object> out = new LinkedHashMap<>();
      out.put("found", found);
      out.put("organisation", organisation);
      out.put("membership", membership);
      out.put("is_owner", isOwner);
      return out;
    }
  }

  private static final Organisation NONE =
      new Organisation(false, null, null, false);

  /** Looks an organisation up by member email. */
  public Organisation byEmail(String email) {
    if (email == null || email.isBlank()) {
      return NONE;
    }
    return lookup(Map.of("action", "organisation",
        "email", email.toLowerCase(Locale.ROOT)));
  }

  /** Looks an organisation up by its own id. */
  public Organisation byId(String organisationId) {
    if (organisationId == null || organisationId.isBlank()) {
      return NONE;
    }
    return lookup(Map.of("action", "organisation", "id", organisationId));
  }

  private Organisation lookup(Map<String, Object> payload) {
    try {
      JsonNode body = upstream.postTo(
          upstream.sibling("hostOrganisationApi"), payload).body();
      boolean found = body.path("found").asBoolean(false)
          && body.has("organisation")
          && !body.path("organisation").isNull();
      if (!found) {
        return NONE;
      }
      return new Organisation(true, body.path("organisation"),
          body.has("membership") ? body.path("membership") : null,
          body.path("is_owner").asBoolean(false));
    } catch (Exception e) {
      log.warn("Could not read the host organisation: {}", e.toString());
      return NONE;
    }
  }

  /** Everyone attached to an organisation. */
  public List<JsonNode> members(String organisationId) {
    if (organisationId == null || organisationId.isBlank()) {
      return List.of();
    }
    try {
      JsonNode body = upstream.postTo(upstream.sibling("hostOrganisationApi"),
          Map.of("action", "members", "organisation_id", organisationId)).body();
      JsonNode rows = body.path("members");
      if (!rows.isArray()) {
        return List.of();
      }
      List<JsonNode> out = new ArrayList<>();
      rows.forEach(out::add);
      return out;
    } catch (Exception e) {
      log.warn("Could not list organisation members: {}", e.toString());
      return List.of();
    }
  }

  /** Creates or updates an organisation on the parent. */
  public JsonNode save(String action, Map<String, Object> payload) {
    Map<String, Object> body = new LinkedHashMap<>(payload);
    body.put("action", action);
    try {
      return upstream.postTo(upstream.sibling("hostOrganisationApi"), body).body();
    } catch (Exception e) {
      log.warn("Could not save the host organisation: {}", e.toString());
      return null;
    }
  }
}
