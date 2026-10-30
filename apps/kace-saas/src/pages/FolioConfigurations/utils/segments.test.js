import { describe, it, expect } from "vitest";
import { getSegmentsProblem, isPreviewable, isSegmentComplete } from "./segments";
import { SEGMENT_DEFAULTS } from "../data/constants";

const sequence = { type: "sequence", length: 6, pad_char: "0" };
const literal = (value) => ({ type: "literal", value });

describe("isSegmentComplete", () => {
    it("rechaza los valores por defecto que el builder inserta al añadir un segmento", () => {
        expect(isSegmentComplete(SEGMENT_DEFAULTS.literal)).toBe(false);
        expect(isSegmentComplete(SEGMENT_DEFAULTS.field)).toBe(false);
    });

    it("acepta los defectos que ya vienen rellenos", () => {
        expect(isSegmentComplete(SEGMENT_DEFAULTS.date)).toBe(true);
        expect(isSegmentComplete(SEGMENT_DEFAULTS.sequence)).toBe(true);
    });

    it.each([
        ["una fecha sin formato", { type: "date", format: "" }],
        ["un consecutivo sin dígitos", { type: "sequence", length: 0 }],
        ["un campo sin ruta", { type: "field", path: "" }],
    ])("rechaza %s", (_label, segment) => {
        expect(isSegmentComplete(segment)).toBe(false);
    });

    // Un tipo desconocido lo rechaza el dominio con un mensaje propio; aquí no se adivina.
    it("no bloquea un tipo desconocido", () => {
        expect(isSegmentComplete({ type: "otro" })).toBe(true);
    });
});

describe("getSegmentsProblem", () => {
    it.each([
        ["sin segmentos", [], "folioConfigurations.messages.minSegment"],
        ["sin consecutivo", [literal("5")], "folioConfigurations.messages.exactlyOneSequence"],
        ["con dos consecutivos", [sequence, { ...sequence }], "folioConfigurations.messages.exactlyOneSequence"],
        ["con un segmento a medio llenar", [sequence, literal("")], "folioConfigurations.messages.incompleteSegment"],
        ["con una lista válida", [literal("RAD-"), sequence], null],
    ])("%s", (_label, segments, expected) => {
        expect(getSegmentsProblem(segments)).toBe(expected);
        expect(isPreviewable(segments)).toBe(expected === null);
    });
});

describe("isPreviewable", () => {
    // El payload exacto que devolvía 400: "segments[1].value" is not allowed to be empty.
    it("no previsualiza mientras haya un literal recién añadido y aún vacío", () => {
        expect(isPreviewable([sequence, literal("")])).toBe(false);
    });

    it("previsualiza en cuanto el literal tiene contenido", () => {
        expect(isPreviewable([sequence, literal("5")])).toBe(true);
    });

    it("sigue exigiendo exactamente un consecutivo", () => {
        expect(isPreviewable([])).toBe(false);
        expect(isPreviewable([literal("5")])).toBe(false);
        expect(isPreviewable([sequence, { ...sequence }])).toBe(false);
    });
});
