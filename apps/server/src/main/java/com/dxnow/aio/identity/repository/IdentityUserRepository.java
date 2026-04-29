package com.dxnow.aio.identity.repository;

import com.dxnow.aio.identity.domain.IdentityUser;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface IdentityUserRepository extends JpaRepository<IdentityUser, String> {

  List<IdentityUser> findByTenantIdOrderByCreatedAtDesc(String tenantId);

  List<IdentityUser> findByStatusOrderByCreatedAtDesc(String status);

  Optional<IdentityUser> findByEmailIgnoreCaseAndStatus(String email, String status);

  Optional<IdentityUser> findByIdAndStatus(String id, String status);

  boolean existsByTenantIdAndEmailIgnoreCase(String tenantId, String email);
}
