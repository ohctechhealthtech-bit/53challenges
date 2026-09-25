package com.fiftythree.challenges.misc;

import com.fiftythree.challenges.entity.JudgeProfileEntity;
import com.fiftythree.challenges.entity.JudgeProfileRepository;
import com.fiftythree.challenges.entity.SponsorProfileEntity;
import com.fiftythree.challenges.entity.SponsorProfileRepository;
import com.fiftythree.challenges.support.JsonColumn;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * The Java replacement for {@code publicPanel}: the judges and sponsors shown
 * on the "53 Sponsor &amp; Judge" page.
 *
 * <p>Public and read-only. Only non-sensitive fields leave this method — a
 * judge's record also holds their email, working-with-children check number and
 * expiry, and conflict-of-interest declarations, none of which belong on a
 * public page. The response is built field by field rather than by serialising
 * the entity and removing things, so a column added later is excluded by
 * default instead of published by accident.
 */
@RestController
public class PublicPanelController {

  private static final Logger log = LoggerFactory.getLogger(PublicPanelController.class);

  private static final Set<String> PUBLIC_JUDGE_STATUSES = Set.of("approved", "active");

  private final JudgeProfileRepository judges;
  private final SponsorProfileRepository sponsors;
  private final JsonColumn json;

  public PublicPanelController(
      JudgeProfileRepository judges, SponsorProfileRepository sponsors, JsonColumn json) {
    this.judges = judges;
    this.sponsors = sponsors;
    this.json = json;
  }

  @PostMapping("/api/apps/{appId}/functions/publicPanel")
  public ResponseEntity<?> handle() {
    try {
      List<Map<String, Object>> judgeList = new ArrayList<>();
      for (JudgeProfileEntity j : judges.findAll()) {
        if (!PUBLIC_JUDGE_STATUSES.contains(nz(j.getStatus()))) {
          continue;
        }
        // Approved categories where a judge has them, otherwise what they
        // applied for — the page shows a judge's remit either way.
        List<String> approved = json.stringList(j.getApprovedCategories());
        List<String> categories =
            approved.isEmpty() ? json.stringList(j.getAppliedCategories()) : approved;

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", j.getId());
        out.put("name", nz(j.getName()));
        out.put("state", nz(j.getState()));
        out.put("categories", categories);
        out.put("experience", nz(j.getExperience()));
        judgeList.add(out);
      }

      List<Map<String, Object>> sponsorList = new ArrayList<>();
      for (SponsorProfileEntity s : sponsors.findAll()) {
        if (!"active".equals(nz(s.getStatus()))) {
          continue;
        }
        String name = !nz(s.getOrganisation()).isEmpty() ? s.getOrganisation() : nz(s.getName());
        if (name.isEmpty()) {
          continue;
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", s.getId());
        out.put("name", name);
        sponsorList.add(out);
      }

      return ResponseEntity.ok(Map.of("judges", judgeList, "sponsors", sponsorList));
    } catch (Exception e) {
      log.error("publicPanel failed", e);
      return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
    }
  }

  private static String nz(String v) {
    return v == null ? "" : v;
  }
}
