package com.fiftythree.challenges.entityapi;

import jakarta.persistence.EntityManager;
import jakarta.persistence.metamodel.EntityType;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Component;

/**
 * Maps a Base44 entity name onto its JPA class.
 *
 * <p>Built from Hibernate's own metamodel rather than a hand-written list, so
 * it cannot drift out of step with the generated entities: {@code EntryEntity}
 * is reachable as {@code Entry}, and a table added by regenerating the entities
 * is mapped automatically.
 *
 * <p>Being mapped here does not make an entity reachable. {@link EntityPolicies}
 * decides that, and anything it does not list is refused — so the metamodel
 * sweep is a convenience for wiring, never a grant of access.
 */
@Component
public class EntityRegistry {

  private static final String SUFFIX = "Entity";

  private final Map<String, Class<?>> byName;

  public EntityRegistry(EntityManager entityManager) {
    Map<String, Class<?>> map = new LinkedHashMap<>();
    for (EntityType<?> type : entityManager.getMetamodel().getEntities()) {
      Class<?> javaType = type.getJavaType();
      if (javaType == null) {
        continue;
      }
      String simple = javaType.getSimpleName();
      String name = simple.endsWith(SUFFIX)
          ? simple.substring(0, simple.length() - SUFFIX.length())
          : simple;
      map.putIfAbsent(name, javaType);
    }
    this.byName = Map.copyOf(map);
  }

  public Optional<Class<?>> lookup(String entityName) {
    return Optional.ofNullable(byName.get(entityName));
  }
}
