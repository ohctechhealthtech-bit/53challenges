package com.fiftythree.challenges.misc;

import com.fiftythree.challenges.entity.EntryCommentEntity;
import java.util.List;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Separate from the generated {@code EntryCommentRepository}, which
 * migration/generate-entities.cjs rewrites on every run.
 */
public interface EntryCommentQueryRepository extends JpaRepository<EntryCommentEntity, String> {

  /** Newest first, capped at 100 as the original was. */
  default List<EntryCommentEntity> findByEntryIdOrderByCreatedDateDesc(String entryId) {
    return findByEntryIdOrderByCreatedDateDescIdAsc(entryId, Limit.of(100));
  }

  /**
   * {@code id} breaks ties: comments posted in the same millisecond would
   * otherwise come back in whatever order the database chose, and a comment
   * thread that reorders itself between loads looks broken.
   */
  List<EntryCommentEntity> findByEntryIdOrderByCreatedDateDescIdAsc(String entryId, Limit limit);
}
