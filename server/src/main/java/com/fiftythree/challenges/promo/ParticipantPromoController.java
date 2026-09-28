package com.fiftythree.challenges.promo;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fiftythree.challenges.engine.EntryQueryRepository;
import com.fiftythree.challenges.entity.EntryEntity;
import com.fiftythree.challenges.entity.ParticipantPostEntity;
import com.fiftythree.challenges.entity.ParticipantSocialAccountEntity;
import com.fiftythree.challenges.llm.LlmClient;
import com.fiftythree.challenges.security.CallerResolver;
import com.fiftythree.challenges.support.JsonColumn;
import com.fiftythree.challenges.support.ApiErrors;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * The Java replacement for {@code participantPromo}: helps an entrant promote
 * their own entry.
 *
 * <p>Everything here is scoped to the signed-in account. A post, a linked
 * social account and an entry are all read back by owner rather than by id
 * alone, so one entrant cannot read, edit or delete another's — and cannot
 * generate promotional copy about somebody else's work.
 *
 * <p>Promotion is offered only for <b>approved</b> entries. Pending or
 * rejected work is not publicly viewable, so a post about it would send
 * followers to a page that does not exist.
 *
 * <p><b>Image generation is not available.</b> The original called Base44's
 * {@code GenerateImage}; this app uses Claude, which does not generate images.
 * A request with {@code generate_image} set comes back with the post copy and
 * {@code image_generation_unavailable: true} rather than a silently empty URL,
 * so the interface can say so rather than appearing to have failed.
 */
@RestController
public class ParticipantPromoController {

  private static final Logger log = LoggerFactory.getLogger(ParticipantPromoController.class);

  /** Character limits per platform. The shortest of those chosen bounds the post. */
  private static final Map<String, Integer> LIMITS = Map.of(
      "instagram", 2200,
      "facebook", 2000,
      "tiktok", 2200,
      "x", 280,
      "linkedin", 2500,
      "youtube", 1000,
      "threads", 500,
      "pinterest", 500);

  private static final int MAX_HASHTAGS = 8;

  private final LlmClient llm;
  private final SocialAccountQueryRepository accounts;
  private final ParticipantPostQueryRepository posts;
  private final EntryQueryRepository entries;
  private final CallerResolver caller;
  private final JsonColumn json;
  private final ObjectMapper mapper;

  public ParticipantPromoController(
      LlmClient llm,
      SocialAccountQueryRepository accounts,
      ParticipantPostQueryRepository posts,
      EntryQueryRepository entries,
      CallerResolver caller,
      JsonColumn json,
      ObjectMapper mapper) {
    this.llm = llm;
    this.accounts = accounts;
    this.posts = posts;
    this.entries = entries;
    this.caller = caller;
    this.json = json;
    this.mapper = mapper;
  }

  @PostMapping("/api/apps/{appId}/functions/participantPromo")
  public ResponseEntity<?> handle(@RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> request = body == null ? Map.of() : body;
    String email = caller.email(str(request.get("session_token")));
    if (email == null) {
      return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
    }

    try {
      return switch (orEmpty(str(request.get("action")))) {
        case "listAccounts" -> ResponseEntity.ok(Map.of("accounts",
            accounts.findByOwner(email).stream().map(this::accountJson).toList()));
        case "saveAccount" -> saveAccount(request, email);
        case "deleteAccount" -> deleteAccount(request, email);
        case "myEntries" -> myEntries(email);
        case "generatePost" -> generatePost(request, email);
        case "listPosts" -> ResponseEntity.ok(Map.of("posts",
            posts.findByOwner(email).stream().map(this::postJson).toList()));
        case "savePost" -> savePost(request, email);
        case "markShared" -> markShared(request, email);
        case "deletePost" -> deletePost(request, email);
        default -> ResponseEntity.status(400).body(Map.of("error", "Unknown action"));
      };
    } catch (Exception e) {
      log.error("participantPromo failed", e);
      return ApiErrors.internal(e);
    }
  }

