import { describe, it, expect } from "vitest";
import { validateBoardsDetails } from "@kace_v2/features/boards/schemas/boards.schema";

const baseValid = {
    name: "Tablero",
    description: "Descripcion",
    primary_entity: "cases",
    page_size: 25,
    onescript_form_id: "00000000-0000-4000-8000-000000000000",
    filter_onescript_id: null,
    icon_class: "Activity",
    access_groups: [],
    access_users: [],
    criteria: { items: [{}] },
    relations: [],
    columns: [{}],
    options: [],
    orders: [],
    havings: [],
};

const validate = (overrides) => validateBoardsDetails.validate({ ...baseValid, ...overrides }, { abortEarly: false });

describe("validateBoardsDetails — quick_ans_filter", () => {
    describe("ans_column_alias", () => {
        it("requires ans_column_alias when enabled=true", () => {
            const { error } = validate({
                quick_ans_filter: {
                    enabled: true,
                    ans_column_alias: "",
                    labels: { 1: "", 2: "", 3: "" },
                    use_default_colors: true,
                    colors: { 1: "", 2: "", 3: "" },
                },
            });
            expect(error).toBeDefined();
            expect(error.details.some((d) => d.path.join(".") === "quick_ans_filter.ans_column_alias")).toBe(true);
        });

        it("accepts ans_column_alias present when enabled=true", () => {
            const { error } = validate({
                quick_ans_filter: {
                    enabled: true,
                    ans_column_alias: "ans_alias",
                    labels: { 1: "", 2: "", 3: "" },
                    use_default_colors: true,
                    colors: { 1: "", 2: "", 3: "" },
                },
            });
            expect(error).toBeUndefined();
        });

        it("does not require ans_column_alias when enabled=false", () => {
            const { error } = validate({
                quick_ans_filter: {
                    enabled: false,
                    ans_column_alias: "",
                    labels: { 1: "", 2: "", 3: "" },
                    use_default_colors: true,
                    colors: { 1: "", 2: "", 3: "" },
                },
            });
            expect(error).toBeUndefined();
        });
    });

    describe("labels all-or-none", () => {
        it("rejects partial labels when enabled=true", () => {
            const { error } = validate({
                quick_ans_filter: {
                    enabled: true,
                    ans_column_alias: "ans_alias",
                    labels: { 1: "En tiempo", 2: "", 3: "" },
                    use_default_colors: true,
                    colors: { 1: "", 2: "", 3: "" },
                },
            });
            expect(error).toBeDefined();
            const labelsError = error.details.find((d) => d.path.join(".") === "quick_ans_filter.labels");
            expect(labelsError).toBeDefined();
            expect(labelsError.message).toBe("quickAnsLabelsAllRequired");
        });

        it("accepts all labels filled when enabled=true", () => {
            const { error } = validate({
                quick_ans_filter: {
                    enabled: true,
                    ans_column_alias: "ans_alias",
                    labels: { 1: "A", 2: "B", 3: "C" },
                    use_default_colors: true,
                    colors: { 1: "", 2: "", 3: "" },
                },
            });
            expect(error).toBeUndefined();
        });

        it("accepts all labels empty when enabled=true", () => {
            const { error } = validate({
                quick_ans_filter: {
                    enabled: true,
                    ans_column_alias: "ans_alias",
                    labels: { 1: "", 2: "", 3: "" },
                    use_default_colors: true,
                    colors: { 1: "", 2: "", 3: "" },
                },
            });
            expect(error).toBeUndefined();
        });

        it("allows partial labels when enabled=false", () => {
            const { error } = validate({
                quick_ans_filter: {
                    enabled: false,
                    ans_column_alias: "",
                    labels: { 1: "Solo una", 2: "", 3: "" },
                    use_default_colors: true,
                    colors: { 1: "", 2: "", 3: "" },
                },
            });
            expect(error).toBeUndefined();
        });

        it("treats whitespace-only labels as empty for the all-or-none rule", () => {
            const { error } = validate({
                quick_ans_filter: {
                    enabled: true,
                    ans_column_alias: "ans_alias",
                    labels: { 1: "Llena", 2: "   ", 3: "   " },
                    use_default_colors: true,
                    colors: { 1: "", 2: "", 3: "" },
                },
            });
            expect(error).toBeDefined();
            const labelsError = error.details.find((d) => d.path.join(".") === "quick_ans_filter.labels");
            expect(labelsError?.message).toBe("quickAnsLabelsAllRequired");
        });
    });
});

describe("validateBoardsDetails — display_order", () => {
    it("is optional: the field may be absent", () => {
        const { error } = validate({});
        expect(error).toBeUndefined();
    });

    it.each([
        ["", "empty string"],
        [null, "null"],
    ])("treats %p (%s) as no order assigned", (input) => {
        const { error, value } = validate({ display_order: input });
        expect(error).toBeUndefined();
        expect(value.display_order).toBeUndefined();
    });

    it("accepts a valid position", () => {
        const { error, value } = validate({ display_order: 5 });
        expect(error).toBeUndefined();
        expect(value.display_order).toBe(5);
    });

    const expectDisplayOrderError = (input) => {
        const { error } = validate({ display_order: input });
        expect(error).toBeDefined();
        expect(error.details.some((d) => d.path.join(".") === "display_order")).toBe(true);
    };

    it("rejects 0 because positions start at 1", () => {
        expectDisplayOrderError(0);
    });

    it("rejects decimals", () => {
        expectDisplayOrderError(1.5);
    });

    it("rejects values above the upper bound, which would overflow the int4 column", () => {
        expectDisplayOrderError(10000);
        expectDisplayOrderError(2147483648);
    });
});
