package com.fiftythree.challenges.guardian;

import com.fiftythree.challenges.entity.GuardianConsentEntity;
import java.util.List;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface GuardianConsentQueryRepository
    extends JpaRepository<GuardianConsentEntity, String> {

  /**
   * Whether ANY guardian consent exists on the platform.
   *
   * <p>Used by the kids freeze: children's and teens' entries stay closed until
   * the consent mechanism has produced at least one record, so the first
   * child's entry cannot be taken before the process is proven to work.
   */
  default boolean anyExists() {
    return !findAnyOne(Limit.of(1)).isEmpty();
  }

  @Query("select c from GuardianConsentEntity c order by c.createdDate desc, c.id asc")
  List<GuardianConsentEntity> findAnyOne(Limit limit);
/**
   * A granted consent for one entry.
   *
   * <p>Required before {@code guardian_approval_status} may become approved: a
   * guardian clicking approve is not, on its own, a consent record. Without
   * this an entry could be published for a child with no consent on file.
   */
  @Query("select c from GuardianConsentEntity c where c.entryId = :entryId "
      + "and c.status = 'granted' order by c.createdDate desc, c.id asc")
  List<GuardianConsentEntity> findGrantedForEntry(@Param("entryId") String entryId);
/** The most recent consent for one entry. */
  @Query("select c from GuardianConsentEntity c where c.challengeId = :challengeId "
      + "and c.entryId = :entryId order by c.createdDate desc, c.id asc")
  List<GuardianConsentEntity> findForEntry(
      @Param("challengeId") String challengeId, @Param("entryId") String entryId);

  /** Every consent on a challenge, newest first. */
  @Query("select c from GuardianConsentEntity c where c.challengeId = :challengeId "
      + "order by c.createdDate desc, c.id asc")
  List<GuardianConsentEntity> findByChallenge(@Param("challengeId") String challengeId);
}
