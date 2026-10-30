import { lazy } from "react";

export const RELOAD_FLAG = "kace:lazy-chunk-reloaded";

/**
 * Recarga la pagina una sola vez ante un chunk obsoleto.
 *
 * Tras un deploy, los chunks con hash que referencia el index.html cacheado dejan
 * de existir en S3/CloudFront, por lo que el import() dinamico falla. Una recarga
 * trae el index.html nuevo (y los hashes nuevos). El flag en sessionStorage evita
 * un bucle de recargas si el fallo persiste.
 *
 * @returns {boolean} true si dispara la recarga, false si ya se recargo antes.
 */
export const reloadOnceForStaleChunk = () => {
    if (window.sessionStorage.getItem(RELOAD_FLAG) === "true") {
        return false; // ya recargamos una vez: no insistir (evita bucle de recargas)
    }
    window.sessionStorage.setItem(RELOAD_FLAG, "true");
    window.location.reload();
    return true;
};

/**
 * Envuelve React.lazy para recuperarse de fallos al importar un chunk.
 *
 * Si el import() falla, recarga la pagina una sola vez. Si tras recargar vuelve a
 * fallar, propaga el error para que el RouteErrorBoundary muestre el mensaje. Una
 * carga exitosa limpia el guard.
 *
 * @param {() => Promise<{ default: import('react').ComponentType }>} importFn
 */
export const lazyWithRetry = (importFn) =>
    lazy(async () => {
        try {
            const mod = await importFn();
            window.sessionStorage.removeItem(RELOAD_FLAG);
            return mod;
        } catch (error) {
            if (reloadOnceForStaleChunk()) {
                return new Promise(() => {});
            }
            throw error;
        }
    });
