package com.fiftythree.challenges.entityapi;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fiftythree.challenges.security.CallerResolver;
import com.fiftythree.challenges.user.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.metamodel.Attribute;
import jakarta.persistence.metamodel.EntityType;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * The Base44 entity API, served locally.
 *
 * <p>The frontend SDK is configured with {@code serverUrl: ''}, so its entity
 * calls already arrive at this origin as
 * {@code /api/apps/{appId}/entities/{Entity}}. Implementing that path here
 * takes them over with no change to the frontend and none to nginx — the same
 * arrangement the function fallback uses.
 *
 * <p><b>Every request is filtered by {@link EntityPolicies}.</b> A read is
 * narrowed to the rows the caller may see rather than refused outright, so a
 * competitor listing entries gets their own; a write is checked against the
 * specific row. An entity the policy table does not list is refused entirely,
 * which means a new database table is never exposed by accident.
 *
 * <p>The query language is deliberately narrow: equality on one or more
 * fields, a sort, a limit and a skip. That is the whole of what the frontend
 * uses across its 108 call sites, and implementing more would be inventing a
 * surface nobody asked for and everybody could then rely on.
 */
@RestController
public class EntityApiController {

  private static final Logger log = LoggerFactory.getLogger(EntityApiController.class);

  /** Matches the SDK's own default page size. */
  private static final int DEFAULT_LIMIT = 100;

  /** A ceiling on any single read, whatever the caller asks for. */
  private static final int MAX_LIMIT = 5000;

  /** Columns a client may never set directly. */
  private static final Set<String> RESERVED = Set.of(
      "id", "createdDate", "updatedDate", "createdById");

  private final EntityManager entityManager;
  private final EntityRegistry registry;
  private final EntityPolicies policies;
  private final CallerResolver caller;
  private final UserRepository users;
  private final ObjectMapper mapper;

  public EntityApiController(
      EntityManager entityManager,
      EntityRegistry registry,
      EntityPolicies policies,
      CallerResolver caller,
      UserRepository users,
      ObjectMapper mapper) {
    this.entityManager = entityManager;
    this.registry = registry;
    this.policies = policies;
    this.caller = caller;
    this.users = users;
    this.mapper = mapper;
  }

  // ----------------------------------------------------------------- read

  @GetMapping("/api/apps/{appId}/entities/{entity}")
  @Transactional(readOnly = true)
  public ResponseEntity<?> list(
      @PathVariable String entity,
      @RequestParam(required = false) String q,
      @RequestParam(required = false) String sort,
      @RequestParam(required = false) Integer limit,
      @RequestParam(required = false) Integer skip,
      @RequestHeader(value = "Authorization", required = false) String authorization) {

    Resolved resolved = resolve(entity);
    if (resolved == null) {
      return notFound(entity);
    }
    RowPolicy.Caller who = caller();
    RowPolicy policy = policies.forEntity(entity).read();

    List<?> rows;
    try {
      rows = query(resolved, policy, who, q, sort, limit, skip);
    } catch (IllegalArgumentException e) {
      return ResponseEntity.status(400).body(Map.of("error", e.getMessage()));
    }
    return ResponseEntity.ok(rows.stream().map(this::toJson).toList());
  }

  /**
   * The cursor-paged form. Implemented over the same offset query the array
   * form uses, with the cursor carrying the offset — the frontend only ever
   * pages forward through small result sets, and a real keyset cursor would be
   * machinery with no current caller.
   */
  @GetMapping("/api/apps/{appId}/entities/{entity}/v2/list")
  @Transactional(readOnly = true)
  public ResponseEntity<?> page(
      @PathVariable String entity,
      @RequestParam(required = false) String q,
      @RequestParam(required = false) String sort,
      @RequestParam(required = false) Integer limit,
      @RequestParam(required = false) String cursor) {

    Resolved resolved = resolve(entity);
    if (resolved == null) {
      return notFound(entity);
    }
    int offset = parseCursor(cursor);
    int size = clampLimit(limit);

    List<?> rows;
    try {
      rows = query(resolved, policies.forEntity(entity).read(), caller(),
          q, sort, size + 1, offset);
    } catch (IllegalArgumentException e) {
      return ResponseEntity.status(400).body(Map.of("error", e.getMessage()));
    }

    boolean more = rows.size() > size;
    List<?> visible = more ? rows.subList(0, size) : rows;

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("items", visible.stream().map(this::toJson).toList());
    out.put("has_more", more);
    out.put("next_cursor", more ? String.valueOf(offset + size) : null);
    return ResponseEntity.ok(out);
  }

