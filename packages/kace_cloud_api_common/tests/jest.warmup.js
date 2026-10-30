// Pre-link the ESM module graph that knex Migrator will later import in
// parallel. The Migrator does `Promise.all(import(...))` over every
// migration file; ~29 of them transitively import `dotenv` through
// `@kace/database/env-config.js`. Under `--experimental-vm-modules` the
// concurrent first-time linking of that CJS bridge fails with:
//   "request for 'dotenv' is from a module not been linked"
// Importing env-config.js once here (sequentially) makes Jest cache the
// linked ESM wrappers for both env-config.js and dotenv, so every later
// parallel import resolves them instantly.
beforeAll(async () => {
    await import('@kace/database/env-config.js');
});
