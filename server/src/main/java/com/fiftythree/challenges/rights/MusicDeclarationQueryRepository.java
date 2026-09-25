package com.fiftythree.challenges.rights;

import com.fiftythree.challenges.entity.MusicDeclarationEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Music declared on an entry, and whether it has been cleared. */
public interface MusicDeclarationQueryRepository extends JpaRepository<MusicDeclarationEntity, String> {

  @Query("select m from MusicDeclarationEntity m where m.entryId = :entryId "
      + "order by m.createdDate desc, m.id asc")
  List<MusicDeclarationEntity> findByEntry(@Param("entryId") String entryId);
}
