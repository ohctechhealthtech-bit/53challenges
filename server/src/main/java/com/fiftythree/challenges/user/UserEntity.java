package com.fiftythree.challenges.user;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * The app's own User record. It carries the role only — credentials live in the
 * upstream Challenge API, which is why login is delegated rather than checked
 * here. Maps to the `user` table from migration/sql/schema.sql.
 */
@Entity
@Table(name = "user")
public class UserEntity {

  @Id
  @Column(name = "id", length = 24, nullable = false)
  private String id;

  @Column(name = "role", length = 64)
  private String role;

  /**
   * Base44's User rows carry the account email in a system column. Kept
   * nullable so a row without one does not break the lookup.
   */
  @Column(name = "email", length = 255)
  private String email;

  public String getId() {
    return id;
  }

  public void setId(String id) {
    this.id = id;
  }

  public String getRole() {
    return role;
  }

  public void setRole(String role) {
    this.role = role;
  }

  public String getEmail() {
    return email;
  }

  public void setEmail(String email) {
    this.email = email;
  }
}