  // ------------------------------------------------------------ accounts

  private ResponseEntity<?> saveAccount(Map<String, Object> request, String email) {
    String platform = str(request.get("platform"));
    if (platform == null) {
      return ResponseEntity.status(400).body(Map.of("error", "Platform required"));
    }
    Instant now = Instant.now();

    // One row per owner and platform: saving again updates rather than
    // accumulating duplicates the participant would then have to tidy.
    ParticipantSocialAccountEntity account =
        accounts.findByOwnerAndPlatform(email, platform).stream().findFirst()
            .orElseGet(() -> {
              ParticipantSocialAccountEntity fresh = new ParticipantSocialAccountEntity();
              fresh.setId(newId());
              fresh.setCreatedDate(now);
              fresh.setIsSample(false);
              return fresh;
            });

    account.setOwnerEmail(email);
    account.setPlatform(platform);
    account.setHandle(clip(orEmpty(str(request.get("handle"))), 120));
    account.setProfileUrl(clip(orEmpty(str(request.get("profile_url"))), 400));
    account.setConnected(true);
    account.setUpdatedDate(now);
    accounts.save(account);

    return ResponseEntity.ok(Map.of("account", accountJson(account)));
  }

  private ResponseEntity<?> deleteAccount(Map<String, Object> request, String email) {
    Optional<ParticipantSocialAccountEntity> found = byId(request.get("id"), accounts::findById);
    if (found.isEmpty() || !email.equalsIgnoreCase(nz(found.get().getOwnerEmail()))) {
      // 404 rather than 403 for someone else's row, so this cannot be used to
      // discover which ids exist.
      return ResponseEntity.status(404).body(Map.of("error", "Not found"));
    }
    accounts.delete(found.get());
    return ResponseEntity.ok(Map.of("ok", true));
  }

  // ------------------------------------------------------------- entries

  private ResponseEntity<?> myEntries(String email) {
    List<Map<String, Object>> out = new ArrayList<>();
    for (EntryEntity entry : entries.findByCreatorEmail(email.toLowerCase())) {
      if (!"approved".equals(nz(entry.getStatus()))) {
        continue;
      }
      Map<String, Object> row = new LinkedHashMap<>();
      row.put("id", entry.getId());
      row.put("title", entry.getTitle());
      row.put("challenge_id", entry.getChallengeId());
      row.put("challenge_title", entry.getChallengeTitle());
      row.put("status", entry.getStatus());
      out.add(row);
    }
    return ResponseEntity.ok(Map.of("entries", out));
  }

  // ------------------------------------------------------------ generate

  private ResponseEntity<?> generatePost(Map<String, Object> request, String email) {
    List<String> platforms = stringList(request.get("platforms")).stream()
        .filter(LIMITS::containsKey)
        .toList();
    if (platforms.isEmpty()) {
      return ResponseEntity.status(400).body(Map.of("error", "Pick at least one platform"));
    }

    EntryEntity entry = null;
    String entryId = str(request.get("entry_id"));
    if (entryId != null) {
      entry = entries.findById(entryId).orElse(null);
      if (entry != null && !email.equalsIgnoreCase(nz(entry.getCreatorEmail()))) {
        return ResponseEntity.status(404).body(Map.of("error", "Not found"));
      }
      if (entry != null && !"approved".equals(nz(entry.getStatus()))) {
        return ResponseEntity.status(403).body(Map.of(
            "error", "You can promote an entry once it has been approved."));
      }
    }

    // The shortest limit across the chosen platforms, so one post fits all of
    // them rather than being truncated on the strictest.
    int limit = platforms.stream().mapToInt(LIMITS::get).min().orElse(280);

    JsonNode generated;
    try {
      generated = llm.invoke(prompt(request, entry, platforms, limit), schema());
    } catch (LlmClient.LlmUnavailableException e) {
      return ResponseEntity.status(503).body(Map.of("error", e.getMessage()));
    }

    List<String> hashtags = new ArrayList<>();
    for (JsonNode tag : generated.path("hashtags")) {
      if (hashtags.size() >= MAX_HASHTAGS) {
        break;
      }
      hashtags.add(tag.asText(""));
    }

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("content", generated.path("content").asText(""));
    out.put("hashtags", hashtags);
    out.put("image_url", "");
    if (Boolean.TRUE.equals(request.get("generate_image"))) {
      // Said plainly rather than returning an empty URL, which the interface
      // would render as a generation that failed.
      out.put("image_generation_unavailable", true);
      out.put("image_note",
          "Image generation is not available on this platform. The post copy is ready to use.");
    }
    return ResponseEntity.ok(out);
  }

