package com.fiftythree.challenges.entityapi;

import java.lang.reflect.Method;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** Reflection helpers shared by the entity API. */
final class Entities {

  private static final Logger log = LoggerFactory.getLogger(Entities.class);

  private Entities() {}

  /** Reads one property off an entity by its Java attribute name. */
  static Object read(Object row, String attribute) {
    if (row == null || attribute == null) {
      return null;
    }
    String suffix = Character.toUpperCase(attribute.charAt(0)) + attribute.substring(1);
    for (String prefix : new String[] {"get", "is"}) {
      try {
        Method getter = row.getClass().getMethod(prefix + suffix);
        return getter.invoke(row);
      } catch (NoSuchMethodException e) {
        // Try the next prefix.
      } catch (Exception e) {
        log.warn("Could not read '{}' from {}: {}",
            attribute, row.getClass().getSimpleName(), e.toString());
        return null;
      }
    }
    return null;
  }

  /** {@code creator_email} to {@code creatorEmail}. */
  static String toAttribute(String field) {
    if (field == null || field.isEmpty()) {
      return field;
    }
    StringBuilder out = new StringBuilder(field.length());
    boolean upper = false;
    for (char c : field.toCharArray()) {
      if (c == '_') {
        upper = true;
        continue;
      }
      out.append(upper ? Character.toUpperCase(c) : c);
      upper = false;
    }
    return out.toString();
  }

  /** {@code creatorEmail} to {@code creator_email}. */
  static String toField(String attribute) {
    StringBuilder out = new StringBuilder(attribute.length() + 4);
    for (char c : attribute.toCharArray()) {
      if (Character.isUpperCase(c)) {
        out.append('_').append(Character.toLowerCase(c));
      } else {
        out.append(c);
      }
    }
    return out.toString().toLowerCase(Locale.ROOT);
  }
}
