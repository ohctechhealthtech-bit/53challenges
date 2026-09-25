package com.fiftythree.challenges.marketing;

import com.fiftythree.challenges.entity.EmailCampaignEntity;
import java.util.List;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Email campaigns, drafted and sent. */
public interface CampaignQueryRepository extends JpaRepository<EmailCampaignEntity, String> {

  @Query("select c from EmailCampaignEntity c order by c.createdDate desc, c.id asc")
  List<EmailCampaignEntity> findAllNewestFirst(Limit limit);
}
