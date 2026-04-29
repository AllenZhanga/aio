package com.dxnow.aio.common;

import java.time.OffsetDateTime;

public class ApiError {

  private final String code;
  private final String message;
  private final String time;

  public ApiError(String code, String message) {
    this.code = code;
    this.message = message;
    this.time = OffsetDateTime.now().toString();
  }

  public String getCode() {
    return code;
  }

  public String getMessage() {
    return message;
  }

  public String getTime() {
    return time;
  }
}
