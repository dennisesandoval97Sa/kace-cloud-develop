/**
 * Extrae el dominio de una URL
 * @param {string} url - Ej: "https://sub.example.com/path?query=1"
 * @returns {string|null} - Ej: "sub.example.com" o null si no es válida.
 */
export const getDomainFromUrl = (url) => {
    if (!url || typeof url !== "string") return null;

    try {
        const cleanedUrl = url.replace(/^https?:\/\//, "").split("/")[0];
        return cleanedUrl || null;
    } catch {
        // NO-SONAR: se retorna un null para evitar que algun fallo interrumpa el flujo de la aplicación.
        return null;
    }
};

/**
 * Valida si un dominio está en la lista de conexiones permitidas.
 * @param {string} domain - Dominio a validar (ej: "example.com").
 * @param {Array<{connection: string}>} allowedConnections - Lista de conexiones.
 * @returns {boolean}
 */
export const isDomainAllowed = (domain, allowedConnections = []) => {
    return allowedConnections.some(conn => conn.connection === domain);
};

/**
 * Versión completa: Valida una URL directamente contra las conexiones.
 * @param {string} url - URL a validar.
 * @param {Array<{connection: string}>} allowedConnections - Lista de conexiones.
 * @returns {boolean}
 */
export const isUrlAllowed = (url, allowedConnections = []) => {
    const domain = getDomainFromUrl(url);
    return domain ? isDomainAllowed(domain, allowedConnections) : false;
};
