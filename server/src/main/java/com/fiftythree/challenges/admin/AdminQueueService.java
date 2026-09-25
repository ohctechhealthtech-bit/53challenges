package com.fiftythree.challenges.admin;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiftythree.challenges.engine.EntryQueryRepository;
import com.fiftythree.challenges.entity.ChallengeDraftEntity;
import com.fiftythree.challenges.entity.ComplianceAssessmentFindingEntity;
import com.fiftythree.challenges.entity.EntryEntity;
import com.fiftythree.challenges.entity.JudgeProfileEntity;
import com.fiftythree.challenges.entity.MessageEntity;
import com.fiftythree.challenges.entity.PartnerInquiryEntity;
import com.fiftythree.challenges.entity.SponsorProfileEntity;
import com.fiftythree.challenges.upstream.ChallengeApiClient;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * The one source of every "waiting for the admin" queue.
 *
 * <p>Both the dashboard tiles and the waiting-longest list read this, so a
 * count can never disagree with the list it links to — which is the entire
 * reason the original put them in one place rather than counting separately.
 */
@Service
public class AdminQueueService {

  private static final Logger log = LoggerFactory.getLogger(AdminQueueService.class);

  private final EntryQueryRepository entries;
  private final AdminQueueRepositories repos;
  private final ChallengeApiClient upstream;
  private final ObjectMapper mapper;

  public AdminQueueService(
      EntryQueryRepository entries,
      AdminQueueRepositories repos,
      ChallengeApiClient upstream,
      ObjectMapper mapper) {
    this.entries = entries;
    this.repos = repos;
    this.upstream = upstream;
    this.mapper = mapper;
  }

  /** Every queue, each carrying its own items; the count is always items.size(). */
  public List<Map<String, Object>> build() {
    List<Map<String, Object>> queues = new ArrayList<>();

    List<EntryEntity> pending = entries.findByStatus("pending");
    queues.add(queue("content", "Entries to approve",
        "Nothing is publicly visible until it's approved.",
        "/dashboard?tab=content",
        pending.stream().map(e -> item(e.getId(), e.getTitle(),
            e.getSubmittedAt() != null ? e.getSubmittedAt() : e.getCreatedDate(),
            nz(e.getChallengeTitle()))).toList()));

    queues.add(queue("ideas", "New challenge ideas",
        "Sent in through “Tell us your idea”.",
        "/dashboard?tab=hostrequests&sub=ideas",
        newIdeas()));

    // Templates are not applications waiting on anyone.
    List<ChallengeDraftEntity> drafts = repos.drafts().findByReviewStatus("submitted_for_review")
        .stream().filter(d -> !Boolean.TRUE.equals(d.getIsTemplate())).toList();
    queues.add(queue("proposals", "Challenge applications",
        "Host applications waiting for your approval.",
        "/dashboard?tab=hostrequests&sub=host",
        drafts.stream().map(d -> item(d.getId(), d.getChallengeTitle(),
            d.getCreatedDate(), nz(d.getHostType()))).toList()));

    queues.add(queue("enquiries", "Host enquiries",
        "Organisations asking about running a challenge.",
        "/dashboard?tab=partnerships",
        repos.inquiries().findByStatus("new").stream()
            .map((PartnerInquiryEntity p) -> item(p.getId(), p.getCompanyName(),
                p.getCreatedDate(), nz(p.getChallengeTitle()))).toList()));

    queues.add(queue("judges", "Judge applications",
        "People applying to join the judging panel.",
        "/dashboard?tab=judges",
        repos.judges().findByStatus("applicant").stream()
            .map((JudgeProfileEntity j) -> item(j.getId(), j.getName(),
                j.getCreatedDate(), nz(j.getState()))).toList()));

    queues.add(queue("sponsors", "Sponsor applications",
        "Sponsors waiting to be activated.",
        "/marketing",
        repos.sponsors().findByStatus("pending").stream()
            .map((SponsorProfileEntity s) -> item(s.getId(), s.getName(),
                s.getCreatedDate(), nz(s.getOrganisation()))).toList()));

    queues.add(queue("compliance", "Blocked compliance items",
        "These stop a challenge from moving forward.",
        "/compliance-gate",
        repos.findings().findOpenBlocking().stream()
            .map((ComplianceAssessmentFindingEntity f) -> item(f.getId(),
                firstNonBlank(f.getRuleCode(), f.getObligationType(), "Compliance item"),
                f.getCreatedDate(), nz(f.getGate()))).toList()));

    queues.add(queue("messages", "Unread messages",
        "Participants waiting on a reply.",
        "/dashboard?tab=messages",
        repos.messages().findUnreadFromUsers().stream()
            .map((MessageEntity m) -> item(m.getId(),
                firstNonBlank(m.getParticipantName(), m.getParticipantEmail(), "Participant"),
                m.getCreatedDate(), nz(m.getSubject()))).toList()));

    return queues;
  }

  /**
   * Ideas submitted through "Tell us your idea", which live on the parent app.
   *
   * <p>Returns empty when the parent is unreachable, matching the original: one
   * upstream outage should cost a tile, not the whole dashboard.
   */
  private List<Map<String, Object>> newIdeas() {
    try {
      JsonNode body = upstream.postTo(upstream.sibling("hostIdeaApi"),
          Map.of("action", "ideas", "limit", "200")).body();
      JsonNode list = body.path("ideas").isArray() ? body.path("ideas") : body.path("requests");
      if (!list.isArray()) {
        return List.of();
      }
      List<Map<String, Object>> out = new ArrayList<>();
      for (JsonNode rec : list) {
        String status = rec.path("status").asText("new");
        if (!"new".equals(status)) {
          continue;
        }
        out.add(item(
            rec.path("id").asText(""),
            firstNonBlank(rec.path("working_title").asText(""), rec.path("company_name").asText("")),
            rec.path("submitted_at").asText(rec.path("created_date").asText("")),
            rec.path("company_name").asText("")));
      }
      return out;
    } catch (Exception e) {
      log.warn("Could not load challenge ideas from the parent app: {}", e.toString());
      return List.of();
    }
  }

  private static Map<String, Object> queue(
      String key, String label, String hint, String link, List<Map<String, Object>> items) {
    Map<String, Object> q = new LinkedHashMap<>();
    q.put("key", key);
    q.put("label", label);
    q.put("hint", hint);
    q.put("link", link);
    q.put("items", items);
    // Derived, never stored: a count that can drift from its list is the bug
    // this structure exists to prevent.
    q.put("count", items.size());
    return q;
  }

  private static Map<String, Object> item(String id, String name, Object since, String note) {
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("id", nz(id));
    m.put("name", name == null || name.isBlank() ? "Untitled" : name);
    m.put("since", since == null ? "" : (since instanceof Instant i ? i.toString() : String.valueOf(since)));
    m.put("note", nz(note));
    return m;
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
}
