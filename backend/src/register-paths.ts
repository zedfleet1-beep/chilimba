/**
 * Maps @/* imports for production `node dist/*.js` runs.
 * Loaded via `node -r ./dist/register-paths.js` before the app starts.
 */
const moduleAlias = require('module-alias') as {
  addAliases(aliases: Record<string, string>): void;
};

moduleAlias.addAliases({
  '@': __dirname,
});