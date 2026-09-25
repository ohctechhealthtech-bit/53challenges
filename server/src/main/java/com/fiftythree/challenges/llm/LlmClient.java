package com.fiftythree.challenges.llm;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * The replacement for Base44's {@code integrations.Core.InvokeLLM}, talking to
 * the Anthropic Messages API.
 *
 * <p>The Base44 functions asked for structured output by passing a
 * {@code response_json_schema} and reading back a parsed object. That is
 * reproduced here with a <b>tool call</b> rather than by asking for JSON in the
 * prompt: the schema becomes a single tool the model is forced to use, so the
 * result is validated against it before it arrives. Prompting for JSON and
 * parsing whatever comes back works until the day it returns prose with a
 * preamble, and these results are written straight into database records.
 *
 * <p>Absent an API key the client reports itself {@link #isConfigured()
 * unconfigured} rather than failing at call time, so a controller can answer
 * with a clear message instead of a 500.
 */
@Component
public class LlmClient {

  private static final Logger log = LoggerFactory.getLogger(LlmClient.class);

  private static final String ENDPOINT = "https://api.anthropic.com/v1/messages";
  private static final String API_VERSION = "2023-06-01";

  /** The name the forced tool call is made under. */
  private static final String TOOL_NAME = "emit_result";

  private final HttpClient http = HttpClient.newBuilder()
      .connectTimeout(Duration.ofSeconds(15))
      .build();

  private final ObjectMapper mapper;
  private final String apiKey;
  private final String model;
  private final int maxTokens;
  private final Duration timeout;

  public LlmClient(
      ObjectMapper mapper,
      @Value("${app.llm.api-key:}") String apiKey,
      @Value("${app.llm.model:claude-sonnet-5}") String model,
      @Value("${app.llm.max-tokens:4096}") int maxTokens,
      @Value("${app.llm.timeout-seconds:120}") int timeoutSeconds) {
    this.mapper = mapper;
    this.apiKey = apiKey == null ? "" : apiKey.trim();
    this.model = model;
    this.maxTokens = maxTokens;
    this.timeout = Duration.ofSeconds(timeoutSeconds);
  }

  /** Whether an API key is present. False means every call would fail. */
  public boolean isConfigured() {
    return !apiKey.isEmpty();
  }

  /** Raised when the model cannot be reached or does not answer usefully. */
  public static class LlmUnavailableException extends RuntimeException {
    public LlmUnavailableException(String message) {
      super(message);
    }
  }

  /**
   * Runs a prompt and returns a result matching {@code schema}.
   *
   * @param prompt the instruction, already containing everything the model needs
   * @param schema a JSON Schema object describing the required result shape
   * @throws LlmUnavailableException when no key is set, the call fails, or the
   *     model declines to produce a result
   */
  public JsonNode invoke(String prompt, JsonNode schema) {
    if (!isConfigured()) {
      throw new LlmUnavailableException(
          "No LLM API key is configured. Set LLM_API_KEY on the service.");
    }

    ObjectNode tool = mapper.createObjectNode();
    tool.put("name", TOOL_NAME);
    tool.put("description", "Return the result in the required structure.");
    tool.set("input_schema", schema);

    ObjectNode message = mapper.createObjectNode();
    message.put("role", "user");
    message.put("content", prompt);

    ObjectNode body = mapper.createObjectNode();
    body.put("model", model);
    body.put("max_tokens", maxTokens);
    body.set("messages", mapper.createArrayNode().add(message));
    body.set("tools", mapper.createArrayNode().add(tool));
    // Forced, not merely offered: an unforced call may come back as prose,
    // and the caller has no use for prose.
    ObjectNode choice = mapper.createObjectNode();
    choice.put("type", "tool");
    choice.put("name", TOOL_NAME);
    body.set("tool_choice", choice);

    JsonNode response = send(body);
    for (JsonNode block : response.path("content")) {
      if ("tool_use".equals(block.path("type").asText())
          && TOOL_NAME.equals(block.path("name").asText())) {
        return block.path("input");
      }
    }
    log.warn("LLM returned no tool call. stop_reason={}", response.path("stop_reason").asText());
    throw new LlmUnavailableException("The model did not return a structured result.");
  }

  private JsonNode send(ObjectNode body) {
    try {
      HttpRequest request = HttpRequest.newBuilder(URI.create(ENDPOINT))
          .timeout(timeout)
          .header("content-type", "application/json")
          .header("x-api-key", apiKey)
          .header("anthropic-version", API_VERSION)
          .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)))
          .build();

      HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
      if (response.statusCode() >= 400) {
        // The body carries the reason — an invalid key, a rate limit, a model
        // name that does not exist. Logged, but not returned to the browser:
        // it can quote back parts of the request.
        log.error("LLM call failed: HTTP {} {}", response.statusCode(),
            truncate(response.body()));
        throw new LlmUnavailableException(
            "The language model is unavailable (HTTP " + response.statusCode() + ").");
      }
      return mapper.readTree(response.body());
    } catch (LlmUnavailableException e) {
      throw e;
    } catch (Exception e) {
      log.error("LLM call failed: {}", e.toString());
      throw new LlmUnavailableException("The language model could not be reached.");
    }
  }

  private static String truncate(String body) {
    if (body == null) {
      return "";
    }
    return body.length() <= 500 ? body : body.substring(0, 500) + "…";
  }
}
