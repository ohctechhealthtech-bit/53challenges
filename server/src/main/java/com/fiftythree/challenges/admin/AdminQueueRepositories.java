package com.fiftythree.challenges.admin;

import com.fiftythree.challenges.entity.ChallengeDraftEntity;
import com.fiftythree.challenges.entity.ComplianceAssessmentFindingEntity;
import com.fiftythree.challenges.entity.JudgeProfileEntity;
import com.fiftythree.challenges.entity.MessageEntity;
import com.fiftythree.challenges.entity.PartnerInquiryEntity;
import com.fiftythree.challenges.entity.SponsorProfileEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Component;

/**
 * The repositories the admin queues read, gathered behind one bean.
 *
 * <p>Eight separate constructor parameters on AdminQueueService made the
 * queue-building code harder to read than the queues themselves; this keeps
 * the interesting part legible. Each nested interface is a top-level bean in
 * its own right — nested repository interfaces are NOT picked up by Spring
 * Data, which cost an outage earlier in this migration.
 */
@Component
public class AdminQueueRepositories {

  private final DraftRepo drafts;
  private final InquiryRepo inquiries;
  private final JudgeRepo judges;
  private final SponsorRepo sponsors;
  private final FindingRepo findings;
  private final AdminMessageRepo messages;

  public AdminQueueRepositories(
      DraftRepo drafts,
      InquiryRepo inquiries,
      JudgeRepo judges,
      SponsorRepo sponsors,
      FindingRepo findings,
      AdminMessageRepo messages) {
    this.drafts = drafts;
    this.inquiries = inquiries;
    this.judges = judges;
    this.sponsors = sponsors;
    this.findings = findings;
    this.messages = messages;
  }

  public DraftRepo drafts() { return drafts; }
  public InquiryRepo inquiries() { return inquiries; }
  public JudgeRepo judges() { return judges; }
  public SponsorRepo sponsors() { return sponsors; }
  public FindingRepo findings() { return findings; }
  public AdminMessageRepo messages() { return messages; }
}
