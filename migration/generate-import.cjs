/**
 * Turns the exported rows in migration/data/ into loadable SQL.
 *
 *   node migration/generate-import.cjs > migration/sql/data.sql
 *
 * Emits a file rather than connecting to MySQL directly: the Plesk database is
 * not reachable from outside the server, so the import has to travel as a file
 * and run there — the same route schema.sql already takes.
 *
 * Reads column types out of schema.sql so the two cannot drift: every value is
 * converted for the column it actually lands in, not for the type it happens to
 * have in JSON.
 */
const fs = require('fs');
const path = require('path');

const SCHEMA = path.join(__dirname, 'sql', 'schema.sql');
const DATA = path.join(__dirname, 'data');

const tableName = (n) => n.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();

// --- parse column types out of the DDL -------------------------------------
const sql = fs.readFileSync(SCHEMA, 'utf8');
const tables = {};
const tableRe = /CREATE TABLE `([^`]+)` \(([\s\S]*?)\n\) ENGINE/g;
let m;
while ((m = tableRe.exec(sql))) {
  const cols = {};
  for (const line of m[2].split('\n')) {
    const c = line.match(/^\s*`([^`]+)`\s+([A-Z]+)/);
    if (c) cols[c[1]] = c[2];
  }
  tables[m[1]] = cols;
}

// --- value conversion ------------------------------------------------------

const ESCAPES = {
  '\\': '\\\\',
  "'": "\\'",
  '\n': '\\n',
  '\r': '\\r',
  '\u0000': '\\0',
  '\u001a': '\\Z',
};

