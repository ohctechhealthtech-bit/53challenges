package com.fiftythree.challenges;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;

/**
 * {@code UserDetailsServiceAutoConfiguration} is excluded deliberately.
 *
 * <p>Without it, Spring Boot sees no UserDetailsService bean and creates an
 * in-memory user called "user" with a random password, printing it at every
 * startup:
 *
 * <pre>Using generated security password: 4a6f3e93-…</pre>
 *
 * <p>Authentication here is entirely JWT and Challenge-API session based, so
 * that account is never a valid way in — the filter chain configures neither
 * form login nor HTTP Basic. But leaving it in place means a real credential
 * exists in the running application and is written to the system journal on
 * every restart, where anyone who can read logs can see it. Anything that adds
 * Basic auth later, including a dependency doing it by default, would make it
 * live. Removing it costs nothing and closes that off.
 */
@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
public class Application {
  public static void main(String[] args) {
    SpringApplication.run(Application.class, args);
  }
}
