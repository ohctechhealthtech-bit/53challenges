package com.fiftythree.challenges.plesk;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.nio.file.attribute.PosixFilePermission;
import java.nio.file.attribute.PosixFilePermissions;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Stores files that must never be served, replacing Base44's
 * {@code UploadPrivateFile}.
 *
 * <p>Only one thing is kept here today: the TLS private key for the default
 * subdomain certificate. That shapes every decision in this class.
 *
 * <ul>
 *   <li>Files are written <b>owner-read-only</b> ({@code 0600}), and the
 *       directory {@code 0700}. A private key readable by the web server's
 *       group is a private key that can be served.
 *   <li>The directory must be configured explicitly. There is no default,
 *       because a default would eventually be somewhere inside a document
 *       root and nobody would notice until the key was downloadable.
 *   <li>Nothing here ever logs or returns file <em>content</em>, and the
 *       stored path is treated as sensitive by callers — it is a location, but
 *       it is a location the client has no business knowing.
 * </ul>
 */
@Component
public class PrivateFileStore {

  private static final Logger log = LoggerFactory.getLogger(PrivateFileStore.class);

  private static final Set<PosixFilePermission> FILE_ONLY_OWNER =
      PosixFilePermissions.fromString("rw-------");

  private static final Set<PosixFilePermission> DIRECTORY_ONLY_OWNER =
      PosixFilePermissions.fromString("rwx------");

  private final String directory;

  public PrivateFileStore(@Value("${app.private-files.directory:}") String directory) {
    this.directory = directory == null ? "" : directory.trim();
  }

  public boolean isConfigured() {
    return !directory.isEmpty();
  }

  /** Raised when a file could not be stored. Carries no content. */
  public static class StorageException extends RuntimeException {
    public StorageException(String message) {
      super(message);
    }
  }

  /**
   * Writes content to a new private file and returns its path.
   *
   * @param prefix a short name for the file, for an operator reading the
   *     directory later; it is not trusted for path building
   */
  public String write(String prefix, String content) {
    if (!isConfigured()) {
      throw new StorageException(
          "Private file storage is not configured. Set PRIVATE_FILES_DIR.");
    }
    try {
      Path root = Path.of(directory);
      if (!Files.exists(root)) {
        Files.createDirectories(root);
      }
      trySetPermissions(root, DIRECTORY_ONLY_OWNER);

      // The caller's prefix is reduced to safe characters rather than used as
      // given: it reaches here from a request body, and a name containing
      // "../" would otherwise place a private key outside this directory.
      String safe = prefix.replaceAll("[^a-zA-Z0-9-]", "");
      if (safe.isEmpty()) {
        safe = "file";
      }
      Path file = root.resolve(safe + "-"
          + UUID.randomUUID().toString().replace("-", "").substring(0, 16) + ".pem");

      Files.writeString(file, content, StandardCharsets.UTF_8,
          StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE);
      trySetPermissions(file, FILE_ONLY_OWNER);

      return file.toAbsolutePath().toString();
    } catch (IOException e) {
      // The message, never the content.
      log.error("Could not write a private file: {}", e.toString());
      throw new StorageException("Could not store the file");
    }
  }

  /** Reads a stored file back. */
  public String read(String path) {
    try {
      return Files.readString(Path.of(path), StandardCharsets.UTF_8);
    } catch (IOException e) {
      log.error("Could not read a private file: {}", e.toString());
      throw new StorageException("Could not read the stored file");
    }
  }

  /**
   * Applies POSIX permissions where the filesystem supports them.
   *
   * <p>Windows does not, and that is tolerated because production is Linux —
   * but it is logged rather than ignored, so a private key sitting with
   * default permissions is at least visible in the log.
   */
  private void trySetPermissions(Path path, Set<PosixFilePermission> permissions) {
    try {
      Files.setPosixFilePermissions(path, permissions);
    } catch (UnsupportedOperationException e) {
      log.warn("Filesystem does not support POSIX permissions; {} keeps its "
          + "default access rights", path);
    } catch (IOException e) {
      log.error("Could not restrict permissions on {}: {}", path, e.toString());
    }
  }
}