  @GetMapping("/api/apps/{appId}/entities/{entity}/count")
  @Transactional(readOnly = true)
  public ResponseEntity<?> count(
      @PathVariable String entity, @RequestParam(required = false) String q) {

    Resolved resolved = resolve(entity);
    if (resolved == null) {
      return notFound(entity);
    }
    try {
      // Counted through the same policy-filtered query, so a caller cannot
      // learn how many rows exist beyond the ones they may read.
      List<?> rows = query(resolved, policies.forEntity(entity).read(), caller(),
          q, null, MAX_LIMIT, 0);
      return ResponseEntity.ok(Map.of("count", rows.size()));
    } catch (IllegalArgumentException e) {
      return ResponseEntity.status(400).body(Map.of("error", e.getMessage()));
    }
  }

  @GetMapping("/api/apps/{appId}/entities/{entity}/{id}")
  @Transactional(readOnly = true)
  public ResponseEntity<?> get(@PathVariable String entity, @PathVariable String id) {
    Resolved resolved = resolve(entity);
    if (resolved == null) {
      return notFound(entity);
    }
    Object row = entityManager.find(resolved.type(), id);
    if (row == null) {
      return ResponseEntity.status(404).body(Map.of("error", "Not found"));
    }
    // Checked against the fetched row rather than re-queried: the read policy
    // answers "may this caller see this row", and a 404 rather than a 403
    // avoids confirming that a hidden row exists.
    if (!policies.forEntity(entity).read().allows(row, caller())) {
      return ResponseEntity.status(404).body(Map.of("error", "Not found"));
    }
    return ResponseEntity.ok(toJson(row));
  }

  // ---------------------------------------------------------------- write

  @PostMapping("/api/apps/{appId}/entities/{entity}")
  @Transactional
  public ResponseEntity<?> create(
      @PathVariable String entity, @RequestBody(required = false) Map<String, Object> body) {

    Resolved resolved = resolve(entity);
    if (resolved == null) {
      return notFound(entity);
    }
    RowPolicy.Caller who = caller();
    if (!who.signedIn()) {
      return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
    }

    Object row;
    try {
      row = mapper.convertValue(body == null ? Map.of() : body, resolved.type());
    } catch (IllegalArgumentException e) {
      return ResponseEntity.status(400).body(Map.of("error", "Invalid field in request body"));
    }

    Instant now = Instant.now();
    set(row, "id", newId());
    set(row, "createdById", who.userId());
    set(row, "createdDate", now);
    set(row, "updatedDate", now);
    set(row, "isSample", Boolean.FALSE);

    // Checked after the ownership columns are stamped, because a create rule
    // of "created_by is me" can only be true once they are.
    if (!policies.forEntity(entity).create().allows(row, who)) {
      return forbidden();
    }

    entityManager.persist(row);
    return ResponseEntity.ok(toJson(row));
  }

  @PutMapping("/api/apps/{appId}/entities/{entity}/{id}")
  @Transactional
  public ResponseEntity<?> update(
      @PathVariable String entity,
      @PathVariable String id,
      @RequestBody(required = false) Map<String, Object> body) {

    Resolved resolved = resolve(entity);
    if (resolved == null) {
      return notFound(entity);
    }
    RowPolicy.Caller who = caller();
    Object row = entityManager.find(resolved.type(), id);
    if (row == null) {
      return ResponseEntity.status(404).body(Map.of("error", "Not found"));
    }
    // Judged on the row as it stands, before the patch. Otherwise a caller
    // could hand themselves a row by rewriting its owner in the same request.
    if (!policies.forEntity(entity).update().allows(row, who)) {
      return forbidden();
    }

    try {
      apply(row, resolved, body == null ? Map.of() : body);
    } catch (IllegalArgumentException e) {
      return ResponseEntity.status(400).body(Map.of("error", e.getMessage()));
    }
    set(row, "updatedDate", Instant.now());
    entityManager.merge(row);
    return ResponseEntity.ok(toJson(row));
  }

