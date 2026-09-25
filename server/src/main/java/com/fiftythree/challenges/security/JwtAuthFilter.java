package com.fiftythree.challenges.security;

import com.fiftythree.challenges.user.UserRepository;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Establishes the caller from the bearer token on each request.
 *
 * <p>The role is read from this database rather than from the token, so an admin
 * grant or revocation takes effect immediately instead of when the token
 * expires. This mirrors {@code isAdminCaller}, which looked the role up on the
 * local User record for exactly the same reason.
 */
@Component
public class JwtAuthFilter extends OncePerRequestFilter {

  private static final Logger log = LoggerFactory.getLogger(JwtAuthFilter.class);

  private final JwtService jwtService;
  private final UserRepository users;

  public JwtAuthFilter(JwtService jwtService, UserRepository users) {
    this.jwtService = jwtService;
    this.users = users;
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {

    String header = request.getHeader("Authorization");

    if (header == null) {
      // Distinguishes "client sent nothing" from "proxy dropped the header" —
      // the two look identical from outside and lead to very different fixes.
      log.debug("No Authorization header on {} {}", request.getMethod(), request.getRequestURI());
    }

    String token = (header != null && header.startsWith("Bearer ")) ? header.substring(7) : null;
    Claims claims = jwtService.verify(token);

    if (token != null && claims == null) {
      log.warn("Rejected a bearer token on {} — signature invalid, malformed, or expired",
          request.getRequestURI());
    }

    if (claims != null && SecurityContextHolder.getContext().getAuthentication() == null) {
      String email = String.valueOf(claims.get("email", String.class)).toLowerCase().trim();

      // A database failure must not masquerade as an authentication failure:
      // without this the caller sees a bare 403 and the real cause (bad
      // credentials, missing table) never surfaces.
      String role;
      try {
        role = users.findRoleByEmail(email).orElse("user");
      } catch (Exception e) {
        log.error("Role lookup failed for {} — treating as 'user'. Cause: {}", email, e.toString());
        role = "user";
      }

      var authorities = List.of(new SimpleGrantedAuthority("ROLE_" + role.toUpperCase()));
      var auth = new UsernamePasswordAuthenticationToken(email, null, authorities);
      auth.setDetails(claims);
      SecurityContextHolder.getContext().setAuthentication(auth);
      log.debug("Authenticated {} as {}", email, role);
    }

    chain.doFilter(request, response);
  }
}
