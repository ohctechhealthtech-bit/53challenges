/**
 * Generates a JPA entity + repository for every table in schema.sql.
 *
 *   node migration/generate-entities.cjs
 *
 * 98 entities of pure boilerplate is not worth hand-writing, and hand-written
 * copies drift from the schema the moment an entity changes. Generating from
 * schema.sql — the same file the database was built from — means the mapping
 * cannot disagree with the table it maps.
 *
 * Existing hand-written classes are never overwritten: UserEntity,
 * ChallengeDomainEntity and VoteEntity carry comments and custom queries that a
 * generator would destroy. They are listed in SKIP.
 */
const fs = require('fs');
const path = require('path');

const SCHEMA = path.join(__dirname, 'sql', 'schema.sql');
const BASE = path.join(__dirname, '..', 'server', 'src', 'main', 'java', 'com',
  'fiftythree', 'challenges');
const PKG = 'com.fiftythree.challenges.entity';
const OUT = path.join(BASE, 'entity');

// Ported by hand, with behaviour a generator does not know about.
const SKIP = new Set(['user', 'challenge_domain', 'vote']);

const pascal = (s) => s.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('');
const camel = (s) => {
  const p = pascal(s);
  return p.charAt(0).toLowerCase() + p.slice(1);
};

// MySQL/MariaDB reserved words. A column named after one is legal in the table
// — schema.sql backticks it — but Hibernate does NOT quote column names by
// default, so it would emit `select ... read ...` and the database would reject
// that as a syntax error. The failure happens at query time, not at startup,
// so it would surface as one broken endpoint rather than an app that will not
// boot. Backticks in the JPA name tell Hibernate to quote it.
//
// Present in this schema: read (host_notification, message), rank
// (series_standing), key (site_setting). The rest are listed so a column added
// later cannot reintroduce the problem.
const RESERVED_WORDS = new Set([
  'read', 'rank', 'key', 'order', 'group', 'index', 'range', 'condition',
  'interval', 'level', 'option', 'usage', 'match', 'natural', 'primary',
  'references', 'rows', 'schema', 'table', 'to', 'union', 'unique', 'update',
  'values', 'when', 'where', 'default', 'desc', 'asc', 'and', 'or', 'not',
  'null', 'in', 'is', 'like', 'exists', 'having', 'limit', 'join', 'left',
  'right', 'inner', 'outer', 'using', 'force', 'ignore', 'partition', 'long',
  'int', 'integer', 'float', 'double', 'decimal', 'numeric', 'real', 'bigint',
  'smallint', 'tinyint', 'mediumint', 'bit', 'binary', 'blob', 'lines',
]);

/** The column name as JPA should see it, quoted when it is a reserved word. */
function columnRef(name) {
  return RESERVED_WORDS.has(name.toLowerCase()) ? '`' + name + '`' : name;
}

/** Java type for a MySQL column type. */
function javaType(type, size) {
  switch (type) {
    case 'TINYINT': return 'Boolean';
    case 'DOUBLE': return 'Double';
    case 'DATETIME': return 'Instant';
    case 'DATE': return 'LocalDate';
    case 'JSON':
    case 'TEXT':
    case 'LONGTEXT':
    case 'VARCHAR':
    case 'CHAR':
    default: return 'String';
  }
}

const sql = fs.readFileSync(SCHEMA, 'utf8');
const tableRe = /CREATE TABLE `([^`]+)` \(([\s\S]*?)\n\) ENGINE/g;

fs.mkdirSync(OUT, { recursive: true });

let made = 0;
let skipped = 0;
let m;

while ((m = tableRe.exec(sql))) {
  const table = m[1];
  if (SKIP.has(table)) { skipped++; continue; }

  const cols = [];
  for (const line of m[2].split('\n')) {
    const c = line.match(/^\s*`([^`]+)`\s+([A-Z]+)(?:\((\d+)(?:,\d+)?\))?(.*)$/);
    if (!c) continue;
    cols.push({
      name: c[1],
      type: c[2],
      size: c[3] ? parseInt(c[3], 10) : null,
      notNull: /NOT NULL/.test(c[4]),
    });
  }
  if (!cols.length) continue;

  const cls = pascal(table) + 'Entity';
  const needsInstant = cols.some((c) => c.type === 'DATETIME');
  const needsLocalDate = cols.some((c) => c.type === 'DATE');

  const imports = [
    'import com.fasterxml.jackson.databind.PropertyNamingStrategies;',
    'import com.fasterxml.jackson.databind.annotation.JsonNaming;',
    'import jakarta.persistence.Column;',
    'import jakarta.persistence.Entity;',
    'import jakarta.persistence.Id;',
    'import jakarta.persistence.Table;',
  ];
  if (needsInstant) imports.push('import java.time.Instant;');
  if (needsLocalDate) imports.push('import java.time.LocalDate;');

  const body = [];
  const accessors = [];

  for (const col of cols) {
    const field = camel(col.name);
    const type = javaType(col.type, col.size);
    const isId = col.name === 'id';

    // A JSON or TEXT column maps to String: MariaDB stores JSON as LONGTEXT, so
    // there is nothing to bind to a richer type, and the callers that need
    // structure parse it themselves.
    const colAttrs = [`name = "${columnRef(col.name)}"`];
    if (type === 'String' && col.size && (col.type === 'VARCHAR' || col.type === 'CHAR')) {
      colAttrs.push(`length = ${col.size}`);
    }
    if (col.type === 'JSON' || col.type === 'TEXT' || col.type === 'LONGTEXT') {
      colAttrs.push('columnDefinition = "LONGTEXT"');
    }
    if (isId) colAttrs.push('nullable = false');

    if (isId) body.push('  @Id');
    body.push(`  @Column(${colAttrs.join(', ')})`);
    body.push(`  private ${type} ${field};`);
    body.push('');

    const upper = field.charAt(0).toUpperCase() + field.slice(1);
    accessors.push(`  public ${type} get${upper}() { return ${field}; }`);
    accessors.push(`  public void set${upper}(${type} ${field}) { this.${field} = ${field}; }`);
    accessors.push('');
  }

  const src = `package ${PKG};

${imports.join('\n')}

/**
 * Maps the \`${table}\` table. Generated by migration/generate-entities.cjs from
 * schema.sql — do not edit by hand; add the table to SKIP there if it needs
 * custom behaviour.
 *
 * <p>Serialised snake_case so a record returned straight to the client matches
 * the shape the Base44 entity API produced.
 */
@Entity
@Table(name = "${table}")
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ${cls} {

${body.join('\n')}${accessors.join('\n')}}
`;

  fs.writeFileSync(path.join(OUT, cls + '.java'), src);

  const repo = `package ${PKG};

import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Generated by migration/generate-entities.cjs. Add query methods in a separate
 * interface rather than here — this file is overwritten on regeneration.
 */
public interface ${pascal(table)}Repository extends JpaRepository<${cls}, String> {
}
`;
  fs.writeFileSync(path.join(OUT, pascal(table) + 'Repository.java'), repo);
  made++;
}

console.log(`generated ${made} entities + repositories in ${path.relative(process.cwd(), OUT)}`);
console.log(`skipped ${skipped} hand-written: ${[...SKIP].join(', ')}`);
