#!/usr/bin/env node
/**
 * Convenience wrapper to generate `SERVICES_JSDOC.md` from the Kace services folder.
 */

import { generateJsdocMarkdown } from './extract-jsdoc.js';

const srcDir = 'src/plugins/kace/services';
const outFile = 'SERVICES_JSDOC.md';

await generateJsdocMarkdown({
  srcDir,
  outFile,
  title: 'Service JSDoc Signatures (Extracted)',
});
