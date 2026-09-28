package com.fiftythree.challenges.marketing;

import com.fiftythree.challenges.entity.PartnerInquiryEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Query methods for partner prospects.
 *
 * <p>Separate from the generated {@code PartnerInquiryRepository}, which is
 * overwritten whenever entities are regenerated. Top-level rather than nested,
 * because a nested repository interface is not registered and the missing bean
 * only shows up at startup.
 */
public interface PartnerProspectQueryRepository
    extends JpaRepository<PartnerInquiryEntity, String> {

  /**
   * Prospects already recorded under this company name from a given source.
   *
   * <p>Keeps "Add to outreach" from creating a second row for the same
   * organisation. The button disables itself after one click, but that is a
   * client-side guard and a refresh or a second tab undoes it.
   */
  @Query("select p from PartnerInquiryEntity p where lower(p.companyName) = :name "
      + "and p.howHeard = :source order by p.createdDate desc, p.id asc")
  List<PartnerInquiryEntity> findProspectByName(
      @Param("name") String name, @Param("source") String source);
}
