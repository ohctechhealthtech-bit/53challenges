package com.fiftythree.challenges.admin;

import com.fiftythree.challenges.entity.MessageEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface AdminMessageRepo extends JpaRepository<MessageEntity, String> {

  /** Unread messages from participants. Null read means unread. */
  @Query("select m from MessageEntity m where m.sender = 'user' "
      + "and (m.read is null or m.read = false) order by m.createdDate desc, m.id asc")
  List<MessageEntity> findUnreadFromUsers();
}
