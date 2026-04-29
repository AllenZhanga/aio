package com.dxnow.aio.security;

import com.dxnow.aio.common.Sha256;
import com.dxnow.aio.identity.domain.ApiKey;
import com.dxnow.aio.identity.repository.ApiKeyRepository;
import java.io.IOException;
import java.time.OffsetDateTime;
import javax.servlet.FilterChain;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class ApiKeyAuthenticationFilter extends OncePerRequestFilter {

  private final ApiKeyRepository apiKeyRepository;

  public ApiKeyAuthenticationFilter(ApiKeyRepository apiKeyRepository) {
    this.apiKeyRepository = apiKeyRepository;
  }

  @Override
  protected boolean shouldNotFilter(HttpServletRequest request) {
    return !request.getRequestURI().startsWith("/v1/");
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request,
      HttpServletResponse response,
      FilterChain filterChain) throws ServletException, IOException {
    String authorization = request.getHeader("Authorization");
    if (authorization == null || !authorization.startsWith("Bearer ")) {
      response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Missing bearer API key");
      return;
    }
    String secret = authorization.substring("Bearer ".length()).trim();
    ApiKey apiKey = apiKeyRepository.findByKeyHashAndStatus(Sha256.hex(secret), "active")
        .orElse(null);
    if (apiKey == null || isExpired(apiKey)) {
      response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Invalid API key");
      return;
    }
    apiKey.markUsed();
    apiKeyRepository.save(apiKey);
    request.setAttribute(ApiKeyPrincipal.REQUEST_ATTRIBUTE, new ApiKeyPrincipal(
        apiKey.getId(),
        apiKey.getTenantId(),
        apiKey.getWorkspaceId(),
        apiKey.getAppId()));
    filterChain.doFilter(request, response);
  }

  private boolean isExpired(ApiKey apiKey) {
    return apiKey.getExpiresAt() != null && apiKey.getExpiresAt().isBefore(OffsetDateTime.now());
  }
}
