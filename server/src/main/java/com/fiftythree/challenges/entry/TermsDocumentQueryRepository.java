package com.fiftythree.challenges.entry;

import com.fiftythree.challenges.entity.TermsDocumentEntity;
import java.util.Collection;
import java.util.List;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TermsDocumentQueryRepository extends JpaRepository<TermsDocumentEntity, String> {

  /**
   * The currently published terms for a challenge.
   *
   * <p>Only {@code published} qualifies — a draft must never be what an entrant
   * is recorded as having accepted.
   */
  default List<TermsDocumentEntity> findPublished(String challengeId) {
    return findByChallengeAndStatus(challengeId, Limit.of(1));
  }

  @Query("select t from TermsDocumentEntity t where t.challengeId = :challengeId "
      + "and t.status = 'published' order by t.createdDate desc, t.id asc")
  List<TermsDocumentEntity> findByChallengeAndStatus(
      @Param("challengeId") String challengeId, Limit limit);

  /**
   * Terms documents in any of the given statuses.
   *
   * <p>The status list is what separates the two lifecycle gates that use
   * this: approving a challenge accepts a draft, but opening it for entry
   * requires a published one, because entrants have to be able to read the
   * terms they are agreeing to.
   */
  @Query("select t from TermsDocumentEntity t where t.challengeId = :challengeId "
      + "and t.status in :statuses order by t.createdDate desc, t.id asc")
  List<TermsDocumentEntity> findByChallengeAndStatuses(
      @Param("challengeId") String challengeId,
      @Param("statuses") Collection<String> statuses);
}