  private String prompt(
      Map<String, Object> request, EntryEntity entry, List<String> platforms, int limit) {

    StringBuilder prompt = new StringBuilder("""
        Write a social media post for a creator promoting their own competition \
        entry on 53 Challenges, an Australian creative competition platform. The \
        goal is to get friends and followers to view and vote for the entry.

        """);

    if (entry != null) {
      prompt.append("Entry title: ").append(clip(nz(entry.getTitle()), 160)).append('\n');
      prompt.append("Challenge: ").append(clip(nz(entry.getChallengeTitle()), 160)).append('\n');
      prompt.append("What they made: ")
          .append(clip(firstNonBlank(entry.getDescription(), entry.getWorkText()), 500))
          .append('\n');
    }
    String topic = str(request.get("topic"));
    if (topic != null) {
      prompt.append("What they want to say: ").append(clip(topic, 400)).append('\n');
    }
    prompt.append("Tone: ").append(clip(strOr(request.get("tone"), "friendly"), 30)).append('\n');
    prompt.append("Platforms: ").append(String.join(", ", platforms)).append("\n\n");

    prompt.append("""
        Write in Australian English, first person, under %d characters, with one \
        clear call to action asking people to vote. Return the post copy and 5 to \
        8 relevant hashtags without the # symbol.""".formatted(limit));

    return prompt.toString();
  }

  private JsonNode schema() {
    ObjectNode content = mapper.createObjectNode();
    content.put("type", "string");
    content.put("description", "The post copy, ready to paste.");

    ObjectNode hashtags = mapper.createObjectNode();
    hashtags.put("type", "array");
    hashtags.put("description", "Five to eight hashtags, without the # symbol.");
    hashtags.set("items", mapper.createObjectNode().put("type", "string"));

    ObjectNode properties = mapper.createObjectNode();
    properties.set("content", content);
    properties.set("hashtags", hashtags);

    ObjectNode schema = mapper.createObjectNode();
    schema.put("type", "object");
    schema.set("properties", properties);
    schema.set("required", mapper.valueToTree(List.of("content", "hashtags")));
    return schema;
  }

  // --------------------------------------------------------------- posts

  private ResponseEntity<?> savePost(Map<String, Object> request, String email) {
    String content = str(request.get("content"));
    if (content == null) {
      return ResponseEntity.status(400).body(Map.of("error", "Post content required"));
    }
    Instant now = Instant.now();

    ParticipantPostEntity post = new ParticipantPostEntity();
    post.setId(newId());
    post.setOwnerEmail(email);
    post.setEntryId(orEmpty(str(request.get("entry_id"))));
    post.setChallengeTitle(orEmpty(str(request.get("challenge_title"))));
    post.setTopic(clip(orEmpty(str(request.get("topic"))), 300));
    post.setTone(strOr(request.get("tone"), "friendly"));
    post.setContent(clip(content, 4000));
    post.setHashtags(write(stringList(request.get("hashtags")).stream().limit(12).toList()));
    post.setImageUrl(orEmpty(str(request.get("image_url"))));
    post.setPlatforms(write(stringList(request.get("platforms"))));
    post.setStatus("draft");
    post.setCreatedDate(now);
    post.setUpdatedDate(now);
    post.setIsSample(false);
    posts.save(post);

    return ResponseEntity.ok(Map.of("post", postJson(post)));
  }

