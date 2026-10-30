import { describe, expect, it } from "vitest";

import { isSameBoardOptionRow, upsertOptionRow } from "@kace_v2/features/boards/utils/upsertOptionRow.util";

describe("upsertOptionRow", () => {
    it("no muta rows y anade un ref_id que no esta en la primera pagina", () => {
        const rows = [{ id: "row-1", type: "ACTION", ref_id: "a1" }];

        const updatedRows = upsertOptionRow(
            rows,
            { type: "ACTION", ref_id: "a2-from-search", label: "Nueva" },
            (item, values) => item.ref_id === values.ref_id,
            () => "new-id",
        );

        expect(rows).toEqual([{ id: "row-1", type: "ACTION", ref_id: "a1" }]);
        expect(updatedRows).not.toBe(rows);
        expect(updatedRows).toEqual([
            { id: "row-1", type: "ACTION", ref_id: "a1" },
            { id: "new-id", type: "ACTION", ref_id: "a2-from-search", label: "Nueva" },
        ]);
    });

    it("reemplaza por id sin mutar el array original", () => {
        const rows = [{ id: "row-1", one_script_form_id: "os-1", label: "Vieja" }];

        const updatedRows = upsertOptionRow(
            rows,
            { id: "row-1", one_script_form_id: "os-from-search", label: "Editada" },
            (item, values) => item.id === values.id,
            () => "unused",
        );

        expect(rows[0].one_script_form_id).toBe("os-1");
        expect(updatedRows[0]).toEqual({
            id: "row-1",
            one_script_form_id: "os-from-search",
            label: "Editada",
        });
    });

    it("al editar identifica la fila por id aunque cambie el ref_id", () => {
        const rows = [{ id: "row-1", type: "ACTION", ref_id: "a1", label: "Vieja" }];

        expect(isSameBoardOptionRow(rows[0], { id: "row-1", type: "ACTION", ref_id: "a2" })).toBe(true);
        expect(isSameBoardOptionRow(rows[0], { type: "ACTION", ref_id: "a2" })).toBe(false);

        const updatedRows = upsertOptionRow(
            rows,
            { id: "row-1", type: "ACTION", ref_id: "a2", label: "Editada" },
            isSameBoardOptionRow,
            () => "new-id",
        );

        expect(updatedRows).toHaveLength(1);
        expect(updatedRows[0]).toEqual({
            id: "row-1",
            type: "ACTION",
            ref_id: "a2",
            label: "Editada",
        });
    });
});
