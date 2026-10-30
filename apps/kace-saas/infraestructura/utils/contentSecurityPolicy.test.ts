import { describe, expect, it } from "vitest";

import {
    buildEnforcedPolicy,
    buildReportOnlyPolicy,
    cleanDomains,
    shouldEmitReportOnly,
} from "./contentSecurityPolicy";

const DOMAINS = "localhost:5174 *.konecta.cloud *.amazoncognito.com *.amazonaws.com";

/**
 * Devuelve la directiva completa con ese nombre, o undefined si no está declarada.
 * El espacio final del prefijo evita que "style-src" haga match con "style-src-elem".
 */
const directive = (policy: string, name: string): string | undefined =>
    policy
        .split(";")
        .map((part) => part.trim())
        .find((part) => part === name || part.startsWith(`${name} `));

describe("buildEnforcedPolicy", () => {
    it("declara las tres directivas que exige el hallazgo WSTG-CONF-12", () => {
        const policy = buildEnforcedPolicy(DOMAINS);

        expect(directive(policy, "base-uri")).toBe("base-uri 'none'");
        expect(directive(policy, "object-src")).toBe("object-src 'none'");
        expect(directive(policy, "frame-ancestors")).toBe("frame-ancestors 'none'");
    });

    it("aplica un script-src sin 'unsafe-inline', sin 'unsafe-eval' y sin dominios externos", () => {
        // Promovida el 2026-07-31 con evidencia: el recorrido de las 14 rutas sobre
        // developmentapp.kace-cloud.com con la cabecera Report-Only activa dio 113
        // violaciones, todas de style-src-elem y ninguna de script-src.
        // Cierra el punto 5 del hallazgo WSTG-CONF-12 para scripts.
        const scriptSrc = directive(buildEnforcedPolicy(DOMAINS), "script-src");

        expect(scriptSrc).toBe("script-src 'self' blob:");
        expect(scriptSrc).not.toContain("'unsafe-inline'");
        expect(scriptSrc).not.toContain("'unsafe-eval'");
        expect(scriptSrc).not.toContain("*.amazonaws.com");
    });

    it("permite workers same-origin: MapLibre 6 carga /assets/*.js, no un blob inlined", () => {
        // Legacy era solo blob: (el worker de MapLibre 5 iba embebido). v6 apunta a un
        // fichero hashed; sin 'self' CloudFront bloquea el Worker y el mapa queda azul.
        expect(directive(buildEnforcedPolicy(DOMAINS), "worker-src")).toBe("worker-src 'self' blob:");
    });

    it("alinea child-src con worker-src: fallback en navegadores sin worker-src", () => {
        // child-src es el fallback de la spec cuando el UA no implementa worker-src.
        // Legacy blob: bloquearía /assets/maplibre-gl-worker-*.js (mapa azul).
        expect(directive(buildEnforcedPolicy(DOMAINS), "child-src")).toBe("child-src 'self' blob:");
    });

    it("conserva style-src con 'unsafe-inline' y no declara style-src-elem", () => {
        const policy = buildEnforcedPolicy(DOMAINS);

        expect(directive(policy, "style-src")).toContain("'unsafe-inline'");
        expect(directive(policy, "style-src-elem")).toBeUndefined();
    });

    it("no declara form-action durante la Fase 1", () => {
        // El login SSO usa auto-POST a un IdP externo; se mide antes de aplicarla.
        expect(directive(buildEnforcedPolicy(DOMAINS), "form-action")).toBeUndefined();
    });

    it("no produce directivas malformadas con entrada vacía o con espacios de sobra", () => {
        for (const input of ["", "   ", "a.com    b.com"]) {
            const policy = buildEnforcedPolicy(input);

            expect(policy).not.toContain(";;");
            expect(policy).not.toMatch(/\s;/);
            expect(policy).not.toMatch(/;\s*$/);
            expect(policy).not.toContain("  ");
        }
    });

    it("rechaza un token de dominio que contenga ';' (evita inyectar una directiva nueva)", () => {
        expect(() => buildEnforcedPolicy("localhost:5174 evil;script-src *")).toThrow(/evil;script-src/);
    });

    it("rechaza un token de dominio que contenga ',' (evita romper el listado de fuentes)", () => {
        expect(() => buildEnforcedPolicy("localhost:5174 evil,script-src")).toThrow(/evil,script-src/);
    });

    it("no rechaza valores CSP legítimos con '/', ':' o comillas simples", () => {
        expect(() => buildEnforcedPolicy("https://foo.com 'self' 'strict-dynamic' data: blob:")).not.toThrow();
    });
});

describe("cleanDomains", () => {
    it("quita las entradas de localhost y normaliza los espacios", () => {
        expect(cleanDomains("localhost:5174   a.com    b.com")).toBe("a.com b.com");
    });

    it("devuelve cadena vacía cuando no queda ningún dominio", () => {
        expect(cleanDomains("  localhost:5174  ")).toBe("");
    });

    it("descarta 'localhost' a secas", () => {
        expect(cleanDomains("localhost a.com")).toBe("a.com");
    });

    it("descarta 'localhost:5174'", () => {
        expect(cleanDomains("localhost:5174 a.com")).toBe("a.com");
    });

    it("conserva un dominio real que empieza por 'localhost'", () => {
        expect(cleanDomains("localhost:5174 localhostapp.io a.com")).toBe("localhostapp.io a.com");
    });
});

