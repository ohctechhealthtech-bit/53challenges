package com.fiftythree.challenges.verification;

import com.fiftythree.challenges.entity.EmailVerificationEntity;
import java.util.List;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EmailVerificationQueryRepository extends JpaRepository<EmailVerificationEntity, String> {

  /**
   * A verification that can still be used: right address, right purpose, right
   * token, confirmed and not yet consumed.
   *
   * <p>{@code verified} and {@code consumed} are nullable. A null {@code
   * consumed} means not consumed, so the predicate says so explicitly —
   * {@code consumed = false} alone would match nothing for those rows and every
   * verification would appear invalid.
   */
  @Query("select v from EmailVerificationEntity v where lower(v.email) = :email "
      + "and v.purpose = :purpose and v.token = :token "
      + "and v.verified = true and (v.consumed is null or v.consumed = false) "
      + "order by v.createdDate desc, v.id asc")
  List<EmailVerificationEntity> findUsable(
      @Param("email") String email,
      @Param("purpose") String purpose,
      @Param("token") String token);

  /** Recent verifications for an address, used to explain why a token did not match. */
  default List<EmailVerificationEntity> findRecentForEmail(String email, String purpose) {
    return findByEmailAndPurpose(email, purpose, Limit.of(10));
  }

  @Query("select v from EmailVerificationEntity v where lower(v.email) = :email "
      + "and v.purpose = :purpose order by v.createdDate desc, v.id asc")
  List<EmailVerificationEntity> findByEmailAndPurpose(
      @Param("email") String email, @Param("purpose") String purpose, Limit limit);
}
