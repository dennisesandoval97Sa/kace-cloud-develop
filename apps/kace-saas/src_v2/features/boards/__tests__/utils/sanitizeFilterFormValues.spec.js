import { describe, expect, it } from "vitest";
import { sanitizeFilterFormValues } from "../../utils/sanitizeFilterFormValues.util";

const FIELDS = [{ name: "subject" }, { name: "state" }];

describe("sanitizeFilterFormValues", () => {
    it("devuelve la misma referencia cuando todo sigue siendo filtrable", () => {
        const values = { subject: { value: "x" }, state: { value: 1 } };
        expect(sanitizeFilterFormValues(values, FIELDS)).toBe(values);
    });

    it("descarta los campos que ya no son filtrables", () => {
        const values = { subject: { value: "x" }, columnaBorrada: { value: "y" } };
        expect(sanitizeFilterFormValues(values, FIELDS)).toEqual({ subject: { value: "x" } });
    });

    it("descarta valores nulos o indefinidos", () => {
        const values = { subject: { value: "x" }, state: null };
        expect(sanitizeFilterFormValues(values, FIELDS)).toEqual({ subject: { value: "x" } });
    });

    it("deja los valores intactos mientras no haya campos (boardConfig cargando)", () => {
        const values = { subject: { value: "x" } };
        expect(sanitizeFilterFormValues(values, [])).toBe(values);
        expect(sanitizeFilterFormValues(values, undefined)).toBe(values);
    });

    it("normaliza entradas no validas a un objeto vacio", () => {
        expect(sanitizeFilterFormValues(null, FIELDS)).toEqual({});
        expect(sanitizeFilterFormValues(undefined, FIELDS)).toEqual({});
    });

    /*
     * Vaciar un campo y aplicar construia igualmente un criterio (`ilike ""`) que
     * se persistia y se reenviaba a la API en cada consulta del tablero.
     */
    it("descarta los campos cuyo valor quedo vacio", () => {
        const values = { subject: { value: "x" }, state: { value: "" } };
        expect(sanitizeFilterFormValues(values, FIELDS)).toEqual({ subject: { value: "x" } });
    });

    it("descarta los vacios aunque el valor sea el crudo y no un criterio", () => {
        expect(sanitizeFilterFormValues({ subject: "", state: { value: 1 } }, FIELDS)).toEqual({
            state: { value: 1 },
        });
    });

    it("descarta por displayValue vacio en los campos aux_", () => {
        const values = { subject: { operator: "jsonContains", value: "{}", displayValue: "" } };
        expect(sanitizeFilterFormValues(values, FIELDS)).toEqual({});
    });

    it("conserva el cero, que es un filtro numerico legitimo", () => {
        const values = { state: { operator: "eq", value: 0 } };
        expect(sanitizeFilterFormValues(values, FIELDS)).toBe(values);
    });

    it("descarta los vacios tambien mientras boardConfig aun carga", () => {
        expect(sanitizeFilterFormValues({ subject: { value: "" } }, [])).toEqual({});
    });

    it("devuelve la misma referencia para un objeto vacio", () => {
        const values = {};
        expect(sanitizeFilterFormValues(values, FIELDS)).toBe(values);
    });
});
