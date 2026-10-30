import { describe, expect, it } from "vitest";

import { PUBLIC_ERROR_CODE_NAMES_BY_CODE, getPublicErrorCodeI18nKey } from "@kace/error-codes";

import en from "./en.json";
import es from "./es.json";

/**
 * `@kace/error-codes` es el SSOT de los códigos públicos y `app.errors.public` es su espejo
 * en el frontend: `getTranslatedError` traduce por NOMBRE del código, así que un código sin
 * clave i18n se degrada silenciosamente al mensaje genérico — CI en verde y el usuario sin
 * saber qué falló. Revisar el espejo a ojo no escala (lección CR-003): este test recorre el
 * catálogo en runtime en vez de enumerar los nombres a mano.
 */
const I18N_NAMESPACE = "app.errors.public";

/**
 * Exclusiones deliberadas (CR-003 §3: nunca una omisión silenciosa). Deuda HEREDADA, no
 * introducida por este espejo — pendiente de ticket de seguimiento. Al traducir cualquiera
 * de estos códigos, bórralo de la lista: el test lo exigirá desde ese momento.
 */
const CODE_NAMES_WITHOUT_TRANSLATION = new Set([
    /*
     * Avisos no bloqueantes que viajan en `data.warnings[]` y se renderizan con su propio
     * copy en el flujo de actualización de caso, no vía `getTranslatedError`.
     */
    "CASE_CLIENT_STALE",
    "CASE_CLASSIFICATION_STALE",
    "CASE_GROUP_STALE",
    /*
     * El detalle del rechazo de Channel Hub se muestra tal cual lo devuelve el proveedor
     * (ver `docs/API_EMAILS_SPEC.md`), sin traducción por código.
     */
    "CHANNEL_HUB_SEND_REJECTED",
    "CHANNEL_HUB_REPLY_REJECTED",
]);

const readI18nKey = (locale, i18nKey) => i18nKey.split(".").reduce((node, segment) => node?.[segment], locale);

const catalogEntries = Object.entries(PUBLIC_ERROR_CODE_NAMES_BY_CODE);

const translatableEntries = catalogEntries.filter(([, name]) => !CODE_NAMES_WITHOUT_TRANSLATION.has(name));

describe("public error codes ↔ locale mirror", () => {
    it.each([
        ["es", es],
        ["en", en],
    ])("every catalog code has a %s translation", (_localeName, locale) => {
        const missing = translatableEntries
            .filter(([code]) => !readI18nKey(locale, getPublicErrorCodeI18nKey(code, I18N_NAMESPACE)))
            .map(([code, name]) => `${name} (${code})`);

        expect(missing).toEqual([]);
    });

    it("has no orphan translations without a catalog code", () => {
        const catalogNames = new Set(Object.values(PUBLIC_ERROR_CODE_NAMES_BY_CODE));
        const orphans = Object.keys(readI18nKey(es, I18N_NAMESPACE)).filter((name) => !catalogNames.has(name));

        expect(orphans).toEqual([]);
    });

    it("keeps the exclusion list free of names that are already translated", () => {
        const stale = [...CODE_NAMES_WITHOUT_TRANSLATION].filter((name) =>
            Boolean(readI18nKey(es, `${I18N_NAMESPACE}.${name}`)),
        );

        expect(stale).toEqual([]);
    });

    it("keeps the exclusion list free of names that no longer exist in the catalog", () => {
        const catalogNames = new Set(Object.values(PUBLIC_ERROR_CODE_NAMES_BY_CODE));
        const unknown = [...CODE_NAMES_WITHOUT_TRANSLATION].filter((name) => !catalogNames.has(name));

        expect(unknown).toEqual([]);
    });
});
