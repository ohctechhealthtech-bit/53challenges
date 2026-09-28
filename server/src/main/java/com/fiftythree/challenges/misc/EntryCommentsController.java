package com.fiftythree.challenges.misc;

import com.fiftythree.challenges.entity.EntryCommentEntity;
import com.fiftythree.challenges.security.CustomSessionVerifier;
import com.fiftythree.challenges.support.ApiErrors;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * The Java replacement for {@code entryComments}.
 *
 * <pre>
 *   list   -> {comments}   (public)
 *   create -> {comment}    (signed in)
 * </pre>
 *
 * <p>The author's name comes from the verified session, never from the request
 * body. A client-supplied name would let anyone post under someone else's
 * identity, which on a page carrying entries by children is not a small thing.
 */
@RestController
public class EntryCommentsController {

  private static final Logger log = LoggerFactory.getLogger(EntryCommentsController.class);

  /** Matches the original's truncation, and bounds what one comment can store. */
  private static final int MAX_LENGTH = 500;

  private final EntryCommentQueryRepository comments;
  private final CustomSessionVerifier customSession;

  public EntryCommentsController(
      EntryCommentQueryRepository comments, CustomSessionVerifier customSession) {
    this.comments = comments;
    this.customSession = customSession;
  }

  @PostMapping("/api/apps/{appId}/functions/entryComments")
  public ResponseEntity<?> handle(@RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> request = body == null ? Map.of() : body;
    String action = str(request.get("action"));

    try {
      if ("list".equals(action)) {
        List<EntryCommentEntity> rows =
            comments.findByEntryIdOrderByCreatedDateDesc(str(request.get("entry_id")));
        return ResponseEntity.ok(Map.of("comments", rows));
      }
      if (!"create".equals(action)) {
        return ResponseEntity.badRequest().body(Map.of("error", "Unknown action"));
      }

      String authorName = resolveAuthorName(str(request.get("session_token")));
      if (authorName == null) {
        return ResponseEntity.status(401).body(Map.of("error", "Please sign in to comment."));
      }

      String text = str(request.get("text")).trim();
      if (text.isEmpty()) {
        return ResponseEntity.badRequest().body(Map.of("error", "Comment cannot be empty."));
      }
      if (text.length() > MAX_LENGTH) {
        text = text.substring(0, MAX_LENGTH);
      }

      EntryCommentEntity comment = new EntryCommentEntity();
      // Base44 generated a 24-character hex id for every row and the whole
      // schema types ids that way, so a new row has to match rather than take
      // a UUID.
      comment.setId(newId());
      comment.setEntryId(str(request.get("entry_id")));
      comment.setChallengeId(str(request.get("challenge_id")));
      comment.setText(text);
      comment.setAuthorName(authorName);
      comment.setCreatedDate(Instant.now());
      comment.setUpdatedDate(Instant.now());
      comment.setIsSample(false);

      return ResponseEntity.ok(Map.of("comment", comments.save(comment)));
    } catch (Exception e) {
      log.error("entryComments action '{}' failed", action, e);
      return ApiErrors.internal(e);
    }
  }

  /**
   * The display name for the signed-in caller, or null when nobody is signed
   * in. The JWT carries a name claim; the legacy session token carries one too,
   * falling back to the email when it is blank.
   */
  private String resolveAuthorName(String sessionToken) {
    var auth = SecurityContextHolder.getContext().getAuthentication();
    if (auth != null && auth.getDetails() instanceof io.jsonwebtoken.Claims claims) {
      String name = claims.get("name", String.class);
      String email = claims.get("email", String.class);
      if (email != null && !email.isBlank()) {
        return name != null && !name.isBlank() ? name : email;
      }
    }
    CustomSessionVerifier.Session session = customSession.verify(sessionToken);
    if (session == null) {
      return null;
    }
    return session.name() != null && !session.name().isBlank() ? session.name() : session.email();
  }

  /** A 24-character hex id, the shape every existing row uses. */
  private static String newId() {
    String hex = java.util.UUID.randomUUID().toString().replace("-", "");
    return hex.substring(0, 24);
  }

  private static String str(Object v) {
    return v == null ? "" : String.valueOf(v);
  }
}
