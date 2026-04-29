package com.dxnow.aio.security;

import javax.validation.Valid;
import javax.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/aio/auth")
public class ConsoleAuthController {

  private final ConsoleAuthService authService;

  public ConsoleAuthController(ConsoleAuthService authService) {
    this.authService = authService;
  }

  @PostMapping("/login")
  public LoginResponse login(@Valid @RequestBody LoginRequest request) {
    try {
      return LoginResponse.from(authService.login(request.username, request.password));
    } catch (IllegalArgumentException e) {
      throw new UnauthorizedException();
    }
  }

  @GetMapping("/me")
  public LoginResponse me(@RequestHeader(value = "Authorization", required = false) String authorization) {
    try {
      return LoginResponse.from(authService.verify(extractBearerToken(authorization)));
    } catch (IllegalArgumentException e) {
      throw new UnauthorizedException();
    }
  }

  @PostMapping("/switch-workspace")
  public LoginResponse switchWorkspace(
      @RequestHeader(value = "Authorization", required = false) String authorization,
      @Valid @RequestBody SwitchWorkspaceRequest request) {
    try {
      return LoginResponse.from(authService.switchWorkspace(extractBearerToken(authorization), request.workspaceId));
    } catch (ConsoleAuthService.WorkspaceAccessDeniedException e) {
      throw new ForbiddenException();
    } catch (IllegalArgumentException e) {
      throw new UnauthorizedException();
    }
  }

  private static String extractBearerToken(String authorization) {
    if (authorization == null || !authorization.startsWith("Bearer ")) {
      throw new UnauthorizedException();
    }
    return authorization.substring("Bearer ".length()).trim();
  }

  public static class LoginRequest {
    @NotBlank
    public String username;
    @NotBlank
    public String password;
  }

  public static class SwitchWorkspaceRequest {
    @NotBlank
    public String workspaceId;
  }

  public static class LoginResponse {
    public String token;
    public String userId;
    public String displayName;
    public String role;
    public String tenantId;
    public String workspaceId;
    public long expiresAt;

    static LoginResponse from(ConsoleAuthService.ConsoleSession session) {
      LoginResponse response = new LoginResponse();
      response.token = session.getToken();
      response.userId = session.getUserId();
      response.displayName = session.getDisplayName();
      response.role = session.getRole();
      response.tenantId = session.getTenantId();
      response.workspaceId = session.getWorkspaceId();
      response.expiresAt = session.getExpiresAt();
      return response;
    }
  }

  @ResponseStatus(HttpStatus.UNAUTHORIZED)
  public static class UnauthorizedException extends RuntimeException {
  }

  @ResponseStatus(HttpStatus.FORBIDDEN)
  public static class ForbiddenException extends RuntimeException {
  }
}