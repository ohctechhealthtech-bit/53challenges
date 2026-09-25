package com.fiftythree.challenges.vote;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * A single vote. Maps the {@code vote} table, 67 rows at import.
 *
 * <p>No JSON serialisation annotations: unlike ChallengeDomain, votes are never
 * returned to a client as records — only as aggregates — so the wire shape is
 * defined by the controller, not by this class.
 */
@Entity
@Table(name = "vote")
public class VoteEntity {

  @Id
  @Column(name = "id", length = 24, nullable = false)
  private String id;

  @Column(name = "entry_id", length = 255, nullable = false)
  private String entryId;

  @Column(name = "challenge_id", length = 255)
  private String challengeId;

  @Column(name = "user_id", length = 255)
  private String userId;

  @Column(name = "user_email", length = 255, nullable = false)
  private String userEmail;

  @Column(name = "voter_verified")
  private Boolean voterVerified;

  /**
   * Nullable, and null is the normal case — it means "not excluded". Every
   * query has to spell that out; see VoteRepository.
   */
  @Column(name = "excluded")
  private Boolean excluded;

  @Column(name = "excluded_reason")
  private String excludedReason;

  @Column(name = "excluded_at")
  private Instant excludedAt;

  @Column(name = "excluded_by", length = 255)
  private String excludedBy;

  @Column(name = "flag_type", length = 255)
  private String flagType;

  @Column(name = "created_date")
  private Instant createdDate;

  @Column(name = "updated_date")
  private Instant updatedDate;

  @Column(name = "created_by_id", length = 64)
  private String createdById;

  @Column(name = "is_sample")
  private Boolean isSample;

  public String getId() { return id; }
  public void setId(String id) { this.id = id; }

  public String getEntryId() { return entryId; }
  public void setEntryId(String entryId) { this.entryId = entryId; }

  public String getChallengeId() { return challengeId; }
  public void setChallengeId(String challengeId) { this.challengeId = challengeId; }

  public String getUserId() { return userId; }
  public void setUserId(String userId) { this.userId = userId; }

  public String getUserEmail() { return userEmail; }
  public void setUserEmail(String userEmail) { this.userEmail = userEmail; }

  public Boolean getVoterVerified() { return voterVerified; }
  public void setVoterVerified(Boolean voterVerified) { this.voterVerified = voterVerified; }

  public Boolean getExcluded() { return excluded; }
  public void setExcluded(Boolean excluded) { this.excluded = excluded; }

  public String getExcludedReason() { return excludedReason; }
  public void setExcludedReason(String excludedReason) { this.excludedReason = excludedReason; }

  public Instant getExcludedAt() { return excludedAt; }
  public void setExcludedAt(Instant excludedAt) { this.excludedAt = excludedAt; }

  public String getExcludedBy() { return excludedBy; }
  public void setExcludedBy(String excludedBy) { this.excludedBy = excludedBy; }

  public String getFlagType() { return flagType; }
  public void setFlagType(String flagType) { this.flagType = flagType; }

  public Instant getCreatedDate() { return createdDate; }
  public void setCreatedDate(Instant createdDate) { this.createdDate = createdDate; }

  public Instant getUpdatedDate() { return updatedDate; }
  public void setUpdatedDate(Instant updatedDate) { this.updatedDate = updatedDate; }

  public String getCreatedById() { return createdById; }
  public void setCreatedById(String createdById) { this.createdById = createdById; }

  public Boolean getIsSample() { return isSample; }
  public void setIsSample(Boolean isSample) { this.isSample = isSample; }
}
