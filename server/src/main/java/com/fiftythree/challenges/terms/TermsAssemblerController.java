package com.fiftythree.challenges.terms;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiftythree.challenges.compliance.ComplianceAuditService;
import com.fiftythree.challenges.compliance.FactsAssembler;
import com.fiftythree.challenges.entity.ApprovedClauseEntity;
import com.fiftythree.challenges.entity.TermsDocumentEntity;
import com.fiftythree.challenges.security.CallerResolver;
import com.fiftythree.challenges.support.JsonColumn;
import com.fiftythree.challenges.user.UserRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * The Java replacement for {@code termsAssembler}: the clause library and the
 * terms documents assembled from it.
 *
 * <ul>
 *   <li>{@code list_clauses} — the library, annotated signed/expired (any caller)
 *   <li>{@code create_clause} / {@code sign_clause} — manage the library (admin)
 *   <li>{@code assemble} — build a draft document for a challenge (admin)
 *   <li>{@code list_documents} / {@code get_document} — read them (any caller)
 *   <li>{@code review_document} / {@code publish_document} — advance one (admin)
 * </ul>
 *
 * <p>A clause is created <b>unsigned</b> and is unusable until an admin records
 * a named reviewer, a date and a reference. Signing is a separate action from
 * creating for exactly that reason: writing a clause and attesting that a
 * lawyer approved it are different claims, and the assembler only trusts the
 * second one.
 *
 * <p>A published document is immutable. Re-publishing supersedes rather than
 * edits, because entrants accepted a specific document and the record of what
 * they accepted has to survive.
 */
@RestController
public class TermsAssemblerController {

  private static final Logger log = LoggerFactory.getLogger(TermsAssemblerController.class);

  private static final List<String> PUBLISHABLE_STATUSES = List.of("draft", "reviewed");

  private final TermsAssemblerService assembler;
  private final FactsAssembler facts;
  private final ApprovedClauseQueryRepository clauses;
  private final TermsDocumentsQueryRepository documents;
  private final ComplianceAuditService audit;
  private final CallerResolver caller;
  private final UserRepository users;
  private final JsonColumn json;
  private final ObjectMapper mapper;

  public TermsAssemblerController(
      TermsAssemblerService assembler,
      FactsAssembler facts,
      ApprovedClauseQueryRepository clauses,
      TermsDocumentsQueryRepository documents,
      ComplianceAuditService audit,
      CallerResolver caller,
      UserRepository users,
      JsonColumn json,
      ObjectMapper mapper) {
    this.assembler = assembler;
    this.facts = facts;
    this.clauses = clauses;
    this.documents = documents;
    this.audit = audit;
    this.caller = caller;
    this.users = users;
    this.json = json;
    this.mapper = mapper;
  }

  @PostMapping("/api/apps/{appId}/functions/termsAssembler")
  public ResponseEntity<?> handle(@RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> request = body == null ? Map.of() : body;
    String sessionToken = str(request.get("session_token"));
    String email = caller.email(sessionToken);
    if (email == null) {
      return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
    }
    boolean isAdmin = caller.isAdmin(sessionToken);
    String actorId = users.findIdByEmail(email).orElse("");
    String action = str(request.get("action"));

    try {
      return switch (action == null ? "" : action) {
        case "list_clauses" -> listClauses();
        case "list_documents" -> listDocuments(request);
        case "get_document" -> getDocument(request);
        case "create_clause" -> admin(isAdmin, () -> createClause(request, actorId, email));
        case "sign_clause" -> admin(isAdmin, () -> signClause(request, actorId, email));
        case "assemble" -> admin(isAdmin, () -> assemble(request, actorId, email));
        case "review_document" -> admin(isAdmin, () -> reviewDocument(request, actorId, email));
        case "publish_document" -> admin(isAdmin, () -> publishDocument(request, actorId, email));
        default -> ResponseEntity.status(400).body(Map.of("error", "Unknown action"));
      };
    } catch (Exception e) {
      log.error("termsAssembler action '{}' failed", action, e);
      return ResponseEntity.status(500).body(Map.of(
          "error", e.getMessage() == null ? "Terms assembler request failed" : e.getMessage()));
    }
  }

  private ResponseEntity<?> admin(
      boolean isAdmin, java.util.function.Supplier<ResponseEntity<?>> handler) {
    return isAdmin ? handler.get() : ResponseEntity.status(403).body(Map.of("error", "Admin only"));
  }

  // ------------------------------------------------------------- clauses

