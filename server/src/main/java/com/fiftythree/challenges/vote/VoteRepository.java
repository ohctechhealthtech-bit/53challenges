package com.fiftythree.challenges.vote;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Vote reads for the challengeVotes endpoint.
 *
 * <p>These are aggregate queries rather than "load every row and count in
 * memory", which is what the Base44 function had to do — it pulled up to
 * 100000 votes per challenge across the network and counted them in
 * JavaScript. The results are identical; the database simply does the counting.
 *
 * <p><b>Every predicate treats a null {@code excluded} as "not excluded."</b>
 * The column is nullable and null is the common case, while the original code
 * tested {@code !v.excluded}, which is false for null. Writing
 * {@code excluded = false} alone would silently drop almost every vote, because
 * in SQL {@code NULL = false} is unknown, not true.
 */
public interface VoteRepository extends JpaRepository<VoteEntity, String> {

  /** Non-excluded vote counts per entry, for one challenge. */
  @Query("select v.entryId, count(v) from VoteEntity v "
      + "where v.challengeId = :challengeId and (v.excluded is null or v.excluded = false) "
      + "group by v.entryId")
  List<Object[]> countsByEntry(@Param("challengeId") String challengeId);

  /** Excluded (flagged or disqualified) votes for one challenge. */
  @Query("select count(v) from VoteEntity v "
      + "where v.challengeId = :challengeId and v.excluded = true")
  long countExcluded(@Param("challengeId") String challengeId);

  /**
   * Entries this voter has voted on in one challenge.
   *
   * <p>Returns one row per vote, not per entry, so a double vote on the same
   * entry appears twice — matching the original, which pushed to an array
   * without de-duplicating.
   */
  @Query("select v.entryId from VoteEntity v "
      + "where v.challengeId = :challengeId and (v.excluded is null or v.excluded = false) "
      + "and lower(v.userEmail) = :email")
  List<String> votedEntryIds(
      @Param("challengeId") String challengeId, @Param("email") String email);

  /** Non-excluded vote totals for several challenges at once. */
  @Query("select v.challengeId, count(v) from VoteEntity v "
      + "where v.challengeId in :challengeIds and (v.excluded is null or v.excluded = false) "
      + "group by v.challengeId")
  List<Object[]> totalsByChallenge(@Param("challengeIds") Collection<String> challengeIds);

  /** Site-wide non-excluded total, for the admin aggregate. */
  @Query("select count(v) from VoteEntity v where v.excluded is null or v.excluded = false")
  long countAllValid();

  /** Site-wide excluded total, for the admin aggregate. */
  @Query("select count(v) from VoteEntity v where v.excluded = true")
  long countAllExcluded();
/**
   * Non-excluded vote counts for a specific set of entries.
   *
   * <p>The homepage feed needs counts for the handful of entries it is about to
   * show, not for every vote ever cast. The original loaded up to 100000 vote
   * rows and filtered them in JavaScript for want of a way to ask the question.
   */
  @Query("select v.entryId, count(v) from VoteEntity v "
      + "where v.entryId in :entryIds and (v.excluded is null or v.excluded = false) "
      + "group by v.entryId")
  List<Object[]> countsByEntryIds(@Param("entryIds") Collection<String> entryIds);
/** Every vote cast by one person, newest first. */
  @Query("select v from VoteEntity v where lower(v.userEmail) = :email "
      + "order by v.createdDate desc, v.id asc")
  List<VoteEntity> findByUserEmail(@Param("email") String email);
/** Has this person already voted on this entry? One vote per person per entry. */
  @Query("select v from VoteEntity v where v.entryId = :entryId "
      + "and lower(v.userEmail) = :email")
  List<VoteEntity> findByEntryAndVoter(
      @Param("entryId") String entryId, @Param("email") String email);

  /** Non-excluded votes on one entry — the number shown after voting. */
  @Query("select count(v) from VoteEntity v where v.entryId = :entryId "
      + "and (v.excluded is null or v.excluded = false)")
  long countValidForEntry(@Param("entryId") String entryId);
/** Every vote on one challenge, for the fraud scan. */
  @Query("select v from VoteEntity v where v.challengeId = :challengeId "
      + "order by v.createdDate desc, v.id asc")
  List<VoteEntity> findByChallengeId(@Param("challengeId") String challengeId);
/** Votes excluded as fraudulent on one challenge. */
  @Query("select count(v) from VoteEntity v where v.challengeId = :challengeId "
      + "and v.excluded = true")
  long countExcludedForChallenge(@Param("challengeId") String challengeId);

  /** Every vote on a challenge, excluded or not — the audit's scanned total. */
  @Query("select count(v) from VoteEntity v where v.challengeId = :challengeId")
  long countForChallenge(@Param("challengeId") String challengeId);
}
