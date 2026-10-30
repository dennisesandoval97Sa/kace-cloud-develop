import { describe, expect, it } from "vitest";
import { WorkspaceSchemaForm } from "@/schemas/WorkspaceSchema";
import { isRuleRowComplete, isRuleRowEmpty, ruleRowsSignature } from "./workspaceRules";

const blankCells = ["", null, undefined];
const filledCells = { field: "subject", operator: "contains", value: "abcd" };
const columns = Object.keys(filledCells);

// Every combination of blank ("", null, undefined) and filled cells.
const allRows = columns.reduce(
    (rows, column) =>
        rows.flatMap((row) => [...blankCells, filledCells[column]].map((cell) => ({ ...row, [column]: cell }))),
    [{}],
);
const isFilled = (row, column) => row[column] === filledCells[column];

describe("isRuleRowEmpty / isRuleRowComplete", () => {
    it.each(allRows)("classifies the row %j by its filled cells", (row) => {
        const filledCount = columns.filter((column) => isFilled(row, column)).length;

        expect(isRuleRowEmpty(row)).toBe(filledCount === 0);
        expect(isRuleRowComplete(row)).toBe(filledCount === columns.length);
    });

    it("treats a missing row as empty", () => {
        expect(isRuleRowEmpty(undefined)).toBe(true);
        expect(isRuleRowComplete(undefined)).toBe(false);
    });
});

describe("WorkspaceSchemaForm rule rows", () => {
    const tableRules = WorkspaceSchemaForm.extract("tableRules");

    it.each(allRows)("accepts the row %j only when it is empty or complete", (row) => {
        const { error } = tableRules.validate([row], { context: { keepPersistedRules: false } });

        expect(error === undefined).toBe(isRuleRowEmpty(row) || isRuleRowComplete(row));
    });
});

describe("ruleRowsSignature", () => {
    it("ignores fully empty rows whatever their blank cells are", () => {
        const rows = [{ field: "", operator: null, value: undefined }, filledCells];

        expect(ruleRowsSignature(rows)).toBe(ruleRowsSignature([filledCells]));
    });

    it("gives null, undefined and empty cells the same signature", () => {
        const persisted = [{ field: "subject", operator: "contains", value: null }];

        expect(ruleRowsSignature([{ ...persisted[0], value: "" }])).toBe(ruleRowsSignature(persisted));
        expect(ruleRowsSignature([{ ...persisted[0], value: undefined }])).toBe(ruleRowsSignature(persisted));
    });

    it("counts a partially filled row as a change", () => {
        expect(ruleRowsSignature([{ field: "subject", operator: "", value: "" }])).not.toBe(ruleRowsSignature([]));
    });

    it("treats missing rows as no rules", () => {
        expect(ruleRowsSignature(undefined)).toBe(ruleRowsSignature([]));
    });
});

/*
 * Falsy non-string cells (0, false) are coerced to string by ruleCells so the predicates
 * stay in lockstep with WorkspaceSchemaForm's `Joi.string().required()`, which rejects them.
 */
describe("isRuleRowEmpty / isRuleRowComplete with falsy non-string cells", () => {
    it.each([{ field: 0 }, { operator: false }, { value: 0 }, { field: false, value: 0 }])(
        "treats the falsy non-string row %j as not empty and not complete",
        (row) => {
            expect(isRuleRowEmpty(row)).toBe(false);
            expect(isRuleRowComplete(row)).toBe(false);

            const { error } = WorkspaceSchemaForm.extract("tableRules").validate([row], {
                context: { keepPersistedRules: false },
            });
            expect(error).toBeDefined();
        },
    );

    it("counts a legacy row with value: 0 as a change", () => {
        const persisted = [{ field: "subject", operator: "contains", value: 0 }];
        const sameWithString = [{ field: "subject", operator: "contains", value: "0" }];

        expect(ruleRowsSignature(persisted)).toBe(ruleRowsSignature(sameWithString));
        expect(ruleRowsSignature(persisted)).not.toBe(ruleRowsSignature([]));
    });
});
