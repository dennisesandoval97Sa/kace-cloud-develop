import { describe, expect, it } from "vitest";
import { BrokerMapperCreateSchema } from "./BrokerMapperSchema";

describe("BrokerMapperCreateSchema", () => {
    it("reports a blank name as required", () => {
        const { error } = BrokerMapperCreateSchema.validate({
            name: "",
            rest_flow_id: "cases-flow",
            rules: [],
        });

        expect(error?.details).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    path: ["name"],
                    type: "any.required",
                }),
            ]),
        );
    });

    it("requires a REST flow", () => {
        const { error } = BrokerMapperCreateSchema.validate({
            name: "Cases mapper",
            rest_flow_id: "",
            rules: [],
        });

        expect(error?.details).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    path: ["rest_flow_id"],
                    type: "any.required",
                }),
            ]),
        );
    });

    it("requires every added rule to be complete", () => {
        const { error } = BrokerMapperCreateSchema.validate(
            {
                name: "Cases mapper",
                rest_flow_id: "cases-flow",
                rules: [
                    {
                        target_entity: "case",
                        target_field: "",
                        source_field: "",
                    },
                ],
            },
            { abortEarly: false },
        );

        expect(error?.details).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    path: ["rules", 0, "target_field"],
                    type: "any.required",
                }),
                expect.objectContaining({
                    path: ["rules", 0, "source_field"],
                    type: "any.required",
                }),
            ]),
        );
    });

    it("accepts the form shape with optional blank fields and zero rules", () => {
        const { error, value } = BrokerMapperCreateSchema.validate({
            id: "",
            name: "Cases mapper",
            queue: "",
            rest_flow_id: "cases-flow",
            rules: [],
        });

        expect(error).toBeUndefined();
        expect(value.rules).toEqual([]);
    });
});
