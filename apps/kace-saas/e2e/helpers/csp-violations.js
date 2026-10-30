/**
 * Suscribe la página a los eventos securitypolicyviolation antes de que corra
 * cualquier script propio, y los acumula en window.__cspViolations.
 *
 * El campo `disposition` distingue "report" (cabecera Report-Only, que solo informa)
 * de "enforce" (cabecera aplicada, que bloqueó el recurso de verdad).
 */
export const collectCspViolations = async (page) => {
    await page.addInitScript(() => {
        window.__cspViolations = [];
        document.addEventListener("securitypolicyviolation", (event) => {
            window.__cspViolations.push({
                directive: event.effectiveDirective || event.violatedDirective,
                blockedURI: event.blockedURI,
                sourceFile: event.sourceFile,
                lineNumber: event.lineNumber,
                disposition: event.disposition,
            });
        });
    });
};

export const readCspViolations = async (page) => page.evaluate(() => window.__cspViolations ?? []);

/** Agrupa las violaciones por disposición, directiva y recurso bloqueado. */
export const summarizeViolations = (violations) => {
    const summary = new Map();

    for (const violation of violations) {
        // sourceFile forma parte de la clave a propósito: todo estilo inline comparte
        // blockedURI "inline", así que sin él las violaciones de librerías distintas
        // colapsan en una sola entrada que conserva únicamente el primer sourceFile visto.
        // Saber QUÉ librería inyecta el estilo es justamente la evidencia que justifica
        // ante el auditor por qué una directiva no se puede promover.
        const key = `${violation.disposition}|${violation.directive}|${violation.blockedURI}|${violation.sourceFile}`;
        const entry = summary.get(key) ?? {
            disposition: violation.disposition,
            directive: violation.directive,
            blockedURI: violation.blockedURI,
            sourceFile: violation.sourceFile,
            routes: [],
            count: 0,
        };

        entry.count += 1;
        if (!entry.routes.includes(violation.route)) entry.routes.push(violation.route);
        summary.set(key, entry);
    }

    return [...summary.values()].sort((a, b) => b.count - a.count);
};
