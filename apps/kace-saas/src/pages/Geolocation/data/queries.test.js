import { describe, expect, it } from "vitest";
import { filterUserByGroup } from "./queries";

describe("filterUserByGroup", () => {
    it("matches grupo_id with eq", () => {
        expect(filterUserByGroup("group-uuid").filter).toEqual([
            {
                field: "rel_usuarios_grupos.grupo_id",
                operator: "eq",
                value: "group-uuid",
                type: "AND",
            },
        ]);
    });
});
