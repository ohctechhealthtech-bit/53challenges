package com.fiftythree.challenges.entityapi;

import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import java.util.ArrayList;
import java.util.List;

/**
 * Who may see or touch a row, ported from the {@code rls} blocks in
 * {@code base44/entities/*.jsonc}.
 *
 * <p>A policy answers two different questions and both matter. For a read it
 * contributes a <b>predicate</b> that narrows the query, so a caller sees only
 * their own rows rather than being refused outright. For a write it gives a
 * <b>yes or no</b> on one specific row.
 *
 * <p>Everything here fails closed. {@link #denied()} is the default for an
 * operation nobody declared a rule for, and an anonymous caller matches no
 * ownership rule because their id and email are null — which is checked
 * explicitly rather than left to a null comparison.
 */
public abstract class RowPolicy {

  /** The caller a policy is evaluated against. */
  public record Caller(String userId, String email, boolean admin) {

    public boolean signedIn() {
      return email != null && !email.isBlank();
    }
  }

  /** The predicate narrowing a read, or null when nothing may be read at all. */
  public abstract Predicate toPredicate(Root<?> root, CriteriaBuilder cb, Caller caller);

  /** Whether this caller may write this specific row. */
  public abstract boolean allows(Object row, Caller caller);

  // ------------------------------------------------------------ factories

  /** Nobody. The default for an operation with no rule declared. */
  public static RowPolicy denied() {
    return new RowPolicy() {
      @Override
      public Predicate toPredicate(Root<?> root, CriteriaBuilder cb, Caller caller) {
        return null;
      }

      @Override
      public boolean allows(Object row, Caller caller) {
        return false;
      }
    };
  }

  /** Everyone, including anonymous callers. Only where Base44 declared {@code {}}. */
  public static RowPolicy anyone() {
    return new RowPolicy() {
      @Override
      public Predicate toPredicate(Root<?> root, CriteriaBuilder cb, Caller caller) {
        return cb.conjunction();
      }

      @Override
      public boolean allows(Object row, Caller caller) {
        return true;
      }
    };
  }

  /** Any signed-in caller. */
  public static RowPolicy authenticated() {
    return new RowPolicy() {
      @Override
      public Predicate toPredicate(Root<?> root, CriteriaBuilder cb, Caller caller) {
        return caller.signedIn() ? cb.conjunction() : null;
      }

      @Override
      public boolean allows(Object row, Caller caller) {
        return caller.signedIn();
      }
    };
  }

  /** Administrators only. */
  public static RowPolicy admin() {
    return new RowPolicy() {
      @Override
      public Predicate toPredicate(Root<?> root, CriteriaBuilder cb, Caller caller) {
        return caller.admin() ? cb.conjunction() : null;
      }

      @Override
      public boolean allows(Object row, Caller caller) {
        return caller.admin();
      }
    };
  }

  /**
   * Rows this caller created, matched on {@code created_by_id}.
   *
   * <p>An anonymous caller has no id, so the comparison is short-circuited
   * rather than being allowed to match rows whose {@code created_by_id} is
   * itself null.
   */
  public static RowPolicy createdBy() {
    return new FieldPolicy("createdById", true);
  }

  /** Rows whose named column holds the caller's email address. */
  public static RowPolicy ownedByEmail(String attribute) {
    return new FieldPolicy(attribute, false);
  }

  /** Any of these policies admitting the row is enough. */
  public static RowPolicy anyOf(RowPolicy... policies) {
    List<RowPolicy> all = List.of(policies);
    return new RowPolicy() {
      @Override
      public Predicate toPredicate(Root<?> root, CriteriaBuilder cb, Caller caller) {
        List<Predicate> parts = new ArrayList<>();
        for (RowPolicy policy : all) {
          Predicate part = policy.toPredicate(root, cb, caller);
          if (part != null) {
            parts.add(part);
          }
        }
        // Every branch refused, so the whole thing refuses. Returning an empty
        // disjunction here would be a predicate that matches nothing, which is
        // the same outcome — but null says "denied" to the caller explicitly.
        return parts.isEmpty() ? null : cb.or(parts.toArray(new Predicate[0]));
      }

      @Override
      public boolean allows(Object row, Caller caller) {
        for (RowPolicy policy : all) {
          if (policy.allows(row, caller)) {
            return true;
          }
        }
        return false;
      }
    };
  }

