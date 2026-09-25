package com.fiftythree.challenges.config;

import com.fiftythree.challenges.security.JwtAuthFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {

  private final JwtAuthFilter jwtAuthFilter;
  private final RestAuthenticationEntryPoint entryPoint;

  public SecurityConfig(JwtAuthFilter jwtAuthFilter, RestAuthenticationEntryPoint entryPoint) {
    this.jwtAuthFilter = jwtAuthFilter;
    this.entryPoint = entryPoint;
  }

  @Bean
  public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    http
        // The API is stateless and token-based, so there is no session to fix
        // and no cookie for a cross-site form to ride on.
        .csrf(csrf -> csrf.disable())
        .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        // No CORS config on purpose: nginx serves the SPA and proxies /api on
        // the same origin, exactly as it does for Base44 today.
        .authorizeHttpRequests(auth -> auth
            .requestMatchers("/api/health", "/api/auth/login").permitAll()
            // The ported Base44 functions authorise per action inside the
            // controller, because some actions are public and some are
            // admin-only on the same URL. 'resolve' in particular must work for
            // anonymous visitors — it is what tells a challenge subdomain which
            // challenge to render, so requiring a token here would leave every
            // subdomain blank for logged-out users.
            .requestMatchers("/api/apps/*/functions/**").permitAll()
            // The entity API authorises per row rather than per request: a
            // read is narrowed to what the caller may see, and some entities
            // are readable anonymously (the category menus and site theme
            // render before sign-in). Requiring a token here would blank the
            // public site, so EntityPolicies does the deciding.
            .requestMatchers("/api/apps/*/entities/**").permitAll()
            // Spring forwards an unmatched request to /error. Left
            // authenticated, that turns every 404 into "401 Please sign in." —
            // which sends you looking at tokens and security config when the
            // real problem is a route that does not exist. Permitting it lets
            // a 404 report itself as a 404.
            .requestMatchers("/error").permitAll()
            .anyRequest().authenticated())
        // 401 rather than Spring's default 403 for anonymous requests.
        .exceptionHandling(e -> e.authenticationEntryPoint(entryPoint))
        .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);
    return http.build();
  }
}
