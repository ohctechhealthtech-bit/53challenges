package com.fiftythree.challenges.terms;

import com.fiftythree.challenges.entity.TermsDocumentEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Terms document reads for the assembler. Separate from the entry-side
 * {@link com.fiftythree.challenges.entry.TermsDocumentQueryRepository}, which
 * answers the narrower question an entrant's acceptance needs.
 */
public interface TermsDocumentsQueryRepository extends JpaRepository<TermsDocumentEntity, String> {

  /** Every document for a challenge, newest first, for the admin list. */
  @Query("select t from TermsDocumentEntity t where t.challengeId = :challengeId "
      + "order by t.createdDate desc, t.id asc")
  List<TermsDocumentEntity> findByChallenge(@Param("challengeId") String challengeId);

  /**
   * Documents that are still live in some sense — draft, reviewed or
   * published. Superseded ones are excluded because the assembler compares
   * against what is current, not against history.
   */
  @Query("select t from TermsDocumentEntity t where t.challengeId = :challengeId "
      + "and t.status in ('draft', 'reviewed', 'published') "
      + "order by t.createdDate desc, t.id asc")
  List<TermsDocumentEntity> findLive(@Param("challengeId") String challengeId);

  /** Currently published documents, which a new publication supersedes. */
  @Query("select t from TermsDocumentEntity t where t.challengeId = :challengeId "
      + "and t.status = 'published' order by t.createdDate desc, t.id asc")
  List<TermsDocumentEntity> findPublished(@Param("challengeId") String challengeId);
}
