// Checks migration/sql/schema.sql against the real rows in migration/data/.
//
// The schema was generated from the .jsonc entity definitions, which declare
// types but not string lengths — the generator had to assume VARCHAR sizes.
// An assumption that is too small does not fail the import: MySQL truncates
// and carries on, so the data loss is silent. This compares every exported
// value against the column it will land in and reports anything that would not
// survive the round trip.
const fs = require('fs');
const path = require('path');

const SCHEMA = 'migration/sql/schema.sql';
const DATA = 'migration/data';

// Entity name -> table name, mirroring generate-schema.cjs.
const tableName = (n) => n.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();

// Parse the DDL into { table: { column: {type, size, nullable} } }.
const sql = fs.readFileSync(SCHEMA, 'utf8');
const tables = {};
const tableRe = /CREATE TABLE `([^`]+)` \(([\s\S]*?)\n\) ENGINE/g;
let m;
while ((m = tableRe.exec(sql))) {
  const [, tbl, body] = m;
  const cols = {};
  for (const line of body.split('\n')) {
    const c = line.match(/^\s*`([^`]+)`\s+([A-Z]+)(?:\((\d+)(?:,\d+)?\))?(.*)$/);
    if (!c) continue;
    cols[c[1]] = {
      type: c[2],
      size: c[3] ? parseInt(c[3], 10) : null,
      nullable: !/NOT NULL/.test(c[4]),
    };
  }
  tables[tbl] = cols;
}

const problems = { overflow: [], missingCol: [], nullViolation: [], typeMismatch: [], noTable: [] };
let checkedRows = 0;

for (const file of fs.readdirSync(DATA).filter((f) => f.endsWith('.json'))) {
  const entity = path.basename(file, '.json');
  const tbl = tableName(entity);
  const cols = tables[tbl];
  const rows = JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf8'));
  if (!cols) { if (rows.length) problems.noTable.push(`${entity} -> ${tbl} (${rows.length} rows)`); continue; }

  // Widest observed value per column, so one report line covers the whole table.
  const widest = {};

  for (const row of rows) {
    checkedRows++;
    for (const [k, v] of Object.entries(row)) {
      const col = cols[k];
      if (!col) {
        const key = `${tbl}.${k}`;
        if (!problems.missingCol.includes(key)) problems.missingCol.push(key);
        continue;
      }
      if (v === null || v === undefined) {
        if (!col.nullable) {
          const key = `${tbl}.${k}`;
          if (!problems.nullViolation.includes(key)) problems.nullViolation.push(key);
        }
        continue;
      }
      // Objects and arrays only fit a JSON column; anywhere else they would be
      // stringified into a too-small VARCHAR or rejected outright.
      if (typeof v === 'object') {
        if (col.type !== 'JSON' && col.type !== 'TEXT' && col.type !== 'LONGTEXT') {
          const key = `${tbl}.${k} holds ${Array.isArray(v) ? 'array' : 'object'} but column is ${col.type}${col.size ? `(${col.size})` : ''}`;
          if (!problems.typeMismatch.includes(key)) problems.typeMismatch.push(key);
        }
        continue;
      }
      // Only VARCHAR/CHAR carry a character length. The number after
      // DATETIME/DECIMAL is precision, not size, and comparing a string length
      // against it is meaningless.
      const isStringCol = col.type === 'VARCHAR' || col.type === 'CHAR';
      if (typeof v === 'string' && isStringCol && col.size) {
        // MySQL VARCHAR(n) counts characters, not bytes, under utf8mb4 — but
        // an astral emoji is one JS UTF-16 pair, so measure code points.
        const len = [...v].length;
        if (len > col.size && (!widest[k] || len > widest[k].len)) {
          widest[k] = { len, size: col.size, type: col.type, sample: v.slice(0, 60) };
        }
      }
    }
  }
  for (const [k, w] of Object.entries(widest)) {
    problems.overflow.push(`${tbl}.${k}  ${w.type}(${w.size}) but longest value is ${w.len} chars  e.g. "${w.sample}..."`);
  }
}

const report = (title, list) => {
  console.log(`\n=== ${title} (${list.length}) ===`);
  if (!list.length) console.log('  none');
  else list.sort().forEach((x) => console.log('  ' + x));
};

console.log(`checked ${checkedRows} rows across ${fs.readdirSync(DATA).filter(f=>f.endsWith('.json')).length} files against ${Object.keys(tables).length} tables`);
report('WOULD TRUNCATE — column too small', problems.overflow);
report('COLUMN MISSING FROM SCHEMA — data would be dropped', problems.missingCol);
report('NULL IN A NOT NULL COLUMN — insert would fail', problems.nullViolation);
report('TYPE MISMATCH', problems.typeMismatch);
report('NO TABLE FOR ENTITY', problems.noTable);

const total = Object.values(problems).reduce((a, b) => a + b.length, 0);
console.log(`\n${total} issue(s).`);
