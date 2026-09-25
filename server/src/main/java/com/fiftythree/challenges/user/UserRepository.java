package com.fiftythree.challenges.user;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRepository extends JpaRepository<UserEntity, String> {

  /** Email comparison is case-insensitive: addresses are normalised to lower case on write. */
  @Query("select u.role from UserEntity u where lower(u.email) = lower(:email)")
  Optional<String> findRoleByEmail(@Param("email") String email);

  /**
   * The caller's record id, for audit entries that carry both id and email.
   * Empty when the email belongs to no local user.
   */
  @Query("select u.id from UserEntity u where lower(u.email) = lower(:email)")
  Optional<String> findIdByEmail(@Param("email") String email);

  /** Admin addresses, for the alerts that go to whoever is on duty. */
  @Query("select u.email from UserEntity u where u.role = 'admin' "
      + "order by u.email asc")
  List<String> findAdminEmails(org.springframework.data.domain.Limit limit);
}
