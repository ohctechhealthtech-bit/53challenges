package com.fiftythree.challenges.plesk;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * Slug rules decide what hostname gets created on the live server, so the
 * failures here are DNS-shaped: a reserved name that shadows mail or the API,
 * a label the resolver will not accept, or a "full domain" that is actually
 * one of ours.
 */
class SubdomainValidationTest {

  @Test
  void freeTextIsCoercedIntoADnsLabel() {
    assertEquals("spring-sing", SubdomainValidation.normaliseSlug("  Spring Sing  "));
    assertEquals("spring-sing", SubdomainValidation.normaliseSlug("spring_sing"));
    assertEquals("spring-sing", SubdomainValidation.normaliseSlug("spring.sing"));
    assertEquals("springsing", SubdomainValidation.normaliseSlug("spring!@#sing"));
    // A DNS label cannot start or end with a hyphen.
    assertEquals("sing", SubdomainValidation.normaliseSlug("--sing--"));
    assertEquals("", SubdomainValidation.normaliseSlug("!!!"));
  }

  @Test
  void reservedNamesAreRefused() {
    // The important ones: a challenge at api. or mail. would break the thing
    // it shadowed, silently and site-wide.
    for (String reserved : List.of("api", "www", "mail", "admin", "ftp", "localhost",
        "static", "guardian", "judge")) {
      SubdomainValidation.Result result = SubdomainValidation.validateSlug(reserved);
      assertFalse(result.valid(), reserved + " must be refused");
      assertTrue(result.error().contains("reserved"), result.error());
    }
  }

  @Test
  void aReservedNameCannotBeSmuggledThroughNormalisation() {
    // "A P I" and "a.p.i" normalise to "a-p-i", not "api", so these are fine
    // — but "API" and " api " do reach the reserved check, which is the point.
    assertFalse(SubdomainValidation.validateSlug("API").valid());
    assertFalse(SubdomainValidation.validateSlug("  Api  ").valid());
    assertFalse(SubdomainValidation.validateSlug("mail.").valid());
  }

  @Test
  void lengthLimitsMatchDns() {
    assertFalse(SubdomainValidation.validateSlug("a").valid(), "one character is too short");
    assertTrue(SubdomainValidation.validateSlug("ab").valid());
    assertTrue(SubdomainValidation.validateSlug("a".repeat(63)).valid());
    assertFalse(SubdomainValidation.validateSlug("a".repeat(64)).valid(),
        "a DNS label cannot exceed 63 characters");
  }

  @Test
  void punycodePrefixIsRefused() {
    assertFalse(SubdomainValidation.validateSlug("xn--fiq228c").valid());
  }

  @Test
  void aValidSlugComesBackNormalised() {
    SubdomainValidation.Result result = SubdomainValidation.validateSlug("  Spring Sing! ");
    assertTrue(result.valid());
    assertEquals("spring-sing", result.normalized(),
        "the caller uses this, so it must be the cleaned form");
  }

  // ---------------------------------------------------------- full domains

  @Test
  void ourOwnDomainIsNotAFullDomain() {
    // These must go through the subdomain flow; registering one as an
    // independent domain would create a second, conflicting subscription.
    assertFalse(SubdomainValidation.validateFullDomain("53challenges.com").valid());
    assertFalse(SubdomainValidation.validateFullDomain("singing.53challenges.com").valid());
  }

  @Test
  void urlsAndAddressesAreRefused() {
    for (String bad : List.of(
        "https://example.com", "example.com/path", "example.com:8443",
        "example.com?q=1", "192.168.0.1", "localhost", "app.localhost",
        "example", "exa mple.com")) {
      assertFalse(SubdomainValidation.validateFullDomain(bad).valid(),
          bad + " must be refused");
    }
  }

  @Test
  void aPlainDomainIsAccepted() {
    SubdomainValidation.Result result = SubdomainValidation.validateFullDomain("Example.COM");
    assertTrue(result.valid());
    assertEquals("example.com", result.normalized());
    assertTrue(SubdomainValidation.validateFullDomain("my-comp.example.co.uk").valid());
  }

  @Test
  void hyphenatedEdgesAreRefusedInEveryLabel() {
    assertFalse(SubdomainValidation.validateFullDomain("-example.com").valid());
    assertFalse(SubdomainValidation.validateFullDomain("example-.com").valid());
    assertFalse(SubdomainValidation.validateFullDomain("a.-b.com").valid());
  }

  // -------------------------------------------------------------- git urls

  @Test
  void onlyHttpsGithubReposAreAccepted() {
    assertTrue(SubdomainValidation.validateGitUrl("https://github.com/org/repo.git").valid());

    assertFalse(SubdomainValidation.validateGitUrl("http://github.com/org/repo").valid(),
        "plain http would send credentials in the clear");
    assertFalse(SubdomainValidation.validateGitUrl("git://github.com/org/repo").valid());
    assertFalse(SubdomainValidation.validateGitUrl("https://gitlab.com/org/repo").valid());
    assertFalse(SubdomainValidation.validateGitUrl("https://github.com").valid(),
        "no repository path");
    assertFalse(SubdomainValidation.validateGitUrl("  ").valid());
  }
}
