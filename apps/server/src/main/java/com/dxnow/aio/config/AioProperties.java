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
}
