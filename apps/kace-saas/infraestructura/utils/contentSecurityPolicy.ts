/** Une los fragmentos de una directiva descartando los vacíos. */
const src = (...parts: string[]): string => parts.filter(Boolean).join(" ");

/**
 * Caracteres que permiten escapar de la lista de fuentes de una directiva CSP:
 * ';' abre una directiva nueva y ',' rompe el listado de fuentes. Denylist deliberada,
 * NO allowlist: valores legítimos como 'https://foo.com', 'self' o data: deben pasar.
 */
const FORBIDDEN_TOKEN_CHARS = /[;,]/;

/** Parte la lista de dominios del .env en tokens, tolerando espacios de sobra. */
const tokenize = (domains: string): string[] => {
    const tokens = domains.trim().split(/\s+/).filter(Boolean);

    for (const token of tokens) {
        if (FORBIDDEN_TOKEN_CHARS.test(token)) {
            throw new Error(`Token de dominio CSP inválido: "${token}" contiene ';' o ','`);
        }
    }

    return tokens;
};

/**
 * Host del servidor de desarrollo de Vite: exactamente `localhost` o `localhost:<puerto>`.
 * Un `startsWith` sería más laxo de lo debido y descartaría dominios reales como
 * `localhostapp.io`, que nunca deben desaparecer de la política.
 */
const isDevServer = (domain: string): boolean => domain === "localhost" || /^localhost:\d+$/.test(domain);

/**
 * Lista de dominios sin las entradas que solo tienen sentido en desarrollo.
 * `localhost` / `localhost:5174` es el servidor de Vite, que nunca sirve la política de CloudFront.
 */
export const cleanDomains = (domains: string): string =>
    tokenize(domains)
        .filter((domain) => !isDevServer(domain))
        .join(" ");

/**
 * Directivas hoy en producción. No se tocan hasta tener evidencia de la fase Report-Only.
 */
const legacyDirectives = (domains: string): Record<string, string> => {
    const all = tokenize(domains).join(" ");

    return {
        "default-src": src("'self'", all),
        "script-src": src("'self'", "blob:", "'unsafe-inline'", "'unsafe-eval'", all),
        "style-src": src("'self'", "'unsafe-inline'", all),
        "img-src": src("'self'", "data:", "blob:", all),
        "font-src": src("'self'", "data:", all),
        "connect-src": src("'self'", all),
        "frame-src": src("'self'", "*.konecta.cloud"),
        "worker-src": "blob:",
        "child-src": "blob:",
    };
};

/**
 * Hipótesis que se miden en la cabecera Report-Only.
 * Una clave solo pasa a PROMOTED_DIRECTIVES con evidencia de cero violaciones en dev.
 */
const candidateDirectives = (domains: string): Record<string, string> => {
    const clean = cleanDomains(domains);

    return {
        "default-src": "'self'",
        "script-src": src("'self'", "blob:"),
        "style-src": src("'self'", "'unsafe-inline'", clean),
        "img-src": src("'self'", "data:", "blob:", clean),
        "font-src": src("'self'", "data:"),
        "connect-src": src("'self'", clean),
        "worker-src": src("'self'", "blob:"),
        "child-src": src("'self'", "blob:"),
        "style-src-elem": "'self'",
        "base-uri": "'none'",
        "object-src": "'none'",
        "frame-ancestors": "'none'",
        "form-action": "'self'",
    };
};

/**
 * Candidatas ya validadas, que viajan en la cabecera enforced.
 *
 * Las tres primeras entraron en la Fase 1: no pueden romper nada.
 *
 * `script-src` se promovió el 2026-07-31 con evidencia: el recorrido de las 14 rutas sobre
 * developmentapp.kace-cloud.com con la cabecera Report-Only activa produjo 113 violaciones,
 * todas de `style-src-elem` y ninguna de `script-src`. Cierra el punto 5 del hallazgo
 * WSTG-CONF-12 para scripts y saca `*.amazonaws.com` de la directiva, que era la fuente
 * más permisiva de toda la política.
 *
 * `worker-src` se promovió el 2026-09-09: MapLibre 6 carga `/assets/maplibre-gl-worker-*.js`
 * en vez del worker blob de v5. Legacy `blob:` bloquea ese Worker (mapa azul, controles sí).
 * `'self' blob:` es más permisivo que el legacy, no un endurecimiento.
 *
 * `child-src` se promovió el mismo día, alineada con `worker-src`. Es el fallback de la
 * spec cuando el UA no implementa `worker-src` (Safari anterior a 15.5). Legacy `blob:` bloquearía
 * el mismo Worker. Relajación, no endurecimiento.
 *
 * Siguen SIN promover, y no por falta de ganas:
 * - `style-src-elem`: 113 violaciones de seis librerías (sonner, vaul, react-dom,
 *   react-style-singleton, @fullcalendar/core, sweetalert2). Riesgo aceptado.
 * - `form-action`: midió cero, pero el auto-POST del SSO ocurre en el login, que la corrida
 *   no atraviesa porque arranca con la sesión ya capturada. Cero sin haber ejercitado el
 *   camino no es evidencia.
 * - `default-src`, `connect-src`, `img-src`, `font-src`, `style-src` (listas de dominio
 *   acotadas): midieron cero, pendientes del recorrido manual de subida/descarga de
 *   archivos, exportación y editor de texto.
 */
