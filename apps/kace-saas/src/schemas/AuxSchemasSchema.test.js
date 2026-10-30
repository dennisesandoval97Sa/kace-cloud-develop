import { describe, expect, it } from "vitest";

import { AuxSchemaCreateSchema } from "./AuxSchemasSchema";

const validate = (field) =>
    AuxSchemaCreateSchema.validate(
        { name: "aux_schema", fields: [{ name: "amount", ...field }] },
        { abortEarly: false, allowUnknown: true },
    );

const detailsOf = (field) => validate(field).error?.details ?? [];
const typesOf = (field) => detailsOf(field).map((d) => d.type);
const messagesOf = (field) => detailsOf(field).map((d) => d.message);

describe("AuxSchemasSchema — límites min/max de campos numéricos", () => {
    /*
     * Regresión: min/max se inicializan en null, y Joi.exist() aceptaba null, lo que hacía
     * que Joi.ref("min") fallara con un error any.ref crudo en inglés apenas se escribía
     * un valor en "Valor por Defecto".
     */
    it.each([
        ["min y max vacíos (null)", { type: "number", min: null, max: null, default: 5 }],
        ["sólo min definido", { type: "number", min: 3, max: null, default: null }],
        ["sólo max definido", { type: "number", min: null, max: 7, default: null }],
        ["min y max válidos", { type: "number", min: 1, max: 20, default: 5 }],
        ["tipo string con sólo min", { type: "string", min: 3, max: null, default: "" }],
        // Los límites son inclusivos (.min/.max, no .greater/.less): fijamos ese contrato.
        ["default igual a min", { type: "number", min: 5, max: null, default: 5 }],
        ["default igual a max", { type: "number", min: null, max: 5, default: 5 }],
    ])("no reporta error con %s", (_label, field) => {
        expect(typesOf(field)).toEqual([]);
    });

    it("nunca emite errores any.ref crudos", () => {
        const combinations = [null, "", 0, 3, "3"].flatMap((min) =>
            [null, "", 0, 7, "7"].map((max) => ({ type: "number", min, max, default: 5 })),
        );

        for (const field of combinations) {
            expect(typesOf(field), JSON.stringify(field)).not.toContain("any.ref");
            expect(messagesOf(field).join(" "), JSON.stringify(field)).not.toMatch(/which must be a number/);
        }
    });

    it("sigue detectando un default menor que min", () => {
        const details = detailsOf({ type: "number", min: 10, max: null, default: 5 });

        expect(details).toHaveLength(1);
        expect(details[0].path).toEqual(["fields", 0, "default"]);
        expect(details[0].message).toBe("any.mustBeGreaterThanMin");
    });

    it("sigue detectando un default mayor que max", () => {
        const details = detailsOf({ type: "number", min: 1, max: 3, default: 5 });

        expect(details).toHaveLength(1);
        expect(details[0].path).toEqual(["fields", 0, "default"]);
        expect(details[0].message).toBe("any.mustBeLessThanMax");
    });

    /*
     * Los límites pueden llegar como string desde un esquema ya guardado; numericRef los
     * convierte para que la comparación siga funcionando en lugar de romper con any.ref.
     */
    it("compara correctamente cuando min/max llegan como string", () => {
        expect(messagesOf({ type: "number", min: "1", max: "3", default: 5 })).toEqual(["any.mustBeLessThanMax"]);
        expect(messagesOf({ type: "number", min: "10", max: null, default: 5 })).toEqual(["any.mustBeGreaterThanMin"]);
    });

    /*
     * Comportamiento preexistente, ajeno a este fix: un input numérico vaciado entrega ""
     * y Joi.number() lo rechaza. Lo relevante aquí es que sale como number.base, tipo que
     * joiFormikAdapter sí resuelve contra validations["number.base"], y no como any.ref.
     */
    it("reporta min/max vacíos ('') como number.base traducible", () => {
        expect(typesOf({ type: "number", min: "", max: "", default: 5 })).toEqual(["number.base", "number.base"]);
    });

    /*
     * min y max se validan entre sí, no sólo contra default. Sin este caso, borrar el when("max")
     * de createNumberSchema("min") dejaría pasar un rango invertido sin que fallara ningún test.
     */
    it("rechaza min mayor que max", () => {
        const details = detailsOf({ type: "number", min: 10, max: 5, default: null });

        expect(details.map((d) => `${d.type}@${d.path.join(".")}`)).toEqual(
            expect.arrayContaining(["number.max@fields.0.min", "number.min@fields.0.max"]),
        );
    });

    it("acepta min igual a max", () => {
        expect(typesOf({ type: "number", min: 7, max: 7, default: 7 })).toEqual([]);
    });
});
