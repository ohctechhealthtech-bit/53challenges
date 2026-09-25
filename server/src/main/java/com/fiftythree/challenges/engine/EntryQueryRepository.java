package com.fiftythree.challenges.engine;

import com.fiftythree.challenges.entity.EntryEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Entry queries for challengeEngine.
 *
 * <p>Separate from the generated {@code EntryRepository} because that file is
 * rewritten by migration/generate-entities.cjs on every regeneration. Spring
 * Data allows several repositories over one entity, so the generated one stays
 * disposable and this one holds anything hand-written.
 */
public interface EntryQueryRepository extends JpaRepository<EntryEntity, String> {

  /**
   * An entry already promoted into a challenge from a given source entry.
   *
   * <p>This is what makes a repeated promotion run idempotent: without it the
   * second run creates a duplicate entry in the target challenge.
   */
  @Query("select e from EntryEntity e where e.challengeId = :challengeId "
      + "and e.upstreamEntryId = :upstreamEntryId order by e.createdDate desc, e.id asc")
  List<EntryEntity> findByChallengeAndUpstreamEntry(
      @Param("challengeId") String challengeId,
      @Param("upstreamEntryId") String upstreamEntryId);

  /**
   * Every entry for a challenge — the admin view, newest first.
   *
   * <p>{@code id} breaks the tie. Entries created in the same import share a
   * {@code created_date} to the millisecond, and ordering by that alone leaves
   * their relative order up to the database, so the same list can come back in
   * a different order on consecutive loads and the UI appears to shuffle.
   */
  @Query("select e from EntryEntity e where e.challengeId = :challengeId "
      + "order by e.createdDate desc, e.id asc")
  List<EntryEntity> findByChallengeIdOrderByCreatedDateDesc(
      @Param("challengeId") String challengeId);

  /**
   * The public view: approved entries only.
   *
   * <p>Unmoderated ("pending") and rejected entries are admin-only. Filtering
   * here rather than after loading means a pending entry never leaves the
   * database on a public request.
   */
  @Query("select e from EntryEntity e where e.challengeId = :challengeId "
      + "and e.status = 'approved' order by e.createdDate desc, e.id asc")
  List<EntryEntity> findApprovedByChallengeId(@Param("challengeId") String challengeId);
/**
   * Finalists for the homepage: marked by an admin and already approved.
   *
   * <p>Ordered by {@code finalist_week} descending so the most recently chosen
   * appear first, with {@code id} breaking ties as elsewhere. Limited by the
   * caller.
   */
  @Query("select e from EntryEntity e where e.isFinalist = true and e.status = 'approved' "
      + "order by e.finalistWeek desc, e.id asc")
  List<EntryEntity> findFinalists(org.springframework.data.domain.Limit limit);
/** Entries a person submitted, newest first. */
  @Query("select e from EntryEntity e where lower(e.creatorEmail) = :email "
      + "order by e.createdDate desc, e.id asc")
  List<EntryEntity> findByCreatorEmail(@Param("email") String email);

  /** Entries by id, for resolving a set of voted-on entries in one query. */
  List<EntryEntity> findByIdIn(java.util.Collection<String> ids);
/** Whether this person already entered this challenge — the duplicate guard. */
  @Query("select e from EntryEntity e where e.challengeId = :challengeId "
      + "and lower(e.creatorEmail) = :email order by e.createdDate desc, e.id asc")
  List<EntryEntity> findByChallengeAndCreator(
      @Param("challengeId") String challengeId, @Param("email") String email);
/** Entries in one moderation state, newest first. */
  @Query("select e from EntryEntity e where e.status = :status "
      + "order by e.createdDate desc, e.id asc")
  List<EntryEntity> findByStatus(@Param("status") String status);
/** Pending entries across a set of challenges — the host review queue. */
  @Query("select e from EntryEntity e where e.challengeId in :challengeIds "
      + "and e.status = 'pending' order by e.createdDate desc, e.id asc")
  List<EntryEntity> findPendingForChallenges(
      @Param("challengeIds") java.util.Collection<String> challengeIds);
}
