import { describe, expect, it } from "vitest";
import { normalizeQuickLinks } from "./quickLinks.service";

describe("normalizeQuickLinks", () => {
    it("acepta respuestas con data.data como arreglo", () => {
        expect(normalizeQuickLinks({ data: { data: [{ id: "1" }] } })).toEqual([{ id: "1" }]);
    });
    it("acepta listas con items", () => {
        expect(normalizeQuickLinks({ data: { data: { items: [{ id: "2" }] } } })).toEqual([{ id: "2" }]);
    });
    it("devuelve arreglo vacío en una respuesta vacía", () => {
        expect(normalizeQuickLinks(null)).toEqual([]);
    });
});
