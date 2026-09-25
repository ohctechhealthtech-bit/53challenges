package com.fiftythree.challenges.domain;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * A challenge's own hostname — {@code voice.53challenges.com} and the rest.
 *
 * <p>Maps the {@code challenge_domain} table from migration/sql/schema.sql, 51
 * rows at import. Every field the Base44 entity declared is mapped, because the
 * admin table at /domain-management renders the whole record: dropping a column
 * here would blank a column there.
 *
 * <p>Serialised snake_case to match exactly what the Base44 function returned,
 * so the React client needs no change when this endpoint takes over.
 */
@Entity
@Table(name = "challenge_domain")
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ChallengeDomainEntity {

  @Id
  @Column(name = "id", length = 24, nullable = false)
  private String id;

  @Column(name = "challenge_id", length = 255)
  private String challengeId;

  @Column(name = "challenge_name", length = 255)
  private String challengeName;

  @Column(name = "domain_type", length = 64)
  private String domainType;

  @Column(name = "slug", length = 255)
  private String slug;

  @Column(name = "base_domain", length = 255)
  private String baseDomain;

  @Column(name = "full_domain", length = 255)
  private String fullDomain;

  @Column(name = "full_url", length = 1024)
  private String fullUrl;

  @Column(name = "parent_domain", length = 255)
  private String parentDomain;

  @Column(name = "status", length = 64)
  private String status;

  @Column(name = "hosting_mode", length = 64)
  private String hostingMode;

  @Column(name = "git_location", length = 255)
  private String gitLocation;

  @Column(name = "git_deployment_status", length = 64)
  private String gitDeploymentStatus;

  @Column(name = "ssl_cert_url", length = 1024)
  private String sslCertUrl;

  @Column(name = "ssl_key_url", length = 1024)
  private String sslKeyUrl;

  @Column(name = "ssl_status", length = 64)
  private String sslStatus;

  @Column(name = "ssl_source", length = 64)
  private String sslSource;

  @Column(name = "plesk_site_id", length = 255)
  private String pleskSiteId;

  @Column(name = "document_root", length = 255)
  private String documentRoot;

  @Column(name = "nginx_status", length = 64)
  private String nginxStatus;

  @Column(name = "error_message")
  private String errorMessage;

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

  public String getChallengeId() { return challengeId; }
  public void setChallengeId(String challengeId) { this.challengeId = challengeId; }

  public String getChallengeName() { return challengeName; }
  public void setChallengeName(String challengeName) { this.challengeName = challengeName; }

  public String getDomainType() { return domainType; }
  public void setDomainType(String domainType) { this.domainType = domainType; }

  public String getSlug() { return slug; }
  public void setSlug(String slug) { this.slug = slug; }

  public String getBaseDomain() { return baseDomain; }
  public void setBaseDomain(String baseDomain) { this.baseDomain = baseDomain; }

  public String getFullDomain() { return fullDomain; }
  public void setFullDomain(String fullDomain) { this.fullDomain = fullDomain; }

  public String getFullUrl() { return fullUrl; }
  public void setFullUrl(String fullUrl) { this.fullUrl = fullUrl; }

  public String getParentDomain() { return parentDomain; }
  public void setParentDomain(String parentDomain) { this.parentDomain = parentDomain; }

  public String getStatus() { return status; }
  public void setStatus(String status) { this.status = status; }

  public String getHostingMode() { return hostingMode; }
  public void setHostingMode(String hostingMode) { this.hostingMode = hostingMode; }

  public String getGitLocation() { return gitLocation; }
  public void setGitLocation(String gitLocation) { this.gitLocation = gitLocation; }

  public String getGitDeploymentStatus() { return gitDeploymentStatus; }
  public void setGitDeploymentStatus(String v) { this.gitDeploymentStatus = v; }

  public String getSslCertUrl() { return sslCertUrl; }
  public void setSslCertUrl(String sslCertUrl) { this.sslCertUrl = sslCertUrl; }

  public String getSslKeyUrl() { return sslKeyUrl; }
  public void setSslKeyUrl(String sslKeyUrl) { this.sslKeyUrl = sslKeyUrl; }

  public String getSslStatus() { return sslStatus; }
  public void setSslStatus(String sslStatus) { this.sslStatus = sslStatus; }

  public String getSslSource() { return sslSource; }
  public void setSslSource(String sslSource) { this.sslSource = sslSource; }

  public String getPleskSiteId() { return pleskSiteId; }
  public void setPleskSiteId(String pleskSiteId) { this.pleskSiteId = pleskSiteId; }

  public String getDocumentRoot() { return documentRoot; }
  public void setDocumentRoot(String documentRoot) { this.documentRoot = documentRoot; }

  public String getNginxStatus() { return nginxStatus; }
  public void setNginxStatus(String nginxStatus) { this.nginxStatus = nginxStatus; }

  public String getErrorMessage() { return errorMessage; }
  public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }

  public Instant getCreatedDate() { return createdDate; }
  public void setCreatedDate(Instant createdDate) { this.createdDate = createdDate; }

  public Instant getUpdatedDate() { return updatedDate; }
  public void setUpdatedDate(Instant updatedDate) { this.updatedDate = updatedDate; }

  public String getCreatedById() { return createdById; }
  public void setCreatedById(String createdById) { this.createdById = createdById; }

  public Boolean getIsSample() { return isSample; }
  public void setIsSample(Boolean isSample) { this.isSample = isSample; }
}
