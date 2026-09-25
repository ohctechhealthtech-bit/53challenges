package com.fiftythree.challenges.support;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Reads the JSON-typed columns, which arrive as text.
 *
 * <p>MariaDB has no native JSON type — {@code JSON} there is an alias for
 * {@code LONGTEXT} — so every one of these columns maps to a String. Base44
 * returned them to the client as real arrays and objects, and the React code
 * calls {@code .length} and {@code .map} on them, so they have to be parsed
 * back before going out or the page breaks on a string.
 *
 * <p>Malformed content yields an empty result rather than an exception: one bad
 * row should not take down a list endpoint, and the rows came from an export
 * this project does not control.
 */
@Component
public class JsonColumn {

  private static final Logger log = LoggerFactory.getLogger(JsonColumn.class);

  private final ObjectMapper mapper;

  public JsonColumn(ObjectMapper mapper) {
    this.mapper = mapper;
  }

  /**
   * A JSON array column as nodes, for arrays of objects such as a panel's
   * criteria or a score's per-criterion values. Empty when null, blank or
   * invalid, for the same reason as {@link #stringList}.
   */
  public List<JsonNode> nodes(String raw) {
    if (raw == null || raw.isBlank()) {
      return List.of();
    }
    try {
      JsonNode parsed = mapper.readTree(raw);
      if (!parsed.isArray()) {
        return List.of();
      }
      List<JsonNode> out = new ArrayList<>();
      for (JsonNode n : parsed) {
        out.add(n);
      }
      return out;
    } catch (Exception e) {
      log.warn("Could not parse JSON array column, treating as empty: {}",
          raw.length() > 80 ? raw.substring(0, 80) + "…" : raw);
      return List.of();
    }
  }

  /** A JSON array column as a list of strings; empty when null, blank or invalid. */
  public List<String> stringList(String raw) {
    if (raw == null || raw.isBlank()) {
      return List.of();
    }
    try {
      List<String> parsed = mapper.readValue(raw, new TypeReference<List<String>>() {});
      return parsed == null ? List.of() : parsed;
    } catch (Exception e) {
      log.warn("Could not parse JSON array column, treating as empty: {}",
          raw.length() > 80 ? raw.substring(0, 80) + "…" : raw);
      return List.of();
    }
  }
}
