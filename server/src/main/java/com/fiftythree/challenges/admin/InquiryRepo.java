package com.fiftythree.challenges.admin;

import com.fiftythree.challenges.entity.PartnerInquiryEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface InquiryRepo extends JpaRepository<PartnerInquiryEntity, String> {
  @Query("select p from PartnerInquiryEntity p where p.status = :status "
      + "order by p.createdDate desc, p.id asc")
  List<PartnerInquiryEntity> findByStatus(@Param("status") String status);
}