  /** Both must admit the row. */
  public static RowPolicy allOf(RowPolicy... policies) {
    List<RowPolicy> all = List.of(policies);
    return new RowPolicy() {
      @Override
      public Predicate toPredicate(Root<?> root, CriteriaBuilder cb, Caller caller) {
        List<Predicate> parts = new ArrayList<>();
        for (RowPolicy policy : all) {
          Predicate part = policy.toPredicate(root, cb, caller);
          // One branch refusing refuses the conjunction outright.
          if (part == null) {
            return null;
          }
          parts.add(part);
        }
        return cb.and(parts.toArray(new Predicate[0]));
      }

      @Override
      public boolean allows(Object row, Caller caller) {
        for (RowPolicy policy : all) {
          if (!policy.allows(row, caller)) {
            return false;
          }
        }
        return true;
      }
    };
  }

  /**
   * Rows where an attribute equals, or does not equal, a fixed value.
   *
   * <p>Used for the two entities whose visibility depends on their own state
   * rather than on who is asking: a challenge that has been published, and a
   * draft that is not a reusable template.
   */
  public static RowPolicy where(String attribute, Object value, boolean equals) {
    return new RowPolicy() {
      @Override
      public Predicate toPredicate(Root<?> root, CriteriaBuilder cb, Caller caller) {
        var path = root.get(attribute);
        return equals ? cb.equal(path, value) : cb.notEqual(path, value);
      }

      @Override
      public boolean allows(Object row, Caller caller) {
        Object actual = Entities.read(row, attribute);
        boolean same = value == null ? actual == null : value.equals(actual);
        return equals == same;
      }
    };
  }

  /** Rows whose attribute is one of a set of values. */
  public static RowPolicy whereIn(String attribute, List<String> values) {
    return new RowPolicy() {
      @Override
      public Predicate toPredicate(Root<?> root, CriteriaBuilder cb, Caller caller) {
        return root.get(attribute).in(values);
      }

      @Override
      public boolean allows(Object row, Caller caller) {
        Object actual = Entities.read(row, attribute);
        return actual != null && values.contains(String.valueOf(actual));
      }
    };
  }

  /** Matches rows whose attribute holds the caller's id or email. */
  private static final class FieldPolicy extends RowPolicy {

    private final String attribute;
    private final boolean byUserId;

    private FieldPolicy(String attribute, boolean byUserId) {
      this.attribute = attribute;
      this.byUserId = byUserId;
    }

    private String value(Caller caller) {
      String value = byUserId ? caller.userId() : caller.email();
      return value == null || value.isBlank() ? null : value;
    }

    @Override
    public Predicate toPredicate(Root<?> root, CriteriaBuilder cb, Caller caller) {
      String value = value(caller);
      if (value == null) {
        return null;
      }
      if (byUserId) {
        return cb.equal(root.get(attribute), value);
      }
      // Emails are compared case-insensitively: the same person signs in as
      // Person@Example.com and person@example.com, and a case-sensitive match
      // would hide their own rows from them.
      return cb.equal(cb.lower(root.get(attribute).as(String.class)), value.toLowerCase());
    }

    @Override
    public boolean allows(Object row, Caller caller) {
      String value = value(caller);
      if (value == null) {
        return false;
      }
      Object actual = Entities.read(row, attribute);
      if (actual == null) {
        return false;
      }
      return byUserId
          ? value.equals(String.valueOf(actual))
          : value.equalsIgnoreCase(String.valueOf(actual));
    }
  }
}
