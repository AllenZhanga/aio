package com.dxnow.aio.config;

import javax.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "aio")
public class AioProperties {

  @NotBlank
  private String appMode = "private";

  @NotBlank
  private String deploymentProfile = "embedded";

  @NotBlank
  private String defaultTenantId = "default";

  private boolean multiTenantEnabled = false;

  private boolean stdioMcpEnabled = false;

  private boolean codeNodeEnabled = false;

  @NotBlank
  private String secretKey = "dev-only-change-me";

  @NotBlank
  private String consoleUsername = "admin";

  @NotBlank
  private String consolePassword = "admin";

  private String consoleAccounts = "";

  private long consoleSessionTtlSeconds = 28800;

  public String getAppMode() {
    return appMode;
  }

  public void setAppMode(String appMode) {
    this.appMode = appMode;
  }

  public String getDeploymentProfile() {
    return deploymentProfile;
  }

  public void setDeploymentProfile(String deploymentProfile) {
    this.deploymentProfile = deploymentProfile;
  }

  public String getDefaultTenantId() {
    return defaultTenantId;
  }

  public void setDefaultTenantId(String defaultTenantId) {
    this.defaultTenantId = defaultTenantId;
  }

  public boolean isMultiTenantEnabled() {
    return multiTenantEnabled;
  }

  public void setMultiTenantEnabled(boolean multiTenantEnabled) {
    this.multiTenantEnabled = multiTenantEnabled;
  }

  public boolean isStdioMcpEnabled() {
    return stdioMcpEnabled;
  }

  public void setStdioMcpEnabled(boolean stdioMcpEnabled) {
    this.stdioMcpEnabled = stdioMcpEnabled;
  }

  public boolean isCodeNodeEnabled() {
    return codeNodeEnabled;
  }

  public void setCodeNodeEnabled(boolean codeNodeEnabled) {
    this.codeNodeEnabled = codeNodeEnabled;
  }

  public String getSecretKey() {
    return secretKey;
  }

  public void setSecretKey(String secretKey) {
    this.secretKey = secretKey;
  }

  public String getConsoleUsername() {
    return consoleUsername;
  }

  public void setConsoleUsername(String consoleUsername) {
    this.consoleUsername = consoleUsername;
  }

  public String getConsolePassword() {
    return consolePassword;
  }

  public void setConsolePassword(String consolePassword) {
    this.consolePassword = consolePassword;
  }

  public String getConsoleAccounts() {
    return consoleAccounts;
  }

  public void setConsoleAccounts(String consoleAccounts) {
    this.consoleAccounts = consoleAccounts;
  }

  public long getConsoleSessionTtlSeconds() {
    return consoleSessionTtlSeconds;
  }

  public void setConsoleSessionTtlSeconds(long consoleSessionTtlSeconds) {
    this.consoleSessionTtlSeconds = consoleSessionTtlSeconds;
  }
}
