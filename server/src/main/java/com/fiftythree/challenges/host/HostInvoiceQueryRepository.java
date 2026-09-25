package com.fiftythree.challenges.host;

import com.fiftythree.challenges.entity.HostInvoiceEntity;
import java.util.List;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Invoices raised against a host for applications and deposits. */
public interface HostInvoiceQueryRepository extends JpaRepository<HostInvoiceEntity, String> {

  @Query("select i from HostInvoiceEntity i where lower(i.ownerEmail) = lower(:email) "
      + "order by i.createdDate desc, i.id asc")
  List<HostInvoiceEntity> findByOwner(@Param("email") String email, Limit limit);

  @Query("select i from HostInvoiceEntity i where lower(i.ownerEmail) = lower(:email) "
      + "and i.status = 'paid' order by i.createdDate desc, i.id asc")
  List<HostInvoiceEntity> findPaidByOwner(@Param("email") String email, Limit limit);

  @Query("select i from HostInvoiceEntity i order by i.createdDate desc, i.id asc")
  List<HostInvoiceEntity> findAllNewestFirst(Limit limit);
}
