package com.fiftythree.challenges.lifecycle;

import com.fiftythree.challenges.entity.ChallengeEntity;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Challenge reads for the lifecycle tick. Separate from the generated
 * {@link com.fiftythree.challenges.entity.ChallengeRepository}, which is
 * overwritten whenever the entities are regenerated.
 */
public interface NativeChallengeQueryRepository extends JpaRepository<ChallengeEntity, String> {

  /**
   * Native challenges sitting in one of the given lifecycle statuses.
   *
   * <p>{@code source = 'native'} is essential: upstream challenges are governed
   * by the external Challenge API, and advancing one here would have this app
   * fighting the system that actually owns it.
   */
  @Query("select c from ChallengeEntity c where c.source = 'native' "
      + "and c.lifecycleStatus in :statuses order by c.createdDate desc, c.id asc")
  List<ChallengeEntity> findNativeByLifecycleStatuses(
      @Param("statuses") Collection<String> statuses);
}
