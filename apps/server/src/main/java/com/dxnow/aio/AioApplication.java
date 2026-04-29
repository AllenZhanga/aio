package com.dxnow.aio;

import com.dxnow.aio.config.AioProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(AioProperties.class)
public class AioApplication {

  public static void main(String[] args) {
    SpringApplication.run(AioApplication.class, args);
  }
}
