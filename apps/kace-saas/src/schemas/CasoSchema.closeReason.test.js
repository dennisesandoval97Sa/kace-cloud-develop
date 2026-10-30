import { describe, expect, it } from "vitest";
import { caseCloseSchema, casoReassignSchemaForm, createBoardCasesBulkCloseSchema } from "./CasoSchema";
import { CLOSE_REASON_MAX_LENGTH, CLOSE_REASON_MIN_LENGTH } from "../constants/closeReason";

const boardSchema = createBoardCasesBulkCloseSchema();

describe("caseCloseSchema close reason length", () => {
    it("rejects a motivo_baja shorter than 3 characters", () => {
        const { error } = caseCloseSchema.validate({ motivo_baja: "ab" });

        expect(error).toBeDefined();
    });

    it("accepts a 3 character motivo_baja", () => {
        const { error } = caseCloseSchema.validate({ motivo_baja: "abc" });

        expect(error).toBeUndefined();
    });

    it("accepts a 5000 character motivo_baja", () => {
        const { error } = caseCloseSchema.validate({ motivo_baja: "a".repeat(CLOSE_REASON_MAX_LENGTH) });

        expect(error).toBeUndefined();
    });

    it("rejects a 5001 character motivo_baja", () => {
        const { error } = caseCloseSchema.validate({ motivo_baja: "a".repeat(CLOSE_REASON_MAX_LENGTH + 1) });

        expect(error).toBeDefined();
    });
});

describe("createBoardCasesBulkCloseSchema close reason length", () => {
    it("rejects a close_reason shorter than 3 characters", () => {
        const { error } = boardSchema.validate({ close_reason: "ab" });

        expect(error).toBeDefined();
    });

    it("accepts a 3 character close_reason", () => {
        const { error } = boardSchema.validate({ close_reason: "abc" });

        expect(error).toBeUndefined();
    });

    it("accepts a 5000 character close_reason", () => {
        const { error } = boardSchema.validate({ close_reason: "a".repeat(CLOSE_REASON_MAX_LENGTH) });

        expect(error).toBeUndefined();
    });

    it("rejects a 5001 character close_reason", () => {
        const { error } = boardSchema.validate({ close_reason: "a".repeat(CLOSE_REASON_MAX_LENGTH + 1) });

        expect(error).toBeDefined();
    });
});

describe("close reason length constants", () => {
    it("matches the comments contract", () => {
        expect(CLOSE_REASON_MIN_LENGTH).toBe(3);
        expect(CLOSE_REASON_MAX_LENGTH).toBe(5000);
    });
});

const convertOff = { convert: false, abortEarly: false };

describe("casoReassignSchemaForm unused user when assigning to a group", () => {
    it("accepts an empty usuario_id when tipo is group", () => {
        const { error } = casoReassignSchemaForm.validate({
            tipo: "1",
            usuario_id: "",
            grupo_id: "22222222-2222-4222-8222-222222222222",
        });

        expect(error).toBeUndefined();
    });
});

describe("casoReassignSchemaForm usuario_id rules", () => {
    it("rejects an empty usuario_id when tipo is user (tipo=2)", () => {
        const { error } = casoReassignSchemaForm.validate(
            { tipo: "2", usuario_id: "", grupo_id: "22222222-2222-4222-8222-222222222222" },
            { convert: false, abortEarly: false },
        );
        expect(error).toBeDefined();
    });
});

describe("caseCloseSchema and board close schema share trim and character rules", () => {
    it.each([
        ["caseCloseSchema", caseCloseSchema, "motivo_baja"],
        ["createBoardCasesBulkCloseSchema", boardSchema, "close_reason"],
    ])("%s rejects leading or trailing spaces", (_name, schema, field) => {
        const { error } = schema.validate({ [field]: " abc" }, convertOff);

        expect(error?.details.some((detail) => detail.type === "string.trim")).toBe(true);
    });

    it.each([
        ["caseCloseSchema", caseCloseSchema, "motivo_baja"],
        ["createBoardCasesBulkCloseSchema", boardSchema, "close_reason"],
    ])("%s rejects characters outside the allowed set", (_name, schema, field) => {
        const { error } = schema.validate({ [field]: "rstars<" }, convertOff);

        expect(error?.details.some((detail) => detail.type === "string.pattern.base")).toBe(true);
    });
});

const CHAR_PROBES = [
    ["rstars<", false],
    ["motivo {con llaves}", true],
    ["motivo: con dos puntos", true],
];

describe("close reason character probes match the backend contract", () => {
    it.each(CHAR_PROBES)("caseCloseSchema %s -> válido=%s", (value, expectedValid) => {
        const { error } = caseCloseSchema.validate({ motivo_baja: value }, convertOff);
        expect(error === undefined).toBe(expectedValid);
    });

    it.each(CHAR_PROBES)("createBoardCasesBulkCloseSchema %s -> válido=%s", (value, expectedValid) => {
        const { error } = boardSchema.validate({ close_reason: value }, convertOff);
        expect(error === undefined).toBe(expectedValid);
    });
});