  private ResponseEntity<?> listClauses() {
    List<Map<String, Object>> out = new ArrayList<>();
    for (ApprovedClauseEntity c : clauses.findCurrent()) {
      Map<String, Object> row = clauseJson(c);
      // Annotated rather than filtered: the library screen shows unsigned and
      // expired clauses precisely so an admin can see what needs attention.
      row.put("signed", assembler.isSigned(c));
      row.put("expired", assembler.isExpired(c));
      out.add(row);
    }
    return ResponseEntity.ok(Map.of("clauses", out));
  }

  private ResponseEntity<?> createClause(
      Map<String, Object> request, String actorId, String email) {

    String identifier = str(request.get("identifier"));
    String title = str(request.get("title"));
    String clauseBody = str(request.get("body"));
    String category = str(request.get("category"));
    if (identifier == null || title == null || clauseBody == null || category == null) {
      return ResponseEntity.status(400).body(
          Map.of("error", "identifier, title, body, category required"));
    }
    if (!clauses.findCurrentByIdentifier(identifier).isEmpty()) {
      return ResponseEntity.status(409).body(Map.of("error", "Clause identifier already exists"));
    }

    Instant now = Instant.now();
    ApprovedClauseEntity clause = new ApprovedClauseEntity();
    clause.setId(newId());
    clause.setIdentifier(identifier);
    clause.setTitle(title);
    clause.setBody(clauseBody);
    clause.setCategory(category);
    clause.setApplicableJurisdictions(writeList(request.get("applicable_jurisdictions")));
    clause.setInclusionRule(writeObject(request.get("inclusion_rule")));
    clause.setRequiredCombinations(writeList(request.get("required_combinations")));
    clause.setProhibitedCombinations(writeList(request.get("prohibited_combinations")));
    clause.setMandatory(!Boolean.FALSE.equals(request.get("mandatory")));
    clause.setEffectiveFrom(instant(request.get("effective_from"), now));
    clause.setRetirementDate(instant(request.get("retirement_date"), null));
    clause.setVersion(1d);
    clause.setRequiredVariables(writeList(request.get("required_variables")));
    clause.setModificationRequiresReapproval(
        !Boolean.FALSE.equals(request.get("modification_requires_reapproval")));
    // Deliberately empty: a clause is born unsigned, and only sign_clause can
    // change that.
    clause.setLegalSignoff(writeObject(null));
    clause.setIsCurrent(true);
    clause.setCreatedDate(now);
    clause.setUpdatedDate(now);
    clause.setIsSample(false);
    clauses.save(clause);

    audit.event("rule_version_created", "", actorId, email,
        "ApprovedClause '" + identifier + "' created (unsigned draft). Category: "
            + category + ".");

    return ResponseEntity.ok(Map.of("clause", clauseJson(clause)));
  }

  private ResponseEntity<?> signClause(
      Map<String, Object> request, String actorId, String email) {

    String clauseId = str(request.get("clause_id"));
    String reviewer = str(request.get("reviewer"));
    String date = str(request.get("date"));
    String reference = str(request.get("reference"));
    if (clauseId == null) {
      return ResponseEntity.status(400).body(Map.of("error", "clause_id required"));
    }
    // All three, because the assembler treats any one of them missing as
    // unsigned — a partial sign-off would look signed here and fail silently
    // at assembly time.
    if (reviewer == null || date == null || reference == null) {
      return ResponseEntity.status(400).body(
          Map.of("error", "reviewer, date, reference all required"));
    }
    Optional<ApprovedClauseEntity> found = clauses.findById(clauseId);
    if (found.isEmpty()) {
      return ResponseEntity.status(404).body(Map.of("error", "Clause not found"));
    }

    ApprovedClauseEntity clause = found.get();
    clause.setLegalSignoff(writeObject(Map.of(
        "reviewer", reviewer, "date", date, "reference", reference)));
    clause.setUpdatedDate(Instant.now());
    clauses.save(clause);

    audit.event("rule_signed", "", actorId, email,
        "ApprovedClause " + clauseId + " signed by " + reviewer + " (ref: " + reference + ").");

    return ResponseEntity.ok(Map.of("ok", true, "clause_id", clauseId, "signed", true));
  }

  // ----------------------------------------------------------- documents

