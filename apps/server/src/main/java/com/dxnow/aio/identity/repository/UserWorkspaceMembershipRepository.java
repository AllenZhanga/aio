package com.dxnow.aio.identity.repository;

import com.dxnow.aio.identity.domain.UserWorkspaceMembership;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserWorkspaceMembershipRepository extends JpaRepository<UserWorkspaceMembership, String> {

  List<UserWorkspaceMembership> findByTenantIdAndUserIdAndStatus(String tenantId, String userId, String status);

  List<UserWorkspaceMembership> findByUserIdAndStatus(String userId, String status);

  void deleteByTenantIdAndUserId(String tenantId, String userId);
}