  private ResponseEntity<?> markShared(Map<String, Object> request, String email) {
    Optional<ParticipantPostEntity> found = byId(request.get("id"), posts::findById);
    if (found.isEmpty() || !email.equalsIgnoreCase(nz(found.get().getOwnerEmail()))) {
      return ResponseEntity.status(404).body(Map.of("error", "Not found"));
    }
    ParticipantPostEntity post = found.get();
    post.setStatus("shared");
    post.setSharedAt(Instant.now());
    post.setUpdatedDate(Instant.now());
    posts.save(post);
    return ResponseEntity.ok(Map.of("post", postJson(post)));
  }

  private ResponseEntity<?> deletePost(Map<String, Object> request, String email) {
    Optional<ParticipantPostEntity> found = byId(request.get("id"), posts::findById);
    if (found.isEmpty() || !email.equalsIgnoreCase(nz(found.get().getOwnerEmail()))) {
      return ResponseEntity.status(404).body(Map.of("error", "Not found"));
    }
    posts.delete(found.get());
    return ResponseEntity.ok(Map.of("ok", true));
  }

  // -------------------------------------------------------------- shapes

  private Map<String, Object> accountJson(ParticipantSocialAccountEntity a) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", a.getId());
    out.put("owner_email", a.getOwnerEmail());
    out.put("platform", a.getPlatform());
    out.put("handle", a.getHandle());
    out.put("profile_url", a.getProfileUrl());
    out.put("connected", a.getConnected());
    out.put("created_date", iso(a.getCreatedDate()));
    return out;
  }

  private Map<String, Object> postJson(ParticipantPostEntity p) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", p.getId());
    out.put("owner_email", p.getOwnerEmail());
    out.put("entry_id", p.getEntryId());
    out.put("challenge_title", p.getChallengeTitle());
    out.put("topic", p.getTopic());
    out.put("tone", p.getTone());
    out.put("content", p.getContent());
    out.put("hashtags", json.stringList(p.getHashtags()));
    out.put("image_url", p.getImageUrl());
    out.put("platforms", json.stringList(p.getPlatforms()));
    out.put("status", p.getStatus());
    out.put("shared_at", iso(p.getSharedAt()));
    out.put("created_date", iso(p.getCreatedDate()));
    return out;
  }

  // ------------------------------------------------------------- helpers

  private static <T> Optional<T> byId(Object id, java.util.function.Function<String,
      Optional<T>> lookup) {
    String key = str(id);
    return key == null ? Optional.empty() : lookup.apply(key);
  }

  private String write(Object value) {
    try {
      return mapper.writeValueAsString(value);
    } catch (Exception e) {
      throw new IllegalStateException("Could not serialise a promo column", e);
    }
  }

  private static List<String> stringList(Object value) {
    if (!(value instanceof List<?> list)) {
      return List.of();
    }
    return list.stream().map(String::valueOf).toList();
  }

  private static String firstNonBlank(String a, String b) {
    return a != null && !a.isBlank() ? a : nz(b);
  }

  private static String clip(String value, int max) {
    String text = nz(value);
    return text.length() <= max ? text : text.substring(0, max);
  }

  private static String iso(Instant value) {
    return value == null ? null : value.toString();
  }

  private static String strOr(Object value, String fallback) {
    String text = str(value);
    return text == null ? fallback : text;
  }

  private static String orEmpty(String value) {
    return value == null ? "" : value;
  }

  private static String nz(String value) {
    return value == null ? "" : value;
  }

  private static String str(Object value) {
    if (value == null) {
      return null;
    }
    String text = String.valueOf(value).trim();
    return text.isEmpty() ? null : text;
  }

  private static String newId() {
    return UUID.randomUUID().toString().replace("-", "").substring(0, 24);
  }
}
