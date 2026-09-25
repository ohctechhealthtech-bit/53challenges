package com.fiftythree.challenges.host;

import com.fiftythree.challenges.entity.HostApplicationDraftEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** A host's in-progress application, before it becomes a proposal. */
public interface HostDraftQueryRepository
    extends JpaRepository<HostApplicationDraftEntity, String> {

  /**
   * The host's current draft.
   *
   * <p>Only 'active' ones: a discarded draft stays in the table so the wizard
   * can be audited, but must never be handed back as the one in progress.
   */
  @Query("select d from HostApplicationDraftEntity d "
      + "where lower(d.ownerEmail) = lower(:email) and d.status = 'active' "
      + "order by d.createdDate desc, d.id asc")
  List<HostApplicationDraftEntity> findActiveFor(@Param("email") String email);
}