  private ResponseEntity<?> assemble(Map<String, Object> request, String actorId, String email) {
    String challengeId = str(request.get("challenge_id"));
    if (challengeId == null) {
      return ResponseEntity.status(400).body(Map.of("error", "challenge_id required"));
    }

    Map<String, Object> overrides = request.get("facts_override") instanceof Map<?, ?> supplied
        ? castMap(supplied)
        : Map.of();

    TermsAssemblerService.Result result = assembler.assemble(
        challengeId, facts.assemble(challengeId, overrides), actorId, email);

    if (result.failed()) {
      // 422, not 400: the request was well formed and the refusal is about the
      // challenge's state, which is what the admin screen distinguishes on.
      return ResponseEntity.status(422).body(Map.of(
          "errors", TermsAssemblerService.toMaps(result.errors()),
          "warnings", result.warnings()));
    }

    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("document", documentJson(result.document()));
    payload.put("clauses_used", result.clausesUsed().size());
    payload.put("classification", result.classification());
    payload.put("clauses", result.clausesUsed().stream().map(c -> {
      Map<String, Object> summary = new LinkedHashMap<>();
      summary.put("id", c.getId());
      summary.put("identifier", c.getIdentifier());
      summary.put("title", c.getTitle());
      summary.put("category", c.getCategory());
      return summary;
    }).toList());
    payload.put("errors", List.of());
    payload.put("warnings", result.warnings());

    return ResponseEntity.ok(Map.of("result", payload));
  }

  private ResponseEntity<?> listDocuments(Map<String, Object> request) {
    String challengeId = str(request.get("challenge_id"));
    if (challengeId == null) {
      return ResponseEntity.status(400).body(Map.of("error", "challenge_id required"));
    }
    return ResponseEntity.ok(Map.of("documents",
        documents.findByChallenge(challengeId).stream().map(this::documentJson).toList()));
  }

  private ResponseEntity<?> getDocument(Map<String, Object> request) {
    String documentId = str(request.get("document_id"));
    if (documentId == null) {
      return ResponseEntity.status(400).body(Map.of("error", "document_id required"));
    }
    return documents.findById(documentId)
        .<ResponseEntity<?>>map(doc -> ResponseEntity.ok(Map.of("document", documentJson(doc))))
        .orElseGet(() -> ResponseEntity.status(404).body(Map.of("error", "Document not found")));
  }

  private ResponseEntity<?> reviewDocument(
      Map<String, Object> request, String actorId, String email) {

    String documentId = str(request.get("document_id"));
    if (documentId == null) {
      return ResponseEntity.status(400).body(Map.of("error", "document_id required"));
    }
    Optional<TermsDocumentEntity> found = documents.findById(documentId);
    if (found.isEmpty()) {
      return ResponseEntity.status(404).body(Map.of("error", "Document not found"));
    }
    TermsDocumentEntity doc = found.get();
    if (!"draft".equals(doc.getStatus())) {
      return ResponseEntity.status(409).body(Map.of("error",
          "Document must be in draft status to review (current: " + doc.getStatus() + ")"));
    }

    doc.setStatus("reviewed");
    doc.setUpdatedDate(Instant.now());
    documents.save(doc);

    audit.event("assessment_run", doc.getChallengeId(), actorId, email,
        "TermsDocument " + documentId + " marked as reviewed.");

    return ResponseEntity.ok(Map.of("ok", true, "document_id", documentId, "status", "reviewed"));
  }

  private ResponseEntity<?> publishDocument(
      Map<String, Object> request, String actorId, String email) {

    String documentId = str(request.get("document_id"));
    if (documentId == null) {
      return ResponseEntity.status(400).body(Map.of("error", "document_id required"));
    }
    Optional<TermsDocumentEntity> found = documents.findById(documentId);
    if (found.isEmpty()) {
      return ResponseEntity.status(404).body(Map.of("error", "Document not found"));
    }
    TermsDocumentEntity doc = found.get();

    if ("published".equals(doc.getStatus())) {
      return ResponseEntity.status(409).body(
          Map.of("error", "Document is already published (immutable)"));
    }
    if ("superseded".equals(doc.getStatus())) {
      return ResponseEntity.status(409).body(
          Map.of("error", "Cannot publish a superseded document"));
    }
    if (!PUBLISHABLE_STATUSES.contains(doc.getStatus())) {
      return ResponseEntity.status(409).body(Map.of("error",
          "Cannot publish document in status '" + doc.getStatus() + "'"));
    }

    // Only one document can be the live terms for a challenge, so publishing
    // retires whatever was live before it.
    List<TermsDocumentEntity> previous = documents.findPublished(doc.getChallengeId());
    int superseded = 0;
    for (TermsDocumentEntity prev : previous) {
      if (prev.getId().equals(documentId)) {
        continue;
      }
      assembler.supersede(prev, documentId,
          "Superseded by new publication (document " + documentId + ").", actorId, email);
      superseded++;
    }

    Instant now = Instant.now();
    doc.setStatus("published");
    doc.setPublishedAt(now);
    doc.setUpdatedDate(now);
    documents.save(doc);

    audit.event("assessment_run", doc.getChallengeId(), actorId, email,
        "TermsDocument " + documentId + " published. " + superseded
            + " prior document(s) superseded.");

    return ResponseEntity.ok(Map.of("ok", true, "document_id", documentId, "status", "published"));
  }