export const PROMOTED_DIRECTIVES: string[] = [
    "base-uri",
    "object-src",
    "frame-ancestors",
    "script-src",
    "worker-src",
    "child-src",
];

/** Entornos válidos, según documenta `.env.example` para `APPS_ENVIRONMENT`. */
const VALID_ENVIRONMENTS = ["staging", "production", "develop"];

/**
 * La cabecera `Content-Security-Policy-Report-Only` es un instrumento de medición: solo
 * tiene sentido fuera de producción. En producción ensuciaría la consola de los usuarios
 * reales con violaciones que no bloquean nada, y le adelantaría a un atacante cuál va a ser
 * la política cuando se endurezca.
 *
 * Lanza ante una variable ausente o con un valor desconocido en vez de asumir un valor por
 * defecto. Asumir "no es producción" filtraría la cabecera a producción ante una errata de
 * tipeo, que es exactamente lo que este guard evita; y asumir lo contrario apagaría la
 * medición en dev sin que nadie se entere. Fallar en `cdk synth` no tiene ese problema.
 */
export const shouldEmitReportOnly = (environment: string | undefined): boolean => {
    if (!environment || !VALID_ENVIRONMENTS.includes(environment)) {
        throw new Error(
            `APPS_ENVIRONMENT tiene un valor no reconocido: ${JSON.stringify(environment)}. ` +
                `Valores válidos: ${VALID_ENVIRONMENTS.join(", ")}. Se usa para decidir si se emite la ` +
                "cabecera Content-Security-Policy-Report-Only, que nunca debe salir a producción.",
        );
    }

    return environment !== "production";
};

/**
 * CloudFront rechaza en el servicio (no en `cdk synth`) una ResponseHeadersPolicy cuya
 * cabecera Content-Security-Policy supere ~1783 caracteres (TooLongCSPInResponseHeadersPolicy).
 * El umbral aquí es menor a propósito, para que el guard dispare con margen antes del límite
 * duro real y el fallo aparezca en local/CI en vez de en un deploy.
 */
const CSP_HEADER_SIZE_BUDGET = 1700;

const serialize = (directives: Record<string, string>): string => {
    const policy = Object.entries(directives)
        .map(([name, value]) => src(name, value))
        .join("; ");

    if (policy.length > CSP_HEADER_SIZE_BUDGET) {
        throw new Error(
            `La política CSP serializada mide ${policy.length} caracteres, por encima del presupuesto de ${CSP_HEADER_SIZE_BUDGET}. ` +
                "CloudFront rechaza cabeceras Content-Security-Policy de más de ~1783 caracteres " +
                "(TooLongCSPInResponseHeadersPolicy) al desplegar, aunque cdk synth pase. Causa habitual: la lista de " +
                "dominios de APPS_CONTENT_SECURITY_POLICY_DOMAINS se repite en seis directivas legacy (default-src, " +
                "script-src, style-src, img-src, font-src, connect-src), así que cada dominio nuevo cuesta ~6x su " +
                "longitud. Reduce la lista de dominios antes de desplegar.",
        );
    }

    return policy;
};

export function buildEnforcedPolicy(domains: string, promoted: string[] = PROMOTED_DIRECTIVES): string {
    const candidates = candidateDirectives(domains);
    const merged: Record<string, string> = legacyDirectives(domains);

    for (const key of promoted) {
        if (!(key in candidates)) {
            throw new Error(`PROMOTED_DIRECTIVES contiene una clave desconocida: ${key}`);
        }
        merged[key] = candidates[key];
    }

    return serialize(merged);
}

export function buildReportOnlyPolicy(domains: string): string {
    return serialize({ ...legacyDirectives(domains), ...candidateDirectives(domains) });
}
