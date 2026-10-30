import { describe, it, expect } from "vitest";

import { validateString, inferTransformOnLoad } from "./fieldValidations";

const base = { type: "string", required: true };

const applySubmitFilter = (cleanField) =>
    Object.entries(cleanField).reduce((acc, [key, value]) => {
        if (value !== null && !(Array.isArray(value) && value.length === 0)) {
            acc[key] = value;
        }
        return acc;
    }, {});

describe("validateString - persistencia de trim y casing", () => {
    it("conserva trim y alphanum", () => {
        const result = validateString("-", { ...base, trim: true, alphanum: true });
        expect(result.trim).toBe(true);
        expect(result.alphanum).toBe(true);
    });

    it("serializa trim: false explícitamente cuando el toggle está apagado", () => {
        const result = validateString("-", { ...base, trim: false });
        expect(result.trim).toBe(false);
    });

    describe("transform activo", () => {
        it("uppercase => uppercase:true, lowercase:false", () => {
            const result = validateString("-", { ...base, transform: true, uppercase: true });
            expect(result).toMatchObject({ uppercase: true, lowercase: false });
        });

        it("lowercase (uppercase:false) => uppercase:false, lowercase:true", () => {
            const result = validateString("-", { ...base, transform: true, uppercase: false });
            expect(result).toMatchObject({ uppercase: false, lowercase: true });
        });

        it("uppercase indefinido se trata como lowercase", () => {
            const result = validateString("-", { ...base, transform: true });
            expect(result).toMatchObject({ uppercase: false, lowercase: true });
        });

        it("convive con trim y con un validationType (email)", () => {
            const result = validateString("email", {
                ...base,
                trim: true,
                transform: true,
                uppercase: true,
                email: { minDomainSegments: 2 },
            });
            expect(result).toMatchObject({ trim: true, uppercase: true, lowercase: false });
            expect(result.email).toBeDefined();
            expect(result).not.toHaveProperty("transform");
        });
    });

    describe("transform apagado", () => {
        it("no emite uppercase/lowercase aunque queden valores obsoletos en el formulario", () => {
            const result = validateString("-", { ...base, transform: false, uppercase: true, lowercase: true });
            expect(result).not.toHaveProperty("uppercase");
            expect(result).not.toHaveProperty("lowercase");
        });
    });

    describe("el toggle de UI no viaja en data_structure", () => {
        it("StringTypeValidator rechaza claves desconocidas: 'transform' nunca se serializa", () => {
            expect(validateString("-", { ...base, transform: true, uppercase: true })).not.toHaveProperty("transform");
            expect(validateString("-", { ...base, transform: false })).not.toHaveProperty("transform");
        });
    });

    describe("supervivencia al filtro de envío de SchemasForm", () => {
        it("el casing se conserva tras el filtro (false no se descarta)", () => {
            const upper = applySubmitFilter(validateString("-", { ...base, transform: true, uppercase: true }));
            expect(upper).toMatchObject({ uppercase: true, lowercase: false });
            expect(upper).not.toHaveProperty("transform");

            const lower = applySubmitFilter(validateString("-", { ...base, transform: true, uppercase: false }));
            expect(lower).toMatchObject({ uppercase: false, lowercase: true });
            expect(lower).not.toHaveProperty("transform");
        });
    });

    describe("round-trip data_structure -> formulario -> data_structure", () => {
        // inferTransformOnLoad es la misma función real que usa SchemasForm al reabrir un schema guardado.
        const reopenOnForm = (stored) => ({ ...stored, transform: inferTransformOnLoad(stored) });

        it("un campo lowercase guardado se reabre con el toggle activo y se vuelve a guardar igual", () => {
            const stored = { type: "string", required: true, trim: true, uppercase: false, lowercase: true };
            const onForm = reopenOnForm(stored);
            expect(onForm.transform).toBe(true);

            const resaved = validateString("-", onForm);
            expect(resaved).toMatchObject({ trim: true, uppercase: false, lowercase: true });
            expect(resaved).not.toHaveProperty("transform");
        });

        it("un campo uppercase guardado hace round-trip estable", () => {
            const stored = { type: "string", required: true, uppercase: true, lowercase: false };
            const resaved = validateString("-", reopenOnForm(stored));
            expect(resaved).toMatchObject({ uppercase: true, lowercase: false });
            expect(resaved).not.toHaveProperty("transform");
        });

        it("un campo string sin casing se reabre con transform:false", () => {
            const stored = { type: "string", required: true, trim: true };
            expect(inferTransformOnLoad(stored)).toBe(false);
        });
    });
});
