package com.dxnow.aio.identity.repository;

import com.dxnow.aio.identity.domain.Tenant;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TenantRepository extends JpaRepository<Tenant, String> {

  List<Tenant> findByStatusOrderByCreatedAtDesc(String status);

  boolean existsByCode(String code);
}
