package com.fiftythree.challenges.intake;

import com.fiftythree.challenges.entity.HostAccountTypeEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

/** The kinds of organisation that can host: company, school, charity and so on. */
public interface HostAccountTypeQueryRepository extends JpaRepository<HostAccountTypeEntity, String> {

  @Query("select r from HostAccountTypeEntity r order by r.sortOrder asc, r.id asc")
  List<HostAccountTypeEntity> findInOrder();
}
