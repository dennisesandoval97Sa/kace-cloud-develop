import { describe, expect, it } from "vitest";

import { getClassificationPath } from "./classificationLevels";

describe("getClassificationPath", () => {
    it("prefers the canonical sparse Classification Path over legacy descendants", () => {
        expect(
            getClassificationPath(
                {
                    nivel1: "Level 1",
                    nivel3: "Level 3",
                    nivel6: "Level 6",
                },
                [{ id: "nivel2", label: "Legacy Level 2" }],
            ),
        ).toEqual([
            { id: "nivel1", label: "Level 1", value: "Level 1" },
            { id: "nivel3", label: "Level 3", value: "Level 3" },
            { id: "nivel6", label: "Level 6", value: "Level 6" },
        ]);
    });
});