/** Reverses ESCAPES in a single pass, for the round-trip self-check below. */
const UNESCAPES = Object.fromEntries(
  Object.entries(ESCAPES).map(([plain, esc]) => [esc, plain])
);
const unescape = (s) => s.replace(/\\[\\'nr0Z]/g, (c) => UNESCAPES[c]);

let escapeChecks = 0;

/**
 * MySQL/MariaDB string literal, with the escapes the default (backslash) mode
 * needs.
 *
 * Every literal is round-tripped before being emitted. Escaping is the one
 * place a bug would be both easy to introduce and invisible: a mis-escaped
 * quote does not produce a small error, it makes the rest of the file parse as
 * one enormous string and the server then reports a failure thousands of lines
 * from the real cause. Checking here costs nothing and makes that class of bug
 * impossible to ship.
 */
function str(v) {
  const raw = String(v);
  const body = raw.replace(/[\\'\n\r\u0000\u001a]/g, (c) => ESCAPES[c]);
  if (unescape(body) !== raw) {
    console.error('escaping is not reversible for value:', JSON.stringify(raw.slice(0, 120)));
    process.exit(1);
  }
  escapeChecks++;
  return "'" + body + "'";
}

/**
 * ISO 8601 -> MySQL DATETIME(3), always interpreted as UTC.
 *
 * Base44 exports most timestamps WITHOUT a trailing Z — 1784 of 2188 in the
 * current data — but they are UTC all the same: the very same fields appear
 * with an explicit Z on other rows. Passing those to `new Date()` would apply
 * the local timezone and shift them (by 5.5 hours on an IST machine), quietly
 * corrupting the majority of dates in the database. So parse the parts
 * textually and never let a Date object near it.
 *
 * Fractional seconds are truncated to 3 digits to match DATETIME(3); the
 * microsecond tail Base44 emits is beyond what the column stores.
 */
function toDateTime(v) {
  const m = String(v).match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?)?/
  );
  if (!m) return null;
  const [, Y, Mo, D, h = '00', mi = '00', s = '00', frac = ''] = m;
  const ms = (frac + '000').slice(0, 3);
  return `${Y}-${Mo}-${D} ${h}:${mi}:${s}.${ms}`;
}

function toDate(v) {
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function literal(value, type) {
  if (value === null || value === undefined) return 'NULL';

  switch (type) {
    case 'DATETIME': {
      // An empty string is "unset", not the zero date — MySQL would otherwise
      // store 0000-00-00 or reject it under strict mode.
      if (value === '') return 'NULL';
      const d = toDateTime(value);
      return d ? str(d) : 'NULL';
    }
    case 'DATE': {
      if (value === '') return 'NULL';
      const d = toDate(value);
      return d ? str(d) : 'NULL';
    }
    case 'TINYINT':
      if (typeof value === 'boolean') return value ? '1' : '0';
      if (value === '') return 'NULL';
      return value ? '1' : '0';
    case 'DOUBLE': {
      if (value === '') return 'NULL';
      const n = Number(value);
      return Number.isFinite(n) ? String(n) : 'NULL';
    }
    case 'JSON':
      // A plain string literal, NOT CAST(... AS JSON). The server is MariaDB,
      // where JSON is an alias for LONGTEXT and `CAST(x AS JSON)` is a syntax
      // error. A quoted literal inserts correctly on both MariaDB and MySQL —
      // MySQL parses and validates it into a real JSON column on the way in.
      // The escaping this relies on is round-trip checked below.
      return str(JSON.stringify(value));
    default:
      // A stray object in a text column is still better preserved as JSON than
      // stringified to "[object Object]".
      if (typeof value === 'object') return str(JSON.stringify(value));
      return str(value);
  }
}

// --- emit ------------------------------------------------------------------
const out = [];
out.push('-- Data for 53 Challenges, generated from migration/data/*.json');
out.push('-- Regenerate with: node migration/generate-import.cjs > migration/sql/data.sql');
out.push('-- Load AFTER schema.sql.');
out.push('');
out.push('SET NAMES utf8mb4;');
out.push('SET FOREIGN_KEY_CHECKS = 0;');
// Strict mode on purpose: a truncated or out-of-range value must abort the
// import rather than be silently coerced, which is the whole failure mode this
// migration is trying to avoid.
out.push("SET SESSION sql_mode = CONCAT(@@sql_mode, ',STRICT_ALL_TABLES');");
out.push('');

const BATCH = 100;
let grandTotal = 0;
const summary = [];

for (const file of fs.readdirSync(DATA).filter((f) => f.endsWith('.json')).sort()) {
  const entity = path.basename(file, '.json');
  const table = tableName(entity);
  const cols = tables[table];
  if (!cols) {
    console.error(`no table for ${entity}`);
    process.exit(1);
  }

  const rows = JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf8'));
  if (!rows.length) continue;

  // Only columns that actually appear in the data, so the INSERT stays narrow
  // and unset columns take their schema defaults.
  const used = [];
  for (const r of rows) {
    for (const k of Object.keys(r)) {
      if (cols[k] && !used.includes(k)) used.push(k);
    }
  }

  out.push(`-- ${entity}: ${rows.length} rows`);
  // Re-runnable: clearing first means a second load replaces rather than
  // duplicates, and a partial earlier attempt leaves nothing behind.
  out.push(`DELETE FROM \`${table}\`;`);

  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const values = chunk.map(
      (r) => '  (' + used.map((c) => literal(r[c], cols[c])).join(', ') + ')'
    );
    out.push(
      `INSERT INTO \`${table}\` (` + used.map((c) => `\`${c}\``).join(', ') + ') VALUES'
    );
    out.push(values.join(',\n') + ';');
  }
  out.push('');
  grandTotal += rows.length;
  summary.push(`${table}: ${rows.length}`);
}

out.push('SET FOREIGN_KEY_CHECKS = 1;');
out.push('');
out.push(`-- ${grandTotal} rows across ${summary.length} non-empty tables.`);

process.stdout.write(out.join('\n') + '\n');
console.error(
  `${grandTotal} rows across ${summary.length} non-empty tables ` +
    `(${escapeChecks} string literals round-trip verified)`
);
