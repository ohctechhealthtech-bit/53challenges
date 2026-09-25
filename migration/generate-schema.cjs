/**
 * Generates MySQL DDL from the Base44 entity definitions.
 *
 *   node migration/generate-schema.cjs > migration/sql/schema.sql
 *
 * Generated rather than hand-written: there are 98 entities and the mapping is
 * mechanical, so regenerating after an entity change beats maintaining SQL by
 * hand. Re-run it whenever base44/entities changes.
 *
 * Type mapping
 *   string + enum            -> VARCHAR(64)
 *   string + format date-time-> DATETIME(3)
 *   string + format date     -> DATE
 *   string (url/image/link)  -> VARCHAR(1024)
 *   string (long-form names) -> TEXT
 *   string                   -> VARCHAR(255)
 *   boolean                  -> TINYINT(1)
 *   number                   -> DOUBLE
 *   array / object           -> JSON
 *
 * Every table also gets the five columns Base44 attaches to every row,
 * confirmed against live data: id, created_date, updated_date, created_by_id,
 * is_sample.
 */
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'base44', 'entities');

// Fields whose content is free-form prose and regularly exceeds a VARCHAR.
const LONG_TEXT = /(description|brief|body|note|notes|detail|details|content|message|summary|reason|comment|comments|instructions|terms|text|bio|feedback|rationale|statement)/i;
// Fields that hold URLs — long, but still worth indexing, so not TEXT.
const URLISH = /(url|uri|image|photo|avatar|logo|link|href|file)/i;

/**
 * MySQL string literal. Descriptions contain apostrophes ("e.g. 'dance'"), so
 * quotes must be doubled and backslashes escaped, and newlines flattened.
 */
function sqlString(value) {
  const escaped = String(value)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "''")
    .replace(/[\r\n]+/g, ' ');
  return `'${escaped}'`;
}

/** MySQL identifiers: snake_case table name from the entity name. */
const tableName = (name) => name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();

function columnType(field, prop) {
  const type = Array.isArray(prop.type) ? prop.type[0] : prop.type;
  switch (type) {
    case 'boolean': return 'TINYINT(1)';
    case 'number': return 'DOUBLE';
    case 'array':
    case 'object': return 'JSON';
    case 'string':
    default:
      if (prop.format === 'date-time') return 'DATETIME(3)';
      if (prop.format === 'date') return 'DATE';
      if (Array.isArray(prop.enum) && prop.enum.length) return 'VARCHAR(64)';
      if (URLISH.test(field)) return 'VARCHAR(1024)';
      if (LONG_TEXT.test(field)) return 'TEXT';
      return 'VARCHAR(255)';
  }
}

function defaultClause(prop, sqlType) {
  if (prop.default === undefined) return '';
  // TEXT and JSON cannot take a literal DEFAULT in MySQL; the application layer
  // applies those instead.
  if (sqlType === 'TEXT' || sqlType === 'JSON') return '';
  if (typeof prop.default === 'boolean') return ` DEFAULT ${prop.default ? 1 : 0}`;
  if (typeof prop.default === 'number') return ` DEFAULT ${prop.default}`;
  if (typeof prop.default === 'string') return ` DEFAULT ${sqlString(prop.default)}`;
  return '';
}

const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.jsonc')).sort();
const out = [];

out.push('-- MySQL schema for 53 Challenges, generated from base44/entities/*.jsonc');
out.push('-- Regenerate with: node migration/generate-schema.cjs > migration/sql/schema.sql');
out.push('-- utf8mb4 throughout: challenge titles and entries contain emoji.');
out.push('');
out.push('SET NAMES utf8mb4;');
out.push('SET FOREIGN_KEY_CHECKS = 0;');
out.push('');

const rlsNotes = [];

