import { describe, expect, it } from "vitest";
import { mapRelatedUsersToListValues } from "./mapRelatedUsersToListValues";

describe("mapRelatedUsersToListValues", () => {
    it("maps membership rows to multiselect list values", () => {
        expect(
            mapRelatedUsersToListValues([
                { usuario_id: "u-1", nombre: "Ana" },
                { usuario_id: "u-2", nombre: "Luis" },
            ]),
        ).toEqual([
            { id: "u-1", label: "Ana" },
            { id: "u-2", label: "Luis" },
        ]);
    });

    it("returns empty array when memberships are empty so stale chips clear", () => {
        expect(mapRelatedUsersToListValues([])).toEqual([]);
    });

    it("returns empty array when memberships are missing", () => {
        expect(mapRelatedUsersToListValues(undefined)).toEqual([]);
        expect(mapRelatedUsersToListValues(null)).toEqual([]);
    });

    it("skips rows without usuario_id", () => {
        expect(mapRelatedUsersToListValues([{ usuario_id: "u-1", nombre: "Ana" }, { nombre: "Sin id" }, null])).toEqual(
            [{ id: "u-1", label: "Ana" }],
        );
    });
});
