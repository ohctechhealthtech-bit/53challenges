package com.fiftythree.challenges.host;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiftythree.challenges.admin.DraftRepo;
import com.fiftythree.challenges.entity.ChallengeDraftEntity;
import com.fiftythree.challenges.entity.ChallengeEntity;
import com.fiftythree.challenges.upstream.ChallengeApiClient;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Which challenges a host may look after.
 *
 * <p>The main 53 Challenges site owns participant submissions but knows nothing
 * about this app's host applications, so review rights are resolved here from
 * the host's own applications and the main site is then asked on their behalf.
 *
 * <p><b>Only host-managed challenges qualify.</b> When the 53 team manages the
 * content, entry review stays with the team — a host who applied for a
 * team-managed challenge gets no review rights over its entries.
 */
@Service
public class HostAccessService {

  private static final Logger log = LoggerFactory.getLogger(HostAccessService.class);

  private final DraftRepo drafts;
  private final ChallengeApiClient upstream;
  private final ObjectMapper mapper;

  public HostAccessService(DraftRepo drafts, ChallengeApiClient upstream, ObjectMapper mapper) {
    this.drafts = drafts;
    this.upstream = upstream;
    this.mapper = mapper;
  }

  /** The challenge ids and titles this host may review entries for. */
  public OwnedChallenges ownedBy(String email) {
    Set<String> ids = new LinkedHashSet<>();
    Set<String> titles = new LinkedHashSet<>();
    String me = norm(email);
    if (me.isEmpty()) {
      return new OwnedChallenges(ids, titles);
    }

    for (ChallengeDraftEntity d : drafts.findHostApplications()) {
      if (!me.equals(norm(hostEmailOf(d)))) {
        continue;
      }
      if (!"host_managed".equals(nz(d.getContentType()))) {
        continue;
      }
      if (!nz(d.getChallengeId()).isEmpty()) {
        ids.add(d.getChallengeId());
      }
      if (!nz(d.getChallengeTitle()).isEmpty()) {
        titles.add(norm(d.getChallengeTitle()));
      }
    }
    return new OwnedChallenges(ids, titles);
  }

  /**
   * The host's organisation, from the parent app.
   *
   * <p>Nothing about an organisation is stored in this database — every read
   * goes upstream, so there is no local copy to fall out of step.
   */
  public String organisationIdFor(String email) {
    try {
      JsonNode res = upstream.postTo(upstream.sibling("hostOrganisationApi"),
          Map.of("action", "organisation", "email", norm(email))).body();
      if (!res.path("found").asBoolean(false)) {
        return "";
      }
      return res.path("organisation").path("id").asText("");
    } catch (Exception e) {
      log.warn("Could not resolve organisation for {}: {}", email, e.toString());
      return "";
    }
  }

  /** The host email recorded on an application, which lives inside its JSON answers. */
  private String hostEmailOf(ChallengeDraftEntity draft) {
    try {
      String answers = nz(draft.getAnswers());
      if (answers.isEmpty()) {
        return "";
      }
      return mapper.readTree(answers).path("host_email").asText("");
    } catch (Exception e) {
      return "";
    }
  }

  /** Challenge ids and titles a host owns. Titles are normalised for comparison. */
  public record OwnedChallenges(Set<String> ids, Set<String> titles) {

    public boolean isEmpty() {
      return ids.isEmpty() && titles.isEmpty();
    }

    /**
     * Whether a queue entry from the main site belongs to one of them.
     *
     * <p>Title matching exists because the main site's entries do not always
     * carry a challenge id this app recognises. It is a fallback, not the
     * primary check — two challenges sharing a title would both match, which
     * is why the id is tried first.
     */
    public boolean owns(String challengeId, String challengeTitle) {
      if (challengeId != null && !challengeId.isBlank() && ids.contains(challengeId)) {
        return true;
      }
      return titles.contains(norm(challengeTitle));
    }
  }

  static String norm(String v) {
    return v == null ? "" : v.trim().toLowerCase();
  }

  private static String nz(String v) {
    return v == null ? "" : v;
  }
}
