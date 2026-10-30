
import { registerHooks } from 'node:module';

/**
 * Raiz de src/ de este paquete.
 * El shim solo actua sobre imports cuyo modulo padre
 * se encuentra dentro de src/.
 */
const PACKAGE_SRC_URL = new URL('../../src/', import.meta.url).href;

const SPECIFIER_HAS_EXTENSION = /\.[a-zA-Z0-9]+$/;

let registered = false;

/**
 * Registra un hook de resolucion para imports ESM.
 *
 * Soporta:
 * - Archivos relativos sin extension.
 * - Directorios con index.js.
 * - Imports como '.' y '..'.
 * - Subpaths de dependencias como dayjs/plugin/duration.
 *
 * Primero intenta la resolucion nativa de Node.
 * Solo aplica alternativas cuando la resolucion falla.
 */
export const registerSrcResolveShim = () => {
    if (registered) {
        return;
    }

    registerHooks({
        resolve(specifier, context, nextResolve) {
            try {
                return nextResolve(specifier, context);
            } catch (error) {
                // No modificar imports fuera de src/.
                if (!context.parentURL?.startsWith(PACKAGE_SRC_URL)) {
                    throw error;
                }

                const isRelative =
                    specifier === '.' ||
                    specifier === '..' ||
                    specifier.startsWith('./') ||
                    specifier.startsWith('../');

                const hasExtension =
                    specifier !== '.' &&
                    specifier !== '..' &&
                    SPECIFIER_HAS_EXTENSION.test(specifier);

                const isResolutionError =
                    error.code === 'ERR_MODULE_NOT_FOUND' ||
                    error.code === 'ERR_UNSUPPORTED_DIR_IMPORT';

                if (!isResolutionError) {
                    throw error;
                }

                // Resolver imports relativos.
                if (isRelative) {
                    // Primero probar como archivo .js,
                    // excepto para '.' y '..'.
                    if (specifier !== '.' && specifier !== '..' &&
                        !hasExtension) {
                        try {
                            return nextResolve(
                                `${specifier}.js`,
                                context
                            );
                        } catch (fileError) {
                            if (
                                fileError.code !== 'ERR_MODULE_NOT_FOUND' &&
                                fileError.code !== 'ERR_UNSUPPORTED_DIR_IMPORT'
                            ) {
                                throw fileError;
                            }
                        }
                    }

                    // Resolver directorios con index.js.
                    if (!hasExtension) {
                        return nextResolve(
                            `${specifier.replace(/\/$/, '')}/index.js`,
                            context
                        );
                    }

                    throw error;
                }

                // Resolver subpaths externos sin extension.
                // Ejemplo: dayjs/plugin/duration
                if (
                    error.code === 'ERR_MODULE_NOT_FOUND' &&
                    !hasExtension
                ) {
                    return nextResolve(
                        `${specifier}.js`,
                        context
                    );
                }

                throw error;
            }
        },
    });

    registered = true;
};
