import { stat } from 'node:fs/promises';
import path from 'node:path';

/**
 * Custom ESM loader that resolves extensionless imports and directory imports.
 *
 * The Lambda microservices are designed to be bundled by CDK's esbuild,
 * so they use import specifiers like:
 *   - '@kace/core/src/shared'         (directory → index.js)
 *   - '@kace/core/src/shared/SearchHistory'  (missing .js extension)
 *
 * This loader intercepts those and resolves them to valid ESM paths.
 */

const JS_EXTENSIONS = ['.js', '.mjs', '.cjs'];

/**
 * @param {string} specifier - The import specifier
 * @param {Object} context - Resolver context
 * @param {Function} nextResolve - Default resolver
 */
export async function resolve(specifier, context, nextResolve) {
    try {
        return await nextResolve(specifier, context);
    } catch (error) {
        // Only handle ERR_MODULE_NOT_FOUND and ERR_UNSUPPORTED_DIR_IMPORT
        if (error.code !== 'ERR_MODULE_NOT_FOUND' && error.code !== 'ERR_UNSUPPORTED_DIR_IMPORT') {
            throw error;
        }

        // Try adding .js extension
        for (const ext of JS_EXTENSIONS) {
            try {
                return await nextResolve(specifier + ext, context);
            } catch {
                // Continue trying
            }
        }

        // Try as directory import (specifier/index.js)
        for (const ext of JS_EXTENSIONS) {
            try {
                return await nextResolve(specifier + '/index' + ext, context);
            } catch {
                // Continue trying
            }
        }

        // If we have a parentURL, try to resolve relative to it
        if (context.parentURL) {
            const parentDir = path.dirname(new URL(context.parentURL).pathname);

            // Try resolving as a file path relative to parent
            if (!specifier.startsWith('.') && !specifier.startsWith('/')) {
                // This is a package specifier that failed, re-throw original
                throw error;
            }

            const absolutePath = path.resolve(parentDir, specifier);

            // Try as file with extensions
            for (const ext of JS_EXTENSIONS) {
                const filePath = absolutePath + ext;
                if (await fileExists(filePath)) {
                    return { url: new URL(`file://${filePath}`).href, shortCircuit: true };
                }
            }

            // Try as directory with index
            for (const ext of JS_EXTENSIONS) {
                const indexPath = path.join(absolutePath, 'index' + ext);
                if (await fileExists(indexPath)) {
                    return { url: new URL(`file://${indexPath}`).href, shortCircuit: true };
                }
            }
        }

        // Nothing worked, throw original error
        throw error;
    }
}

async function fileExists(filePath) {
    try {
        const s = await stat(filePath);
        return s.isFile();
    } catch {
        return false;
    }
}
