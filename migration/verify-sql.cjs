/**
 * Static check on a generated .sql file before it goes anywhere near a server.
 *
 *   node migration/verify-sql.cjs migration/sql/data.sql
 *
 * There is no local MySQL to load into, so this is the last chance to catch a
 * quoting bug. An unbalanced quote does not produce a small error — it makes
 * the rest of the file parse as one enormous string literal, and mysql reports
 * something misleading thousands of lines away from the real cause.
 */
const fs = require('fs');

const file = process.argv[2];
if (!file) {
  console.error('usage: node migration/verify-sql.cjs <file.sql>');
  process.exit(1);
}
const s = fs.readFileSync(file, 'utf8');

// Walk character by character tracking quote state, the same way the server
// will, rather than trusting a regex over the whole file.
let inStr = false;
let esc = false;
let stmts = 0;
let line = 1;
let openedAt = 0;

for (let i = 0; i < s.length; i++) {
  const c = s[i];
  if (c === '\n') line++;

  if (esc) { esc = false; continue; }

  if (inStr) {
    if (c === '\\') esc = true;
    else if (c === "'") inStr = false;
    continue;
  }

  if (c === "'") { inStr = true; openedAt = line; continue; }

  // Line comments only count outside a string; '--' inside a value is data.
  if (c === '-' && s[i + 1] === '-') {
    while (i < s.length && s[i] !== '\n') i++;
    line++;
    continue;
  }

  if (c === ';') stmts++;
}

const problems = [];
if (inStr) problems.push(`unterminated string literal, opened near line ${openedAt}`);

// JSON values are emitted as plain quoted literals (MariaDB has no
// CAST(x AS JSON)), so they cannot be picked out by syntax. Anything that
// unescapes to something starting with { or [ is treated as JSON and re-parsed:
// that catches an escaping bug in the payloads most likely to expose one,
// without needing to map every column back to its declared type.
let okJson = 0;
const badJson = [];
const castRe = /'((?:[^'\\]|\\.)*)'/g;

// Unescape in ONE pass. A chain of .replace() calls re-processes what earlier
// steps produced: a newline inside a JSON string is already '\n' by the time
// JSON.stringify is done, becomes '\\n' after SQL escaping, and the chain then
// turns that back into a real newline — corrupting valid output and reporting
// a generator bug that does not exist.
const UNESCAPE = {
  '\\\\': '\\',
  "\\'": "'",
  '\\n': '\n',
  '\\r': '\r',
  '\\0': '\u0000',
  '\\Z': '\u001a',
};
for (const m of s.matchAll(castRe)) {
  const raw = m[1].replace(/\\[\\'nr0Z]/g, (c) => UNESCAPE[c]);
  // Require a matching closing bracket too. Prose genuinely starts with a
  // bracket now and then ("[archived] untitled intake"), and flagging that as
  // malformed JSON is noise that hides a real failure.
  if (!/^\s*\{[\s\S]*\}\s*$/.test(raw) && !/^\s*\[[\s\S]*\]\s*$/.test(raw)) continue;
  try { JSON.parse(raw); okJson++; }
  catch (e) { badJson.push(raw.slice(0, 100)); }
}
if (badJson.length) {
  problems.push(`${badJson.length} malformed JSON literal(s)`);
  badJson.slice(0, 3).forEach((b) => problems.push(`    ${b}`));
}

const inserts = (s.match(/^INSERT INTO/gm) || []).length;
const deletes = (s.match(/^DELETE FROM/gm) || []).length;

console.log(`file            ${file}`);
console.log(`size            ${(s.length / 1024).toFixed(0)} KB`);
console.log(`statements      ${stmts}`);
console.log(`INSERT / DELETE ${inserts} / ${deletes}`);
console.log(`JSON literals   ${okJson} ok, ${badJson.length} bad`);
console.log(`quoting         ${inStr ? 'BROKEN' : 'balanced'}`);

if (problems.length) {
  console.log('\nPROBLEMS:');
  problems.forEach((p) => console.log('  ' + p));
  process.exit(1);
}
console.log('\nok');
