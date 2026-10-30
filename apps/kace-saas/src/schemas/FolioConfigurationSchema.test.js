import { describe, expect, it } from "vitest";
import { FolioConfigurationSchemaForm } from "./FolioConfigurationSchema";

const configuration = (overrides = {}) => ({
    nombre: "Radicado",
    descripcion: "",
    start_value: 1,
    reset_policy: "never",
    overflow_policy: "fail",
    segments: [{ type: "sequence", length: 6, pad_char: "0" }],
    ...overrides,
});

describe("FolioConfigurationSchemaForm", () => {
    it("acepta una configuración válida", () => {
        expect(FolioConfigurationSchemaForm.validate(configuration()).error).toBeUndefined();
    });

    // El API exige al menos 3 caracteres: avisar en el campo evita un 400 al guardar.
    it.each(["A", "AB"])("rechaza el nombre %s, más corto que el mínimo del API", (nombre) => {
        const { error } = FolioConfigurationSchemaForm.validate(configuration({ nombre }));

        expect(error?.details[0].path).toEqual(["nombre"]);
    });
});