describe("buildReportOnlyPolicy", () => {
    it("declara un script-src sin 'unsafe-inline', sin 'unsafe-eval' y sin dominios externos", () => {
        const scriptSrc = directive(buildReportOnlyPolicy(DOMAINS), "script-src");

        expect(scriptSrc).toBe("script-src 'self' blob:");
        expect(scriptSrc).not.toContain("*.amazonaws.com");
    });

    it("conserva 'unsafe-inline' en style-src pero no en style-src-elem", () => {
        const policy = buildReportOnlyPolicy(DOMAINS);

        // Al no declarar style-src-attr, los atributos style="" recaen en style-src,
        // que sí permite inline. Así la única hipótesis medida son los elementos <style>.
        expect(directive(policy, "style-src")).toContain("'unsafe-inline'");
        expect(directive(policy, "style-src-elem")).toBe("style-src-elem 'self'");
        expect(directive(policy, "style-src-attr")).toBeUndefined();
    });

    it("conserva *.amazonaws.com en connect-src para las URLs prefirmadas de S3", () => {
        expect(directive(buildReportOnlyPolicy(DOMAINS), "connect-src")).toContain("*.amazonaws.com");
    });

    it("no filtra localhost en ninguna directiva", () => {
        expect(buildReportOnlyPolicy(DOMAINS)).not.toContain("localhost");
    });

    it("declara form-action y las tres directivas del hallazgo", () => {
        const policy = buildReportOnlyPolicy(DOMAINS);

        expect(directive(policy, "form-action")).toBe("form-action 'self'");
        expect(directive(policy, "base-uri")).toBe("base-uri 'none'");
        expect(directive(policy, "object-src")).toBe("object-src 'none'");
        expect(directive(policy, "frame-ancestors")).toBe("frame-ancestors 'none'");
    });

    it("no produce directivas malformadas con entrada vacía", () => {
        const policy = buildReportOnlyPolicy("");

        expect(policy).not.toContain(";;");
        expect(policy).not.toMatch(/\s;/);
        expect(policy).not.toContain("  ");
    });
});

describe("guard de presupuesto de tamaño de la cabecera CSP", () => {
    // CloudFront valida el límite de ~1783 caracteres en el servicio, no en cdk synth,
    // así que una lista de dominios lo bastante larga debe fallar aquí, en local.
    const tooManyDomains = Array.from({ length: 20 }, (_, i) => `*.dominio-extra-numero-${i}.ejemplo.com`).join(" ");

    it("lanza cuando la política enforced serializada supera el presupuesto", () => {
        expect(() => buildEnforcedPolicy(`${DOMAINS} ${tooManyDomains}`)).toThrow();
    });

    it("el mensaje incluye la longitud obtenida y el presupuesto", () => {
        expect(() => buildEnforcedPolicy(`${DOMAINS} ${tooManyDomains}`)).toThrow(
            /mide \d+ caracteres.*presupuesto de 1700/s,
        );
    });

    it("no lanza con la lista real de 8 dominios de hoy (dentro del presupuesto)", () => {
        const REAL_DOMAINS =
            "localhost:5174 *.kace-cloud.com konecta.cloud *.konecta.cloud *.amazoncognito.com *.amazonaws.com ipv4.icanhazip.com api.ipify.org";

        expect(() => buildEnforcedPolicy(REAL_DOMAINS)).not.toThrow();
    });
});

describe("shouldEmitReportOnly", () => {
    it("emite la cabecera en los entornos de no producción", () => {
        expect(shouldEmitReportOnly("staging")).toBe(true);
        expect(shouldEmitReportOnly("develop")).toBe(true);
    });

    it("NO emite la cabecera en producción", () => {
        // La cabecera Report-Only ensucia la consola de los usuarios reales y adelanta
        // a un atacante cuál va a ser la política futura. Solo sirve para medir en dev.
        expect(shouldEmitReportOnly("production")).toBe(false);
    });

    it("lanza si APPS_ENVIRONMENT no está definida", () => {
        // Fallar ruidoso en synth es preferible a decidir por defecto: si se asumiera
        // "no es producción" se filtraría la cabecera a producción ante una variable
        // ausente, que es justo lo que este guard evita.
        expect(() => shouldEmitReportOnly(undefined)).toThrow(/APPS_ENVIRONMENT/);
        expect(() => shouldEmitReportOnly("")).toThrow(/APPS_ENVIRONMENT/);
    });

    it("lanza ante una errata de tipeo en vez de tratarla como no-producción", () => {
        expect(() => shouldEmitReportOnly("prod")).toThrow(/prod/);
        expect(() => shouldEmitReportOnly("PRODUCTION")).toThrow(/PRODUCTION/);
    });
});

describe("guard de PROMOTED_DIRECTIVES", () => {
    it("lanza cuando una clave promovida no existe entre las candidatas", () => {
        expect(() => buildEnforcedPolicy(DOMAINS, ["base-uri", "objetc-src"])).toThrow(/clave desconocida: objetc-src/);
    });

    it("no lanza con las claves promovidas por defecto", () => {
        expect(() => buildEnforcedPolicy(DOMAINS)).not.toThrow();
    });
});
