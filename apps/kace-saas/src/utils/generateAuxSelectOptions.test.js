import { describe, it, expect, vi, beforeEach } from "vitest";
import { toast } from "sonner";
import { generateAuxSelectOptions } from "./generateAuxSelectOptions";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const schemaWith = (data_structure) => ({ id: "schema-1", data_structure });

const valuesOf = (schema, model = "aux_cases", filterFn) =>
    generateAuxSelectOptions(schema, (key) => key, model, filterFn).map((option) => option.value);

describe("generateAuxSelectOptions", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns an empty list for an invalid schema", () => {
        expect(generateAuxSelectOptions(null)).toEqual([]);
        expect(generateAuxSelectOptions({})).toEqual([]);
        expect(generateAuxSelectOptions({ id: "schema-1" })).toEqual([]);
    });

    it("flattens plain object paths", () => {
        const schema = schemaWith({
            address: { type: "object", data_structure: { street: { type: "string" } } },
            city: { type: "string" },
        });

        expect(valuesOf(schema)).toEqual(["aux_cases.address.street", "aux_cases.city"]);
    });

    it("does not emit the object nodes themselves as selectable fields", () => {
        const schema = schemaWith({
            address: { type: "object", data_structure: { street: { type: "string" } } },
        });

        expect(valuesOf(schema)).not.toContain("aux_cases.address");
    });

    it("flattens array paths and emits options for array items by default", () => {
        const schema = schemaWith({
            city: { type: "string" },
            elements: {
                type: "array",
                data_structure: {
                    prop1: { type: "string" },
                },
            },
        });

        expect(valuesOf(schema)).toEqual(["aux_cases.city", "aux_cases.elements.prop1"]);
    });

    it("handles nested objects inside arrays (cameFromArray hoisting)", () => {
        const schema = schemaWith({
            elements: {
                type: "array",
                data_structure: {
                    details: {
                        type: "object",
                        data_structure: {
                            title: { type: "string" },
                        },
                    },
                },
            },
        });

        expect(valuesOf(schema)).toEqual(["aux_cases.elements.details.title"]);
    });

    it("ignores properties of type array when includeArrays is false", () => {
        const schema = schemaWith({
            city: { type: "string" },
            elements: {
                type: "array",
                data_structure: {
                    prop1: { type: "string" },
                },
            },
        });

        const values = generateAuxSelectOptions(schema, (key) => key, "aux_cases", { includeArrays: false }).map(
            (option) => option.value,
        );

        expect(values).toEqual(["aux_cases.city"]);
    });

    it("ignores an array without a declared item structure", () => {
        expect(valuesOf(schemaWith({ tags: { type: "array" } }))).toEqual([]);
    });

    it("omits the model prefix when none is given", () => {
        const schema = schemaWith({
            address: { type: "object", data_structure: { street: { type: "string" } } },
        });

        expect(valuesOf(schema, "")).toEqual(["address.street"]);
    });

    it("carries the leaf data_type and a stable id", () => {
        const schema = schemaWith({
            address: { type: "object", data_structure: { street: { type: "number" } } },
        });

        expect(generateAuxSelectOptions(schema, (key) => key, "aux_cases")).toEqual([
            {
                value: "aux_cases.address.street",
                label: "aux_cases.address.street",
                id: "schema-1_address.street",
                data_type: "number",
            },
        ]);
    });

    it("applies filterFn to the leaf definitions", () => {
        const schema = schemaWith({
            address: {
                type: "object",
                data_structure: {
                    street: { type: "string" },
                    number: { type: "number" },
                },
            },
        });

        expect(valuesOf(schema, "aux_cases", (field) => field.type === "number")).toEqual(["aux_cases.address.number"]);
    });

    it("stops descending past the depth limit", () => {
        let structure = { leaf: { type: "string" } };
        for (let level = 0; level < 12; level++) {
            structure = { [`n${level}`]: { type: "object", data_structure: structure } };
        }

        expect(valuesOf(schemaWith(structure))).toEqual([]);
    });

    it("recovers via toast.error and returns [] when traversal throws", () => {
        const schema = {
            id: "schema-1",
            get data_structure() {
                throw new Error("boom");
            },
        };
        const t = vi.fn().mockReturnValue("translated-error-key");

        expect(generateAuxSelectOptions(schema, t, "aux_cases")).toEqual([]);
        expect(t).toHaveBeenCalledWith("app.alerts.auxOptionsError");
        expect(toast.error).toHaveBeenCalledWith("translated-error-key", { id: "auxOptionsError" });
    });

    it("applies filterFn together with includeArrays:false", () => {
        const schema = schemaWith({
            elements: {
                type: "array",
                data_structure: {
                    label: { type: "string" },
                    count: { type: "number" },
                },
            },
        });
        const onlyNumbers = (field) => field.type === "number";

        expect(
            generateAuxSelectOptions(schema, (key) => key, "aux_cases", onlyNumbers).map((option) => option.value),
        ).toEqual(["aux_cases.elements.count"]);
        expect(
            generateAuxSelectOptions(schema, (key) => key, "aux_cases", onlyNumbers, { includeArrays: false }),
        ).toEqual([]);
    });
});
