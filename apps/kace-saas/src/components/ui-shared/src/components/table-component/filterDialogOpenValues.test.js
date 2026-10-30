import { describe, it, expect } from "vitest";
import { buildEmptyFilterFormValues, getFilterDialogOpenValues } from "./filterDialogOpenValues";

describe("getFilterDialogOpenValues", () => {
    const columns = ["estadoActual", "reference", "grupo_nombre"];

    it("returns applied values merged over empty columns when a filter session is active", () => {
        const applied = { estadoActual: "ESCALADO", reference: "12" };
        expect(getFilterDialogOpenValues(applied, columns)).toEqual({
            estadoActual: "ESCALADO",
            reference: "12",
            grupo_nombre: "",
        });
    });

    it("returns empty values for every column after filters were cleared", () => {
        expect(getFilterDialogOpenValues({}, columns)).toEqual({
            estadoActual: "",
            reference: "",
            grupo_nombre: "",
        });
        expect(getFilterDialogOpenValues({ reference: "" }, columns)).toEqual({
            estadoActual: "",
            reference: "",
            grupo_nombre: "",
        });
    });
});

describe("buildEmptyFilterFormValues", () => {
    it("maps each column to an empty string", () => {
        expect(buildEmptyFilterFormValues(["a", "b"])).toEqual({ a: "", b: "" });
    });
});