  @DeleteMapping("/api/apps/{appId}/entities/{entity}/{id}")
  @Transactional
  public ResponseEntity<?> delete(@PathVariable String entity, @PathVariable String id) {
    Resolved resolved = resolve(entity);
    if (resolved == null) {
      return notFound(entity);
    }
    Object row = entityManager.find(resolved.type(), id);
    if (row == null) {
      return ResponseEntity.status(404).body(Map.of("error", "Not found"));
    }
    if (!policies.forEntity(entity).delete().allows(row, caller())) {
      return forbidden();
    }
    entityManager.remove(row);
    return ResponseEntity.ok(Map.of("ok", true));
  }

  // ---------------------------------------------------------------- query

  /** An entity this API is willing to serve, with its JPA type. */
  private record Resolved(String name, Class<?> type, EntityType<?> metadata) {}

  private Resolved resolve(String entityName) {
    // Policy first: an entity with no policy is not served, whether or not a
    // table for it exists.
    if (!policies.isKnown(entityName)) {
      return null;
    }
    Optional<Class<?>> type = registry.lookup(entityName);
    if (type.isEmpty()) {
      log.warn("Entity '{}' has a policy but no mapped JPA type", entityName);
      return null;
    }
    return new Resolved(entityName, type.get(),
        entityManager.getMetamodel().entity(type.get()));
  }

  private List<?> query(
      Resolved resolved,
      RowPolicy policy,
      RowPolicy.Caller who,
      String q,
      String sort,
      Integer limit,
      Integer skip) {

    CriteriaBuilder cb = entityManager.getCriteriaBuilder();
    CriteriaQuery<Object> query = cb.createQuery(Object.class);
    @SuppressWarnings("unchecked")
    Root<Object> root = (Root<Object>) query.from(resolved.type());
    query.select(root);

    Predicate access = policy.toPredicate(root, cb, who);
    if (access == null) {
      // Refused outright: an empty list, not an error. The SDK's callers treat
      // a 403 as a page failure, and "you may see nothing here" is a legitimate
      // answer to a list request.
      return List.of();
    }

    List<Predicate> where = new ArrayList<>();
    where.add(access);
    where.addAll(filters(resolved, root, cb, q));
    query.where(cb.and(where.toArray(new Predicate[0])));

    applySort(resolved, root, cb, query, sort);

    var typed = entityManager.createQuery(query);
    typed.setFirstResult(skip == null || skip < 0 ? 0 : skip);
    typed.setMaxResults(clampLimit(limit));
    return typed.getResultList();
  }

  /** Translates the {@code q} parameter: flat equality on one or more fields. */
  private List<Predicate> filters(
      Resolved resolved, Root<Object> root, CriteriaBuilder cb, String q) {

    if (q == null || q.isBlank()) {
      return List.of();
    }
    JsonNode parsed;
    try {
      parsed = mapper.readTree(q);
    } catch (Exception e) {
      throw new IllegalArgumentException("Malformed query");
    }
    if (!parsed.isObject()) {
      throw new IllegalArgumentException("Query must be an object");
    }

    List<Predicate> out = new ArrayList<>();
    var fields = parsed.fields();
    while (fields.hasNext()) {
      var field = fields.next();
      String attribute = attributeOf(resolved, field.getKey());
      JsonNode value = field.getValue();

      if (value.isObject() || value.isArray()) {
        // Operators such as $in and $ne are not implemented. Refusing is the
        // point: silently ignoring an unsupported operator would widen the
        // result set rather than narrow it, which for a filtered list is a
        // disclosure, not a bug.
        throw new IllegalArgumentException(
            "Unsupported query operator on field '" + field.getKey() + "'");
      }
      out.add(equality(root, cb, attribute, value));
    }
    return out;
  }

  private Predicate equality(
      Root<Object> root, CriteriaBuilder cb, String attribute, JsonNode value) {

    var path = root.get(attribute);
    if (value.isNull()) {
      return cb.isNull(path);
    }
    if (value.isBoolean()) {
      return cb.equal(path, value.asBoolean());
    }
    if (value.isNumber()) {
      Class<?> javaType = path.getJavaType();
      if (Double.class.equals(javaType) || double.class.equals(javaType)) {
        return cb.equal(path, value.asDouble());
      }
      if (Integer.class.equals(javaType) || int.class.equals(javaType)) {
        return cb.equal(path, value.asInt());
      }
      if (Long.class.equals(javaType) || long.class.equals(javaType)) {
        return cb.equal(path, value.asLong());
      }
      return cb.equal(path, value.asDouble());
    }
    return cb.equal(path, value.asText());
  }

