import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PUBLIC_ERROR_CODES } from "@kace/error-codes";

const localeDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../locale");

function readLocale(locale) {
    return JSON.parse(readFileSync(path.join(localeDir, `${locale}.json`), "utf8"));
}

describe("public error code i18n", () => {
    it.each(["en", "es"])("publishes a message for every catalog name in %s", (locale) => {
        const published = readLocale(locale).app.errors.public ?? {};
        const missing = Object.keys(PUBLIC_ERROR_CODES).filter((name) => !(name in published));
        expect(missing).toEqual([]);
    });

    it("publishes exact mapper validation guidance in English and Spanish", () => {
        const en = readLocale("en");
        const es = readLocale("es");

        expect(en.app.errors.public.BROKER_MAPPER_VALIDATION_FAILED).toBe(
            "Complete the mapper name and REST flow, and complete every field in each added mapping rule.",
        );
        expect(es.app.errors.public.BROKER_MAPPER_VALIDATION_FAILED).toBe(
            "Completa el nombre y el flujo REST del mapper, y todos los campos de cada regla de mapeo agregada.",
        );
        expect(en.broker.mappers.requiredFieldsGuidance).toBe(
            "Fields marked with * are required. Every added mapping rule must be complete.",
        );
        expect(es.broker.mappers.requiredFieldsGuidance).toBe(
            "Los campos marcados con * son obligatorios. Cada regla de mapeo agregada debe estar completa.",
        );
    });
});
