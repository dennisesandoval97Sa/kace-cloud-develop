#!/usr/bin/env node
/**
 * Generic JSDoc extractor.
 *
 * Extracts all `/** ... *\/` blocks from JavaScript files in a folder and emits
 * a Markdown document grouped by "service" (class/file).
 *
 * Intended for internal documentation generation (no AST dependency).
 */

import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * @param {string[]} argv
 * @returns {Record<string, string|boolean>}
 */
function parseArgs(argv) {
  /** @type {Record<string, string|boolean>} */
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      out[key] = next;
      i++;
    } else {
      out[key] = true;
    }
  }
  return out;
}

/**
 * @param {string} code
 * @returns {Array<{start: number, end: number, text: string}>}
 */
function extractJsdocBlocks(code) {
  const blocks = [];
  const re = /\/\*\*[\s\S]*?\*\//g;
  let m;
  while ((m = re.exec(code))) {
    blocks.push({ start: m.index, end: re.lastIndex, text: m[0] });
  }
  return blocks;
}

/**
 * Best-effort: finds a method/constructor name that follows a JSDoc block.
 * @param {string} after
 * @returns {string}
 */
function inferMemberName(after) {
  const s = after.trimStart();

  // constructor
  if (/^constructor\s*\(/.test(s)) return 'constructor';

  // method (including private names like _foo)
  const method = /^(?:async\s+)?([A-Za-z_$][\w$]*)\s*\(/.exec(s);
  if (method) return method[1];

  // class-level comment
  const cls = /^(?:export\s+)?class\s+([A-Za-z_$][\w$]*)\b/.exec(s);
  if (cls) return 'class';

  return 'comment';
}

/**
 * @param {string} code
 * @returns {string}
 */
function inferServiceName(code) {
  const exported = /export\s+class\s+([A-Za-z_$][\w$]*)\b/.exec(code);
  if (exported) return exported[1];

  const plain = /\bclass\s+([A-Za-z_$][\w$]*)\b/.exec(code);
  if (plain) return plain[1];

  return 'UnknownService';
}

/**
 * @param {string} filePath
 * @param {string} relFile
 * @param {string} code
 * @returns {{serviceName: string, relFile: string, items: Array<{member: string, block: string}>}}
 */
function extractFromFile(filePath, relFile, code) {
  const serviceName = inferServiceName(code);
  const blocks = extractJsdocBlocks(code);

  /** @type {Array<{member: string, block: string}>} */
  const items = blocks.map((b) => {
    const after = code.slice(b.end, Math.min(code.length, b.end + 400));
    const member = inferMemberName(after);
    return { member, block: b.text };
  });

  // Keep stable ordering but group constructor first when present
  items.sort((a, b) => {
    if (a.member === 'constructor' && b.member !== 'constructor') return -1;
    if (a.member !== 'constructor' && b.member === 'constructor') return 1;
    return a.member.localeCompare(b.member);
  });

  return { serviceName, relFile, items };
}

/**
 * @param {Object} params
 * @param {string} params.srcDir
 * @param {string} params.outFile
 * @param {string} [params.title]
 * @returns {Promise<void>}
 */
export async function generateJsdocMarkdown({ srcDir, outFile, title }) {
  const absSrc = path.resolve(process.cwd(), srcDir);
  const absOut = path.resolve(process.cwd(), outFile);

  const entries = await fs.readdir(absSrc, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile() && e.name.endsWith('.js'))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));

  const extracted = [];
  for (const name of files) {
    const fp = path.join(absSrc, name);
    const code = await fs.readFile(fp, 'utf8');
    extracted.push(extractFromFile(fp, name, code));
  }

  // Sort services by name
  extracted.sort((a, b) => a.serviceName.localeCompare(b.serviceName));

  const now = new Date().toISOString();
  const lines = [];
  lines.push(`# ${title || 'Service JSDoc Signatures (Extracted)'}`);
  lines.push('');
  lines.push(`Generated: ${now}`);
  lines.push('');
  lines.push(`Source: \`${srcDir.replace(/\\/g, '/')}/*.js\``);
  lines.push('');

  for (const svc of extracted) {
    lines.push(`## ${svc.serviceName} (\`${svc.relFile}\`)`);
    lines.push('');

    if (!svc.items.length) {
      lines.push('_No JSDoc blocks found._');
      lines.push('');
      continue;
    }

    for (const item of svc.items) {
      lines.push(`### ${item.member}`);
      lines.push('');
      lines.push('```js');
      lines.push(item.block);
      lines.push('```');
      lines.push('');
    }
  }

  await fs.writeFile(absOut, lines.join('\n'), 'utf8');
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));
  const src = /** @type {string} */ (args.src || 'src/plugins/kace/services');
  const out = /** @type {string} */ (args.out || 'SERVICES_JSDOC.md');
  const title = typeof args.title === 'string' ? args.title : undefined;

  try {
    await generateJsdocMarkdown({ srcDir: src, outFile: out, title });
    // eslint-disable-next-line no-console
    console.log(`Wrote ${out}`);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  }
}
