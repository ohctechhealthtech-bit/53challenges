package com.fiftythree.challenges.intake;

import com.fiftythree.challenges.entity.CampaignScaleBandEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

/** Campaign scale bands, which decide how a programme is priced. */
public interface ScaleBandQueryRepository extends JpaRepository<CampaignScaleBandEntity, String> {

  @Query("select r from CampaignScaleBandEntity r order by r.sortOrder asc, r.id asc")
  List<CampaignScaleBandEntity> findInOrder();
}