  private void applySort(
      Resolved resolved,
      Root<Object> root,
      CriteriaBuilder cb,
      CriteriaQuery<Object> query,
      String sort) {

    if (sort == null || sort.isBlank()) {
      return;
    }
    boolean descending = sort.startsWith("-");
    String attribute = attributeOf(resolved, descending ? sort.substring(1) : sort);
    var path = root.get(attribute);
    // id breaks the tie. Rows imported together share a timestamp to the
    // millisecond, and without a second key the same list comes back in a
    // different order on consecutive loads.
    query.orderBy(descending ? cb.desc(path) : cb.asc(path), cb.asc(root.get("id")));
  }

  /**
   * Resolves a snake_case field name to a JPA attribute, refusing anything the
   * entity does not have.
   *
   * <p>Unvalidated names reach the criteria API and become a
   * {@code IllegalArgumentException} deep inside Hibernate, which surfaces as a
   * 500. Checking here turns a typo into a 400 that names the field.
   */
  private String attributeOf(Resolved resolved, String field) {
    String attribute = Entities.toAttribute(field);
    for (Attribute<?, ?> declared : resolved.metadata().getAttributes()) {
      if (declared.getName().equals(attribute)) {
        return attribute;
      }
    }
    throw new IllegalArgumentException(
        "Unknown field '" + field + "' on " + resolved.name());
  }

  /** Copies the patch onto the row, skipping unknown and reserved columns. */
  private void apply(Object row, Resolved resolved, Map<String, Object> patch) {
    Set<String> writable = new LinkedHashSet<>();
    for (Attribute<?, ?> declared : resolved.metadata().getAttributes()) {
      if (!RESERVED.contains(declared.getName())) {
        writable.add(declared.getName());
      }
    }

    Map<String, Object> converted = new LinkedHashMap<>();
    for (Map.Entry<String, Object> field : patch.entrySet()) {
      String attribute = Entities.toAttribute(field.getKey());
      if (RESERVED.contains(attribute)) {
        // Silently ignored rather than rejected: the SDK round-trips whole
        // records, so a client sending back the id it was given is normal.
        continue;
      }
      if (!writable.contains(attribute)) {
        throw new IllegalArgumentException(
            "Unknown field '" + field.getKey() + "' on " + resolved.name());
      }
      converted.put(Entities.toField(attribute), field.getValue());
    }
    try {
      mapper.updateValue(row, converted);
    } catch (Exception e) {
      throw new IllegalArgumentException("Invalid value in request body");
    }
  }

  // -------------------------------------------------------------- helpers

  private RowPolicy.Caller caller() {
    // The SDK sends its credential as a header, so there is no session_token
    // in the body to fall back on here.
    String email = caller.email(null);
    if (email == null) {
      return new RowPolicy.Caller(null, null, false);
    }
    return new RowPolicy.Caller(
        users.findIdByEmail(email).orElse(null), email, caller.isAdmin(null));
  }

  private Object toJson(Object row) {
    return mapper.convertValue(row, Map.class);
  }

  private static void set(Object row, String attribute, Object value) {
    String suffix = Character.toUpperCase(attribute.charAt(0)) + attribute.substring(1);
    for (var method : row.getClass().getMethods()) {
      if (!method.getName().equals("set" + suffix) || method.getParameterCount() != 1) {
        continue;
      }
      try {
        if (value == null || method.getParameterTypes()[0].isInstance(value)) {
          method.invoke(row, value);
        }
      } catch (Exception e) {
        log.warn("Could not set '{}' on {}: {}",
            attribute, row.getClass().getSimpleName(), e.toString());
      }
      return;
    }
  }

  private static int clampLimit(Integer limit) {
    if (limit == null || limit <= 0) {
      return DEFAULT_LIMIT;
    }
    return Math.min(limit, MAX_LIMIT);
  }

  private static int parseCursor(String cursor) {
    if (cursor == null || cursor.isBlank()) {
      return 0;
    }
    try {
      return Math.max(0, Integer.parseInt(cursor));
    } catch (NumberFormatException e) {
      return 0;
    }
  }

  private static ResponseEntity<?> notFound(String entity) {
    // The same answer for "no such entity" and "not served here", so probing
    // this endpoint does not enumerate the database.
    return ResponseEntity.status(404).body(Map.of("error", "Unknown entity '" + entity + "'"));
  }

  private static ResponseEntity<?> forbidden() {
    return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
  }

  private static String newId() {
    return UUID.randomUUID().toString().replace("-", "").substring(0, 24);
  }
}
