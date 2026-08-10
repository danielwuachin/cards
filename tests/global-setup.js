// Jest's globalSetup runs in its own process, outside ts-jest's transform
// pipeline, so it can't `import` .ts files directly — this registers tsx's
// CommonJS loader first so the require() below can pull in src/db.ts as-is,
// with no compiled duplicate of the migration SQL to keep in sync.
require('tsx/cjs');

module.exports = async function globalSetup() {
  const { runMigrations, pool } = require('../src/db');
  await runMigrations();
  await pool.end();
};
