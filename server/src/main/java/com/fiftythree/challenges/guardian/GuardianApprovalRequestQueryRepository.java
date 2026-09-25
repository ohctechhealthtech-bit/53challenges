package com.fiftythree.challenges.guardian;

import com.fiftythree.challenges.entity.GuardianApprovalRequestEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GuardianApprovalRequestQueryRepository
    extends JpaRepository<GuardianApprovalRequestEntity, String> {
}
