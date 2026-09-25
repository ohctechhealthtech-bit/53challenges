package com.fiftythree.challenges.misc;

import com.fiftythree.challenges.entity.MessageEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MessageQueryRepository extends JpaRepository<MessageEntity, String> {

  /**
   * Unread messages the team sent to one participant.
   *
   * <p>{@code read} is nullable and an older row may have no value, which means
   * unread — so the predicate spells that out rather than testing
   * {@code read = false}, which in SQL never matches null.
   */
  @Query("select m from MessageEntity m where lower(m.participantEmail) = :email "
      + "and m.sender = 'team' and (m.read is null or m.read = false)")
  List<MessageEntity> findUnreadFromTeam(@Param("email") String email);

  /** Unread messages a participant sent to the team, for one thread. */
  @Query("select m from MessageEntity m where lower(m.participantEmail) = :email "
      + "and m.sender = 'user' and (m.read is null or m.read = false)")
  List<MessageEntity> findUnreadFromUser(@Param("email") String email);

  /** One participant's thread, oldest first, as a conversation reads. */
  @Query("select m from MessageEntity m where lower(m.participantEmail) = :email "
      + "order by m.createdDate asc, m.id asc")
  List<MessageEntity> findThread(@Param("email") String email);

  /** Every message, newest first, for building the team's thread list. */
  @Query("select m from MessageEntity m order by m.createdDate desc, m.id asc")
  List<MessageEntity> findAllNewestFirst();
}
