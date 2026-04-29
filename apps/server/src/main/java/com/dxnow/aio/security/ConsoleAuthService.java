package com.dxnow.aio.security;

import com.dxnow.aio.config.AioProperties;
import com.dxnow.aio.common.Sha256;
import com.dxnow.aio.identity.domain.IdentityUser;
import com.dxnow.aio.identity.domain.UserWorkspaceMembership;
import com.dxnow.aio.identity.domain.Workspace;
import com.dxnow.aio.identity.repository.IdentityUserRepository;
import com.dxnow.aio.identity.repository.UserWorkspaceMembershipRepository;
import com.dxnow.aio.identity.repository.WorkspaceRepository;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ConsoleAuthService {

  private static final String HMAC_ALGORITHM = "HmacSHA256";

  private final AioProperties properties;
  private final WorkspaceRepository workspaceRepository;
  private final IdentityUserRepository userRepository;
  private final UserWorkspaceMembershipRepository membershipRepository;

  public ConsoleAuthService(
      AioProperties properties,
      WorkspaceRepository workspaceRepository,
      IdentityUserRepository userRepository,
      UserWorkspaceMembershipRepository membershipRepository) {
    this.properties = properties;
    this.workspaceRepository = workspaceRepository;
    this.userRepository = userRepository;
    this.membershipRepository = membershipRepository;
  }

  @Transactional
  public ConsoleSession login(String username, String password) {
    ConsoleSession dbSession = resolveDatabaseUser(username, password);
    if (dbSession != null) {
      return dbSession;
    }
    ConsoleAccount account = resolveAccount(username, password);
    if (account == null) {
      throw new IllegalArgumentException("Invalid username or password");
    }
    String tenantId = properties.getDefaultTenantId();
    ensureConfiguredWorkspaces(tenantId);
    ensureWorkspace(tenantId, account.workspaceId, account.displayName + " Workspace");
    return issueSession(account.username, account.displayName, account.role, tenantId, account.workspaceId);
  }

  @Transactional
  public ConsoleSession switchWorkspace(String token, String workspaceId) {
    ConsoleSession current = verify(token);
    if (workspaceId == null || workspaceId.isBlank()) {
      throw new IllegalArgumentException("Workspace is required");
    }
    ensureConfiguredWorkspaces(current.getTenantId());
    Workspace workspace = workspaceRepository.findById(workspaceId.trim())
        .filter(item -> current.getTenantId().equals(item.getTenantId()))
        .filter(item -> "active".equals(item.getStatus()))
        .orElseThrow(() -> new IllegalArgumentException("Workspace not found"));
    if (!canAccessWorkspace(current.getUserId(), workspace.getId())) {
      throw new WorkspaceAccessDeniedException();
    }
    return issueSession(current.getUserId(), current.getDisplayName(), current.getRole(), current.getTenantId(), workspace.getId());
  }

  public boolean isWorkspaceAdmin(String userId) {
    if (userId == null || userId.isBlank()) {
      return false;
    }
    if (userRepository.findByIdAndStatus(userId, "active")
        .map(user -> "admin".equals(user.getRole()))
        .orElse(false)) {
      return true;
    }
    return consoleAccounts().stream()
        .anyMatch(account -> userId.equals(account.username) && "admin".equals(account.role));
  }

  public List<String> allowedWorkspaceIds(String userId) {
    if (userId == null || userId.isBlank()) {
      return new ArrayList<>();
    }
    if (isWorkspaceAdmin(userId)) {
      return new ArrayList<>();
    }
    List<String> workspaceIds = membershipRepository.findByUserIdAndStatus(userId, "active").stream()
      .map(UserWorkspaceMembership::getWorkspaceId)
      .distinct()
      .collect(Collectors.toList());
    workspaceIds.addAll(consoleAccounts().stream()
        .filter(account -> userId.equals(account.username))
        .map(account -> account.workspaceId)
        .distinct()
      .collect(Collectors.toList()));
    return workspaceIds.stream().distinct().collect(Collectors.toList());
  }

  public ConsoleSession verify(String token) {
    if (token == null || token.isBlank()) {
      throw new IllegalArgumentException("Missing console token");
    }
    String[] parts = token.split("\\.", 2);
    if (parts.length != 2 || !constantTimeEquals(sign(parts[0]), parts[1])) {
      throw new IllegalArgumentException("Invalid console token");
    }
    String payload = new String(Base64.getUrlDecoder().decode(parts[0]), StandardCharsets.UTF_8);
    String[] fields = payload.split("\\|", 6);
    if (fields.length < 4) {
      throw new IllegalArgumentException("Invalid console token payload");
    }
    long expiresAt = Long.parseLong(fields[3]);
    if (expiresAt < Instant.now().getEpochSecond()) {
      throw new IllegalArgumentException("Console token expired");
    }
    String displayName = fields.length >= 5 ? fields[4] : fields[0];
    String role = fields.length >= 6 ? normalizeRole(fields[5]) : roleForUser(fields[0]);
    return new ConsoleSession(fields[0], displayName, role, fields[1], fields[2], expiresAt, token);
  }

  private ConsoleAccount resolveAccount(String username, String password) {
    for (ConsoleAccount account : consoleAccounts()) {
      if (constantTimeEquals(account.username, username) && constantTimeEquals(account.password, password)) {
        return account;
      }
    }
    return null;
  }

  private ConsoleSession resolveDatabaseUser(String username, String password) {
    if (username == null || password == null) {
      return null;
    }
    IdentityUser user = userRepository.findByEmailIgnoreCaseAndStatus(username.trim(), "active")
        .filter(item -> constantTimeEquals(item.getPasswordHash(), Sha256.hex(password)))
        .orElse(null);
    if (user == null) {
      return null;
    }
    List<UserWorkspaceMembership> memberships = membershipRepository.findByTenantIdAndUserIdAndStatus(user.getTenantId(), user.getId(), "active");
    if (memberships.isEmpty()) {
      throw new IllegalArgumentException("User has no assigned workspace");
    }
    String workspaceId = memberships.get(0).getWorkspaceId();
    workspaceRepository.findById(workspaceId)
        .filter(workspace -> user.getTenantId().equals(workspace.getTenantId()))
        .filter(workspace -> "active".equals(workspace.getStatus()))
        .orElseThrow(() -> new IllegalArgumentException("Assigned workspace not found"));
    return issueSession(user.getId(), user.getDisplayName(), user.getRole(), user.getTenantId(), workspaceId);
  }

  private List<ConsoleAccount> consoleAccounts() {
    List<ConsoleAccount> accounts = new ArrayList<>();
    String configured = properties.getConsoleAccounts();
    if (configured != null && !configured.isBlank()) {
      for (String raw : configured.split(",")) {
        String[] fields = raw.trim().split(":", 5);
        if (fields.length >= 3 && !fields[0].isBlank() && !fields[1].isBlank() && !fields[2].isBlank()) {
          String username = fields[0].trim();
          String displayName = fields.length >= 4 && !fields[3].isBlank() ? fields[3].trim() : username;
          String role = fields.length >= 5 && !fields[4].isBlank() ? normalizeRole(fields[4]) : defaultRole(username);
          accounts.add(new ConsoleAccount(username, fields[1], fields[2].trim(), displayName, role));
        }
      }
    }
    if (accounts.isEmpty()) {
      accounts.add(new ConsoleAccount(properties.getConsoleUsername(), properties.getConsolePassword(), "default", properties.getConsoleUsername(), "admin"));
    }
    return accounts;
  }

  private void ensureWorkspace(String tenantId, String workspaceId, String name) {
    workspaceRepository.findById(workspaceId)
        .filter(workspace -> tenantId.equals(workspace.getTenantId()))
        .orElseGet(() -> {
          Workspace workspace = new Workspace();
          workspace.setId(workspaceId);
          workspace.setTenantId(tenantId);
          workspace.setName(name);
          workspace.setStatus("active");
          return workspaceRepository.save(workspace);
        });
  }

  private void ensureConfiguredWorkspaces(String tenantId) {
    for (ConsoleAccount account : consoleAccounts()) {
      ensureWorkspace(tenantId, account.workspaceId, account.displayName + " Workspace");
    }
  }

  private boolean canAccessWorkspace(String userId, String workspaceId) {
    if (isWorkspaceAdmin(userId)) {
      return true;
    }
    if (membershipRepository.findByUserIdAndStatus(userId, "active").stream()
        .anyMatch(membership -> workspaceId.equals(membership.getWorkspaceId()))) {
      return true;
    }
    return consoleAccounts().stream()
        .anyMatch(account -> userId.equals(account.username) && workspaceId.equals(account.workspaceId));
  }

  private String roleForUser(String userId) {
    String databaseRole = userRepository.findByIdAndStatus(userId, "active")
        .map(IdentityUser::getRole)
        .orElse(null);
    if (databaseRole != null) {
      return normalizeRole(databaseRole);
    }
    return consoleAccounts().stream()
        .filter(account -> userId.equals(account.username))
        .map(account -> account.role)
        .filter("admin"::equals)
        .findFirst()
        .orElse(defaultRole(userId));
  }

  private String defaultRole(String username) {
    String configuredAdmin = properties.getConsoleUsername();
    return "admin".equalsIgnoreCase(username) || (configuredAdmin != null && configuredAdmin.equals(username)) ? "admin" : "member";
  }

  private static String normalizeRole(String role) {
    return "admin".equals(role == null ? "" : role.trim().toLowerCase(Locale.ROOT)) ? "admin" : "member";
  }

  private ConsoleSession issueSession(String userId, String displayName, String role, String tenantId, String workspaceId) {
    long expiresAt = Instant.now().getEpochSecond() + properties.getConsoleSessionTtlSeconds();
    String payload = String.join("|", userId, tenantId, workspaceId, String.valueOf(expiresAt), displayName, role);
    String encodedPayload = base64Url(payload.getBytes(StandardCharsets.UTF_8));
    String signature = sign(encodedPayload);
    return new ConsoleSession(userId, displayName, role, tenantId, workspaceId, expiresAt, encodedPayload + "." + signature);
  }

  private String sign(String payload) {
    try {
      Mac mac = Mac.getInstance(HMAC_ALGORITHM);
      mac.init(new SecretKeySpec(properties.getSecretKey().getBytes(StandardCharsets.UTF_8), HMAC_ALGORITHM));
      return base64Url(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
    } catch (Exception e) {
      throw new IllegalStateException("Unable to sign console token", e);
    }
  }

  private static String base64Url(byte[] bytes) {
    return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
  }

  private static boolean constantTimeEquals(String expected, String actual) {
    if (expected == null || actual == null) return false;
    byte[] left = expected.getBytes(StandardCharsets.UTF_8);
    byte[] right = actual.getBytes(StandardCharsets.UTF_8);
    int diff = left.length ^ right.length;
    int length = Math.min(left.length, right.length);
    for (int i = 0; i < length; i++) diff |= left[i] ^ right[i];
    return diff == 0;
  }

  public static class ConsoleSession {
    private final String userId;
    private final String displayName;
    private final String role;
    private final String tenantId;
    private final String workspaceId;
    private final long expiresAt;
    private final String token;

    public ConsoleSession(String userId, String displayName, String role, String tenantId, String workspaceId, long expiresAt, String token) {
      this.userId = userId;
      this.displayName = displayName;
      this.role = role;
      this.tenantId = tenantId;
      this.workspaceId = workspaceId;
      this.expiresAt = expiresAt;
      this.token = token;
    }

    public String getUserId() { return userId; }
    public String getDisplayName() { return displayName; }
    public String getRole() { return role; }
    public String getTenantId() { return tenantId; }
    public String getWorkspaceId() { return workspaceId; }
    public long getExpiresAt() { return expiresAt; }
    public String getToken() { return token; }
  }

  public static class WorkspaceAccessDeniedException extends RuntimeException {
  }

  private static class ConsoleAccount {
    private final String username;
    private final String password;
    private final String workspaceId;
    private final String displayName;
    private final String role;

    private ConsoleAccount(String username, String password, String workspaceId, String displayName, String role) {
      this.username = username;
      this.password = password;
      this.workspaceId = workspaceId;
      this.displayName = displayName;
      this.role = role;
    }
  }
}