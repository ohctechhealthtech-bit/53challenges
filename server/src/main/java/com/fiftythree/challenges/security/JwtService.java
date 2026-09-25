package com.fiftythree.challenges.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Issues and verifies the API's JSON Web Tokens.
 *
 * <p>The claim set deliberately mirrors the Base44 custom session it replaces —
 * {@code email}, {@code name}, {@code uid}, {@code exp} — so the existing React
 * client keeps working unchanged through the cutover. The difference is that
 * this is a standards-compliant JWT (signed header included) rather than the
 * bespoke {@code payload.signature} format, so any library can verify it.
 */
@Service
public class JwtService {

  private final SecretKey key;
  private final long ttlSeconds;

  public JwtService(
      @Value("${app.jwt.secret}") String secret,
      @Value("${app.jwt.ttl-seconds}") long ttlSeconds) {
    byte[] bytes = secret.getBytes(StandardCharsets.UTF_8);
    if (bytes.length < 32) {
      // Fail at startup rather than issuing weak tokens in production.
      throw new IllegalStateException("app.jwt.secret must be at least 32 bytes");
    }
    this.key = Keys.hmacShaKeyFor(bytes);
    this.ttlSeconds = ttlSeconds;
  }

  public String issue(String email, String name, String uid) {
    Date now = new Date();
    return Jwts.builder()
        .subject(email)
        .claim("email", email)
        .claim("name", name == null ? "" : name)
        .claim("uid", uid == null ? "" : uid)
        .issuedAt(now)
        .expiration(new Date(now.getTime() + ttlSeconds * 1000L))
        .signWith(key)
        .compact();
  }

  /** Returns the claims, or null when the token is absent, malformed or expired. */
  public Claims verify(String token) {
    if (token == null || token.isBlank()) {
      return null;
    }
    try {
      return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
    } catch (Exception e) {
      // Any parse or signature failure is simply "not authenticated" — the
      // reason is never echoed to the caller.
      return null;
    }
  }
}