for (const file of files) {
  const entity = JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8'));
  const table = tableName(entity.name);
  const required = new Set(entity.required || []);
  const lines = [];

  // Base44's own row id is a 24-char hex ObjectId — kept as the primary key so
  // exported data imports unchanged and existing cross-references still resolve.
  lines.push('  `id` VARCHAR(24) NOT NULL');

  for (const [field, prop] of Object.entries(entity.properties || {})) {
    const sqlType = columnType(field, prop);
    const nullable = required.has(field) ? ' NOT NULL' : ' NULL';
    const def = defaultClause(prop, sqlType);
    const comment = prop.description
      ? ` COMMENT ${sqlString(String(prop.description).slice(0, 200))}`
      : '';
    lines.push(`  \`${field}\` ${sqlType}${nullable}${def}${comment}`);
  }

  // `User` is a Base44 built-in: its .jsonc declares only the custom `role`
  // field, but the account columns exist on every row and the backend filters
  // on them (`entities.User.filter({ email })`). Without these the table is
  // unusable. The list below was confirmed against the real exported rows in
  // migration/data/User.json, not inferred — the .jsonc does not mention any
  // of them.
  if (entity.name === 'User') {
    lines.push('  `email` VARCHAR(255) NULL');
    lines.push('  `full_name` VARCHAR(255) NULL');
    // Null on every live row, meaning "not disabled", so it must accept null
    // rather than forcing the importer to invent a value.
    lines.push('  `disabled` TINYINT(1) NULL DEFAULT 0');
    lines.push('  `disabled_reason` VARCHAR(255) NULL');
    lines.push('  `is_verified` TINYINT(1) NULL DEFAULT 0');
    lines.push('  `force_password_reset` TINYINT(1) NULL DEFAULT 0');
    lines.push('  `is_service` TINYINT(1) NULL DEFAULT 0');
    lines.push('  `app_id` VARCHAR(24) NULL');
    lines.push('  `collaborator_role` VARCHAR(64) NULL');
    // Base44's own role field, kept alongside the app's `role` because the two
    // are distinct: `role` is what this app grants, `_app_role` is what the
    // platform records. Dropping either would lose information.
    lines.push('  `_app_role` VARCHAR(64) NULL');
  }

  // System columns Base44 adds to every row.
  lines.push('  `created_date` DATETIME(3) NULL');
  lines.push('  `updated_date` DATETIME(3) NULL');
  lines.push('  `created_by_id` VARCHAR(64) NULL');
  lines.push('  `is_sample` TINYINT(1) NOT NULL DEFAULT 0');
  lines.push('  PRIMARY KEY (`id`)');

  // Index the columns the backend actually filters on.
  const props = Object.keys(entity.properties || {});
  const extraIndexed = entity.name === 'User' ? ['email'] : [];
  const indexed = props.concat(extraIndexed).filter((p) => /^(challenge_id|entry_id|user_id|email|slug|status|full_domain|purpose|token|panel_id|gate_id|domain_id|host_id|creator_email|key)$/.test(p));
  for (const col of indexed) {
    // `email` on User is added above, so it has no .jsonc property to read.
    const type = columnType(col, entity.properties[col] || { type: 'string' });
    // A prefix index is required for TEXT columns.
    lines.push(`  KEY \`idx_${table}_${col}\` (\`${col}\`${type === 'TEXT' ? '(191)' : ''})`);
  }
  lines.push('  KEY `idx_' + table + '_created_date` (`created_date`)');

  out.push(`-- ${entity.name}`);
  out.push(`DROP TABLE IF EXISTS \`${table}\`;`);
  out.push(`CREATE TABLE \`${table}\` (`);
  out.push(lines.join(',\n'));
  out.push(') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;');
  out.push('');

  if (entity.rls) rlsNotes.push(`${entity.name}: ${JSON.stringify(entity.rls)}`);
}

out.push('SET FOREIGN_KEY_CHECKS = 1;');
out.push('');
out.push('-- ---------------------------------------------------------------');
out.push('-- Row-level security is NOT expressed here. Base44 enforced it');
out.push('-- declaratively; in Java it becomes an application-layer check on');
out.push(`-- every read and write. ${rlsNotes.length} entities carry rules:`);
out.push('-- ---------------------------------------------------------------');
for (const note of rlsNotes) out.push(`--   ${note.slice(0, 160)}`);

process.stdout.write(out.join('\n') + '\n');
