package com.dxnow.aio.security;

import java.io.IOException;
import java.util.Collections;
import java.util.Enumeration;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;
import javax.servlet.FilterChain;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletRequestWrapper;
import javax.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class ConsoleAuthenticationFilter extends OncePerRequestFilter {

  public static final String USER_ATTRIBUTE = ConsoleAuthenticationFilter.class.getName() + ".user";
  public static final String ROLE_ATTRIBUTE = ConsoleAuthenticationFilter.class.getName() + ".role";
  public static final String TENANT_ATTRIBUTE = ConsoleAuthenticationFilter.class.getName() + ".tenant";
  public static final String WORKSPACE_ATTRIBUTE = ConsoleAuthenticationFilter.class.getName() + ".workspace";

  private final ConsoleAuthService authService;

  public ConsoleAuthenticationFilter(ConsoleAuthService authService) {
    this.authService = authService;
  }

  @Override
  protected boolean shouldNotFilter(HttpServletRequest request) {
    return !request.getRequestURI().startsWith("/api/aio/admin/");
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request,
      HttpServletResponse response,
      FilterChain filterChain) throws ServletException, IOException {
    try {
      ConsoleAuthService.ConsoleSession session = authService.verify(extractToken(request));
      request.setAttribute(USER_ATTRIBUTE, session.getUserId());
      request.setAttribute(ROLE_ATTRIBUTE, session.getRole());
      request.setAttribute(TENANT_ATTRIBUTE, session.getTenantId());
      request.setAttribute(WORKSPACE_ATTRIBUTE, session.getWorkspaceId());
      filterChain.doFilter(new ConsoleContextRequest(request, session), response);
    } catch (Exception e) {
      response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Console login required");
    }
  }

  private static String extractToken(HttpServletRequest request) {
    String authorization = request.getHeader("Authorization");
    if (authorization != null && authorization.startsWith("Bearer ")) {
      return authorization.substring("Bearer ".length()).trim();
    }
    return request.getHeader("X-Aio-Console-Token");
  }

  private static class ConsoleContextRequest extends HttpServletRequestWrapper {
    private final ConsoleAuthService.ConsoleSession session;

    ConsoleContextRequest(HttpServletRequest request, ConsoleAuthService.ConsoleSession session) {
      super(request);
      this.session = session;
    }

    @Override
    public String getHeader(String name) {
      if ("X-Aio-Tenant".equalsIgnoreCase(name)) return session.getTenantId();
      if ("X-Aio-Workspace".equalsIgnoreCase(name)) return session.getWorkspaceId();
      if ("X-Aio-User".equalsIgnoreCase(name)) return session.getUserId();
      if ("X-Aio-Role".equalsIgnoreCase(name)) return session.getRole();
      return super.getHeader(name);
    }

    @Override
    public Enumeration<String> getHeaders(String name) {
      String value = getHeader(name);
      return value == null ? Collections.emptyEnumeration() : Collections.enumeration(Collections.singletonList(value));
    }

    @Override
    public Enumeration<String> getHeaderNames() {
      Set<String> names = new LinkedHashSet<>();
      Enumeration<String> original = super.getHeaderNames();
      while (original != null && original.hasMoreElements()) {
        names.add(original.nextElement());
      }
      names.add("X-Aio-Tenant".toLowerCase(Locale.ROOT));
      names.add("X-Aio-Workspace".toLowerCase(Locale.ROOT));
      names.add("X-Aio-User".toLowerCase(Locale.ROOT));
      names.add("X-Aio-Role".toLowerCase(Locale.ROOT));
      return Collections.enumeration(names);
    }
  }
}