package com.dxnow.aio.common;

import com.dxnow.aio.config.AioProperties;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Component;

@Component
public class CryptoService {

  private static final String CIPHER = "AES/GCM/NoPadding";
  private static final String KEY_ALGORITHM = "AES";
  private static final int IV_BYTES = 12;
  private static final int TAG_BITS = 128;
  private static final String PREFIX = "v1";

  private final SecureRandom secureRandom = new SecureRandom();
  private final SecretKeySpec keySpec;

  public CryptoService(AioProperties properties) {
    this.keySpec = new SecretKeySpec(sha256(properties.getSecretKey()), KEY_ALGORITHM);
  }

  public String encrypt(String plaintext) {
    if (plaintext == null || plaintext.isBlank()) {
      return null;
    }
    byte[] iv = new byte[IV_BYTES];
    secureRandom.nextBytes(iv);
    try {
      Cipher cipher = Cipher.getInstance(CIPHER);
      cipher.init(Cipher.ENCRYPT_MODE, keySpec, new GCMParameterSpec(TAG_BITS, iv));
      byte[] ciphertext = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
      return PREFIX + ":" + Base64.getEncoder().encodeToString(iv) + ":" + Base64.getEncoder().encodeToString(ciphertext);
    } catch (GeneralSecurityException exception) {
      throw new IllegalStateException("Failed to encrypt value", exception);
    }
  }

  public String decrypt(String encoded) {
    if (encoded == null || encoded.isBlank()) {
      return null;
    }
    String[] parts = encoded.split(":", 3);
    if (parts.length != 3 || !PREFIX.equals(parts[0])) {
      throw new IllegalArgumentException("Unsupported encrypted value format");
    }
    try {
      byte[] iv = Base64.getDecoder().decode(parts[1]);
      byte[] ciphertext = Base64.getDecoder().decode(parts[2]);
      Cipher cipher = Cipher.getInstance(CIPHER);
      cipher.init(Cipher.DECRYPT_MODE, keySpec, new GCMParameterSpec(TAG_BITS, iv));
      return new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
    } catch (IllegalArgumentException | GeneralSecurityException exception) {
      throw new IllegalStateException("Failed to decrypt value", exception);
    }
  }

  private static byte[] sha256(String value) {
    try {
      return MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
    } catch (NoSuchAlgorithmException exception) {
      throw new IllegalStateException("SHA-256 digest is unavailable", exception);
    }
  }
}