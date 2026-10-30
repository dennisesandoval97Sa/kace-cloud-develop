import { describe, expect, it } from "vitest";
import en from "./en.json";
import es from "./es.json";

const RAW_PERMISSION_NAMES = ["CasesBulkClose", "CasesBulkAssign", "CasesBulkTransition", "BoardsUpdateRegister"];

const LABEL_KEYS = [
    "permissionCasesBulkClose",
    "permissionCasesBulkAssign",
    "permissionCasesBulkTransition",
    "permissionBoardsUpdateRegister",
];

describe("bulk permission toast labels", () => {
    it.each([
        ["es", es],
        ["en", en],
    ])("%s labels are translated copy without raw permission names or module prefixes", (_localeName, locale) => {
        const bulk = locale.boards.bulkActions;

        for (const key of LABEL_KEYS) {
            const label = bulk[key];
            expect(label).toEqual(expect.any(String));
            expect(label).not.toMatch(/^\s*$/);
            expect(label).not.toMatch(/casos\s*—/i);
            expect(label).not.toMatch(/cases\s*—/i);
            expect(label).not.toMatch(/tableros\s*—/i);
            expect(label).not.toMatch(/boards\s*—/i);
            for (const rawName of RAW_PERMISSION_NAMES) {
                expect(label).not.toContain(rawName);
            }
        }
    });

    it("uses the product wording for bulk close", () => {
        expect(es.boards.bulkActions.permissionCasesBulkClose).toBe("Cerrar casos masivamente");
        expect(en.boards.bulkActions.permissionCasesBulkClose).toBe("Bulk close cases");
    });
});