  // -------------------------------------------------------------- shapes

  private Map<String, Object> clauseJson(ApprovedClauseEntity c) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", c.getId());
    out.put("identifier", c.getIdentifier());
    out.put("title", c.getTitle());
    out.put("body", c.getBody());
    out.put("category", c.getCategory());
    out.put("applicable_jurisdictions", json.stringList(c.getApplicableJurisdictions()));
    out.put("inclusion_rule", node(c.getInclusionRule()));
    out.put("required_combinations", json.stringList(c.getRequiredCombinations()));
    out.put("prohibited_combinations", json.stringList(c.getProhibitedCombinations()));
    out.put("mandatory", c.getMandatory());
    out.put("effective_from", iso(c.getEffectiveFrom()));
    out.put("retirement_date", iso(c.getRetirementDate()));
    out.put("version", c.getVersion());
    out.put("required_variables", json.stringList(c.getRequiredVariables()));
    out.put("modification_requires_reapproval", c.getModificationRequiresReapproval());
    out.put("legal_signoff", node(c.getLegalSignoff()));
    out.put("is_current", c.getIsCurrent());
    out.put("created_date", iso(c.getCreatedDate()));
    out.put("updated_date", iso(c.getUpdatedDate()));
    return out;
  }

  private Map<String, Object> documentJson(TermsDocumentEntity doc) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", doc.getId());
    out.put("challenge_id", doc.getChallengeId());
    out.put("clause_versions_used", json.stringList(doc.getClauseVersionsUsed()));
    out.put("merged_output", doc.getMergedOutput());
    out.put("status", doc.getStatus());
    out.put("published_at", iso(doc.getPublishedAt()));
    out.put("superseded_by", doc.getSupersededBy());
    out.put("change_note", doc.getChangeNote());
    out.put("config_snapshot", node(doc.getConfigSnapshot()));
    out.put("created_date", iso(doc.getCreatedDate()));
    out.put("updated_date", iso(doc.getUpdatedDate()));
    return out;
  }

  // ------------------------------------------------------------- helpers

  private JsonNode node(String raw) {
    if (raw == null || raw.isBlank()) {
      return mapper.createObjectNode();
    }
    try {
      return mapper.readTree(raw);
    } catch (Exception e) {
      return mapper.createObjectNode();
    }
  }

  private String writeList(Object value) {
    return write(value instanceof List<?> list ? list : List.of());
  }

  private String writeObject(Object value) {
    return write(value instanceof Map<?, ?> map ? map : Map.of());
  }

  private String write(Object value) {
    try {
      return mapper.writeValueAsString(value);
    } catch (Exception e) {
      throw new IllegalStateException("Could not serialise a clause column", e);
    }
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> castMap(Map<?, ?> supplied) {
    return (Map<String, Object>) supplied;
  }

  /**
   * Parses a supplied timestamp, falling back rather than failing. An
   * unparseable retirement date reads as "no retirement date", which keeps the
   * clause usable — the alternative, silently retiring it, would remove a
   * clause from every future document over a typo.
   */
  private static Instant instant(Object value, Instant fallback) {
    String text = str(value);
    if (text == null) {
      return fallback;
    }
    try {
      return Instant.parse(text);
    } catch (Exception e) {
      log.warn("Ignoring unparseable clause date '{}'", text);
      return fallback;
    }
  }

  private static String iso(Instant value) {
    return value == null ? null : value.toString();
  }

  private static String str(Object value) {
    if (value == null) {
      return null;
    }
    String text = String.valueOf(value).trim();
    return text.isEmpty() ? null : text;
  }

  private static String newId() {
    return UUID.randomUUID().toString().replace("-", "").substring(0, 24);
  }
}
