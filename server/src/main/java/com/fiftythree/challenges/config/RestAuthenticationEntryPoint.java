package com.fiftythree.challenges.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

/**
 * Returns 401 for an unauthenticated request instead of Spring Security's
 * default bare 403.
 *
 * <p>403 means "authenticated but not allowed"; a missing or invalid token is
 * 401. The distinction is not cosmetic: the React client's
 * {@code isSessionExpired} check keys on 401 to clear the stored session and
 * send the user back to log in. A 403 would leave them staring at a dead page.
 */
@Component
public class RestAuthenticationEntryPoint implements AuthenticationEntryPoint {

  @Override
  public void commence(
      HttpServletRequest request,
      HttpServletResponse response,
      AuthenticationException authException)
      throws IOException {
    response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
    response.setContentType("application/json");
    response.getWriter().write("{\"error\":\"Please sign in.\"}");
  }
}
