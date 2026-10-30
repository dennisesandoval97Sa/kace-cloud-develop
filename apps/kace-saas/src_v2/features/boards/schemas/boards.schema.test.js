import { describe, it, expect } from "vitest";
import { validateBoardsInitialFilter } from "./boards.schema";

const BASE_VALID = {
    related_entity: "casos",
    field: "grupo_id",
    operator: "eq",
    comparison_type: "FUNCIONES",
    function_type: "logged_in_user_group",
    days: "",
    value: "",
    type: "and",
};

describe("validateBoardsInitialFilter — logged_in_user_group", () => {
    it("accepts logged_in_user_group with empty days and value", async () => {
        await expect(validateBoardsInitialFilter.validateAsync(BASE_VALID)).resolves.toBeDefined();
    });

    it("accepts logged_in_user_group with null days and value", async () => {
        await expect(
            validateBoardsInitialFilter.validateAsync({ ...BASE_VALID, days: null, value: null }),
        ).resolves.toBeDefined();
    });

    it("accepts logged_in_user_group with undefined days and value", async () => {
        const { days, value, ...rest } = BASE_VALID;
        await expect(validateBoardsInitialFilter.validateAsync(rest)).resolves.toBeDefined();
    });

    it("does not require days field when function_type is logged_in_user_group", async () => {
        const payload = { ...BASE_VALID };
        delete payload.days;
        await expect(validateBoardsInitialFilter.validateAsync(payload)).resolves.toBeDefined();
    });

    it("does not require value field when function_type is logged_in_user_group", async () => {
        const payload = { ...BASE_VALID };
        delete payload.value;
        await expect(validateBoardsInitialFilter.validateAsync(payload)).resolves.toBeDefined();
    });

    it("rejects FUNCIONES without function_type", async () => {
        const { function_type, ...rest } = BASE_VALID;
        await expect(validateBoardsInitialFilter.validateAsync(rest)).rejects.toBeDefined();
    });

    it("rejects unknown function_type", async () => {
        await expect(
            validateBoardsInitialFilter.validateAsync({ ...BASE_VALID, function_type: "unknown_function" }),
        ).rejects.toBeDefined();
    });
});

describe("validateBoardsInitialFilter — logged_in_user (parity check)", () => {
    it("accepts logged_in_user with empty days and value", async () => {
        await expect(
            validateBoardsInitialFilter.validateAsync({
                ...BASE_VALID,
                field: "responsable_id",
                function_type: "logged_in_user",
            }),
        ).resolves.toBeDefined();
    });
});

describe("validateBoardsInitialFilter — date functions require days", () => {
    it("rejects date_calculated_add without days", async () => {
        const payload = {
            related_entity: "casos",
            field: "fecha_creacion",
            operator: "gt",
            comparison_type: "FUNCIONES",
            function_type: "date_calculated_add",
            days: "",
            value: "",
            type: "and",
        };
        await expect(validateBoardsInitialFilter.validateAsync(payload)).rejects.toBeDefined();
    });

    it("accepts date_calculated_add with valid days", async () => {
        const payload = {
            related_entity: "casos",
            field: "fecha_creacion",
            operator: "gt",
            comparison_type: "FUNCIONES",
            function_type: "date_calculated_add",
            days: "7",
            value: "7",
            type: "and",
        };
        await expect(validateBoardsInitialFilter.validateAsync(payload)).resolves.toBeDefined();
    });
});

describe("validateBoardsInitialFilter — VALUE comparison_type", () => {
    it("accepts VALUE comparison_type with a plain value", async () => {
        const payload = {
            related_entity: "casos",
            field: "estado_id",
            operator: "eq",
            comparison_type: "VALUE",
            value: "some-uuid",
            type: "and",
        };
        await expect(validateBoardsInitialFilter.validateAsync(payload)).resolves.toBeDefined();
    });
});

describe("validateBoardsInitialFilter — FIELD comparison_type", () => {
    it("accepts FIELD comparison_type with field_related_entity", async () => {
        const payload = {
            related_entity: "casos",
            field: "responsable_id",
            operator: "eq",
            comparison_type: "FIELD",
            field_related_entity: "usuarios",
            value: "any",
            type: "and",
        };
        await expect(validateBoardsInitialFilter.validateAsync(payload)).resolves.toBeDefined();
    });

    it("rejects FIELD comparison_type without field_related_entity", async () => {
        const payload = {
            related_entity: "casos",
            field: "responsable_id",
            operator: "eq",
            comparison_type: "FIELD",
            value: "any",
            type: "and",
        };
        await expect(validateBoardsInitialFilter.validateAsync(payload)).rejects.toBeDefined();
    });
});

describe("validateBoardsInitialFilter — active_client", () => {
    it("accepts active_client with empty days and value", async () => {
        await expect(
            validateBoardsInitialFilter.validateAsync({
                ...BASE_VALID,
                field: "cliente_id",
                function_type: "active_client",
            }),
        ).resolves.toBeDefined();
    });

    it("accepts active_client with null days and value", async () => {
        await expect(
            validateBoardsInitialFilter.validateAsync({
                ...BASE_VALID,
                field: "cliente_id",
                function_type: "active_client",
                days: null,
                value: null,
            }),
        ).resolves.toBeDefined();
    });

    it("does not require days or value when function_type is active_client", async () => {
        const payload = {
            ...BASE_VALID,
            field: "cliente_id",
            function_type: "active_client",
        };
        delete payload.days;
        delete payload.value;
        await expect(validateBoardsInitialFilter.validateAsync(payload)).resolves.toBeDefined();
    });
});
