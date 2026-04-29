package com.dxnow.aio.common;

import java.security.SecureRandom;
import java.util.Locale;

public final class Ids {

  private static final char[] ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz".toCharArray();
  private static final SecureRandom RANDOM = new SecureRandom();

  private Ids() {
  }

  public static String prefixed(String prefix) {
    return prefix + "_" + randomBase36(20);
  }

  public static String randomBase36(int length) {
    char[] value = new char[length];
    for (int i = 0; i < length; i++) {
      value[i] = ALPHABET[RANDOM.nextInt(ALPHABET.length)];
    }
    return new String(value).toLowerCase(Locale.ROOT);
  }
}
