import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import Joi from "joi";
import { useSelector } from "react-redux";
import useAgentFormConfig from "./useAgentFormConfig";

vi.mock("react-redux", () => ({ useSelector: vi.fn() }));

const mockClientsConfig = (clients) =>
    useSelector.mockImplementation((selector) => selector({ generalSetup: { configAgent: { clients } } }));

const buildSchema = () =>
    renderHook(() => useAgentFormConfig({ nombres: Joi.string() })).result.current.clientSchemaForm;

describe("useAgentFormConfig", () => {
    beforeEach(() => {
        useSelector.mockReset();
    });

    it("applies the configured min and max length of each client field", () => {
        mockClientsConfig({ fields_max_min: { field_nombres_min: 2, field_nombres_max: 5 } });
        const schema = buildSchema();

        expect(schema.validate({ nombres: "a" }).error?.details[0].type).toBe("string.min");
        expect(schema.validate({ nombres: "abc" }).error).toBeUndefined();
        expect(schema.validate({ nombres: "abcdef" }).error?.details[0].type).toBe("string.max");
    });

    it.each([
        ["empty", ""],
        ["zero", 0],
    ])("treats an %s limit as no limit", (_, limit) => {
        mockClientsConfig({ fields_max_min: { field_nombres_min: limit, field_nombres_max: limit } });

        expect(buildSchema().validate({ nombres: "a".repeat(50) }).error).toBeUndefined();
    });

    it("requires the field when configured as required", () => {
        mockClientsConfig({ fields_required: { field_nombres_required: true } });

        expect(buildSchema().validate({}).error?.details[0].type).toBe("any.required");
    });
});
