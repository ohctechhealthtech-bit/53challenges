package com.fiftythree.challenges.judging;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * A judge's conflict-of-interest declaration for one category.
 *
 * <p>Hand-written and outside the generated {@code entity} package, which
 * {@code migration/generate-entities.cjs} overwrites.
 *
 * <p>These lived in {@code localStorage}. That made them a per-browser
 * convenience rather than a record: clearing site data erased the
 * declaration, and nothing on the server could show a judge had ever made
 * one. A declaration exists to be relied on afterwards, so it belongs
 * somewhere it survives the browser.
 */
@Entity
@Table(name = "judge_attestation")
public class JudgeAttestationEntity {

  @Id
  @Column(name = "id", length = 24, nullable = false)
  private String id;

  @Column(name = "judge_email", length = 255, nullable = false)
  private String judgeEmail;

  /**
   * The category, normalised.
   *
   * <p>Categories arrive spelled several ways — "visual-arts", "visual_arts",
   * "Visual Arts" — and one declaration should cover the category however it
   * was written, so the normalising happens before the value is stored.
   */
  @Column(name = "category", length = 128, nullable = false)
  private String category;

  /** When the judge declared. The fact; created_date is bookkeeping. */
  @Column(name = "attested_at", nullable = false)
  private Instant attestedAt;

  @Column(name = "created_date")
  private Instant createdDate;

  @Column(name = "updated_date")
  private Instant updatedDate;

  @Column(name = "created_by_id", length = 64)
  private String createdById;

  @Column(name = "is_sample", nullable = false)
  private Boolean isSample = false;

  public String getId() { return id; }

  public void setId(String id) { this.id = id; }

  public String getJudgeEmail() { return judgeEmail; }

  public void setJudgeEmail(String judgeEmail) { this.judgeEmail = judgeEmail; }

  public String getCategory() { return category; }

  public void setCategory(String category) { this.category = category; }

  public Instant getAttestedAt() { return attestedAt; }

  public void setAttestedAt(Instant attestedAt) { this.attestedAt = attestedAt; }

  public Instant getCreatedDate() { return createdDate; }

  public void setCreatedDate(Instant createdDate) { this.createdDate = createdDate; }

  public Instant getUpdatedDate() { return updatedDate; }

  public void setUpdatedDate(Instant updatedDate) { this.updatedDate = updatedDate; }

  public String getCreatedById() { return createdById; }

  public void setCreatedById(String createdById) { this.createdById = createdById; }

  public Boolean getIsSample() { return isSample; }

  public void setIsSample(Boolean isSample) { this.isSample = isSample; }
}
