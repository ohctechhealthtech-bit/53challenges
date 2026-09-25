package com.fiftythree.challenges.security;

import com.fiftythree.challenges.user.UserRepository;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/**
 * Who is calling, across both login systems.
 *
 * <p>Replaces {@code base44/shared/adminAuth.ts}. There are two ways to be
 * signed in during the cutover — the JWT this API issues, and the older
 * Challenge-API session token sent in the request body — and a route that
 * accepted only one would lock out half the admins for no visible reason.
 *
 * <p>The role always comes from this database, never from the token, so
 * granting or revoking admin takes effect on the next request instead of when
 * the token expires. That is the rule {@code isAdminCaller} already followed.
 */
@Component
public class CallerResolver {

  private static final Logger log = LoggerFactory.getLogger(CallerResolver.class);

  /** Both count as admin, matching ADMIN_ROLES in adminAuth.ts. */
  private static final Set<String> ADMIN_ROLES = Set.of("admin", "creator");

  private final CustomSessionVerifier customSession;
  private final UserRepository users;

  public CallerResolver(CustomSessionVerifier customSession, UserRepository users) {
    this.customSession = customSession;
    this.users = users;
  }

  /**
   * The caller's email, from the JWT if the filter authenticated one, otherwise
   * from the legacy session token. Null when neither is present or valid.
   */
  public String email(String sessionToken) {
    var auth = SecurityContextHolder.getContext().getAuthentication();
    if (auth != null && auth.isAuthenticated() && auth.getPrincipal() instanceof String email
        && !email.isBlank() && !"anonymousUser".equals(email)) {
      return email.toLowerCase().trim();
    }
    CustomSessionVerifier.Session session = customSession.verify(sessionToken);
    return session == null ? null : session.email();
  }

  /** Whether the caller holds an admin role on their local User record. */
  public boolean isAdmin(String sessionToken) {
    String email = email(sessionToken);
    if (email == null) {
      return false;
    }
    try {
      return users.findRoleByEmail(email).map(ADMIN_ROLES::contains).orElse(false);
    } catch (Exception e) {
      // A database fault is not an authorisation decision. Denying is the safe
      // outcome, but it must be distinguishable in the logs from a genuine
      // "not an admin" — otherwise an outage looks like a permissions bug.
      log.error("Role lookup failed for {} — denying admin. Cause: {}", email, e.toString());
      return false;
    }
  }
}
