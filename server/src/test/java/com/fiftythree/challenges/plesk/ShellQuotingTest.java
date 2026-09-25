package com.fiftythree.challenges.plesk;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

/**
 * These commands run as a real user on the live hosting box, built by string
 * concatenation, with one value coming from a form field. The original
 * interpolated that field directly and never validated it on the path that
 * {@code createChallengeSubdomain} uses — so a semicolon in a git URL was a
 * command.
 *
 * <p>Every test here is an injection attempt that must not reach a shell.
 */
class ShellQuotingTest {

  private PleskClient plesk;
  private PleskShellOps shell;

  @BeforeEach
  void setUp() {
    plesk = mock(PleskClient.class);
    when(plesk.isConfigured()).thenReturn(true);
    when(plesk.baseDomain()).thenReturn("53chal.com");
    when(plesk.lookupDomain(anyString()))
        .thenReturn(Optional.of(new PleskClient.Domain("dom-1", "/var/www/vhosts/x/httpdocs")));
    // Shell enable and restore both succeed, so the work runs.
    when(plesk.cli(anyString(), any()))
        .thenReturn(new PleskClient.CliResult(true, 0, "", "", null));
    // Plesk echoes the marker back on stdout, which is how exec tells a
    // command that ran from one that merely returned HTTP 200.
    var stdout = new com.fasterxml.jackson.databind.ObjectMapper().createObjectNode();
    stdout.put("stdout", "CLONED INSTALLED");
    when(plesk.post(anyString(), any()))
        .thenReturn(new PleskClient.Result(true, 200, stdout, null));

    shell = new PleskShellOps(plesk, "http://127.0.0.1:8081", "https://base44.app");
  }

  @Test
  void aGitUrlWithShellMetacharactersNeverReachesTheServer() {
    // The original would have run 'rm -rf /' here.
    PleskShellOps.ShellResult result = shell.cloneGit(
        "https://github.com/org/repo.git; rm -rf /", "/var/www/httpdocs", "dom-1");

    assertFalse(result.success());
    verify(plesk, never()).post(anyString(), any());
  }

  @Test
  void aNonGithubUrlIsRefused() {
    assertFalse(shell.cloneGit(
        "https://evil.example.com/repo.git", "/var/www/httpdocs", "dom-1").success());
    assertFalse(shell.cloneGit(
        "file:///etc/passwd", "/var/www/httpdocs", "dom-1").success());
    verify(plesk, never()).post(anyString(), any());
  }

  @Test
  void anEmptyDocumentRootIsRefusedBeforeAnyDeletion() {
    // The command starts with "rm -rf <root>/*". An empty root makes that
    // "rm -rf /*" — the single most destructive thing in this codebase.
    PleskShellOps.ShellResult result =
        shell.cloneGit("https://github.com/org/repo.git", "", "dom-1");

    assertFalse(result.success());
    assertTrue(result.error().contains("document root"), result.error());
    verify(plesk, never()).post(anyString(), any());
  }

  @Test
  void aValidUrlIsSingleQuotedInTheCommand() {
    shell.cloneGit("https://github.com/org/repo.git", "/var/www/httpdocs", "dom-1");

    String command = capturedCommand();
    assertTrue(command.contains("'https://github.com/org/repo.git'"),
        "the URL must be quoted: " + command);
    assertTrue(command.contains("'/var/www/httpdocs'"),
        "the document root must be quoted: " + command);
  }

  @Test
  void theShellIsAlwaysRestoredEvenWhenTheWorkFails() {
    // A subscription left with /bin/bash is the failure this pattern exists
    // to prevent, and the exec failing is exactly when it would happen.
    when(plesk.post(anyString(), any()))
        .thenReturn(new PleskClient.Result(false, 500, null, "exec blew up"));

    shell.cloneGit("https://github.com/org/repo.git", "/var/www/httpdocs", "dom-1");

    ArgumentCaptor<List<String>> params = captor();
    verify(plesk, org.mockito.Mockito.atLeast(2)).cli(org.mockito.ArgumentMatchers.eq("subscription"),
        params.capture());
    assertTrue(params.getAllValues().stream()
            .anyMatch(p -> p.contains("/bin/false")),
        "the shell must be restored: " + params.getAllValues());
  }

  @Test
  void aCertificateInstallRemovesTheKeyFromTmpWhateverHappens() {
    shell.installCertificate("singing.53chal.com",
        "-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----",
        "-----BEGIN PRIVATE KEY-----\ndef\n-----END PRIVATE KEY-----",
        "dom-1");

    String command = capturedCommand();
    assertTrue(command.contains("rm -f /tmp/"),
        "the temporary key must be deleted: " + command);
    assertTrue(command.contains("chmod 600"),
        "the key must not be world-readable even briefly: " + command);
    // The command is one string with the rm after a semicolon, so it runs
    // whether the install succeeded or not.
    assertTrue(command.indexOf("rm -f") > command.indexOf("certificate --create"));
  }

  @Test
  void aKeyBundledInsideTheCertificatePemIsAccepted() {
    // Several authorities issue one file containing both, and people upload
    // it twice rather than splitting it.
    String combined = "-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----\n"
        + "-----BEGIN PRIVATE KEY-----\ndef\n-----END PRIVATE KEY-----";

    PleskShellOps.ShellResult result =
        shell.installCertificate("singing.53chal.com", combined, "", "dom-1");

    assertTrue(result.success(), result.error());
  }

  @Test
  void aCertificateWithNoKeyAnywhereIsRefused() {
    PleskShellOps.ShellResult result = shell.installCertificate("singing.53chal.com",
        "-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----", "", "dom-1");

    assertFalse(result.success());
    assertTrue(result.error().contains("private key"), result.error());
    verify(plesk, never()).post(anyString(), any());
  }

  @SuppressWarnings("unchecked")
  private String capturedCommand() {
    ArgumentCaptor<Map<String, Object>> body = ArgumentCaptor.forClass(
        (Class<Map<String, Object>>) (Class<?>) Map.class);
    verify(plesk).post(anyString(), body.capture());
    List<String> argv = (List<String>) body.getValue().get("command");
    return argv.get(argv.size() - 1);
  }

  @SuppressWarnings("unchecked")
  private static ArgumentCaptor<List<String>> captor() {
    return ArgumentCaptor.forClass((Class<List<String>>) (Class<?>) List.class);
  }
}
