import { describe, expect, it } from "vitest";
import { buildAvailableTemplateIds, getTemplateRelationChanges } from "./templateRelations";

describe("buildAvailableTemplateIds", () => {
    it("unions seed ids with selected ids without duplicates", () => {
        expect(buildAvailableTemplateIds(["seed-a", "seed-b"], [{ id: "seed-b" }, { id: "selected-c" }])).toEqual([
            "seed-a",
            "seed-b",
            "selected-c",
        ]);
    });

    it("ignores selected entries without id", () => {
        expect(buildAvailableTemplateIds(["seed-a"], [{ id: "" }, {}])).toEqual(["seed-a"]);
    });
});

describe("getTemplateRelationChanges", () => {
    it("preserves relations to templates that are unavailable in the selector", () => {
        const changes = getTemplateRelationChanges({
            persistedTemplateIds: ["available-a", "unavailable-b"],
            selectedTemplates: [{ id: "available-a" }],
            availableTemplateIds: ["available-a"],
        });

        expect(changes).toEqual({
            templateIdsToAdd: [],
            templateIdsToRemove: [],
        });
    });

    it("removes a preloaded seed id when the user deselects it", () => {
        const availableTemplateIds = buildAvailableTemplateIds(["seed-a", "seed-b"], [{ id: "seed-a" }]);
        const changes = getTemplateRelationChanges({
            persistedTemplateIds: ["seed-a", "seed-b"],
            selectedTemplates: [{ id: "seed-a" }],
            availableTemplateIds,
        });

        expect(changes).toEqual({
            templateIdsToAdd: [],
            templateIdsToRemove: ["seed-b"],
        });
    });

    it("adds newly selected templates not in persisted", () => {
        const availableTemplateIds = buildAvailableTemplateIds(["seed-a"], [{ id: "seed-a" }, { id: "new-c" }]);
        const changes = getTemplateRelationChanges({
            persistedTemplateIds: ["seed-a"],
            selectedTemplates: [{ id: "seed-a" }, { id: "new-c" }],
            availableTemplateIds,
        });

        expect(changes).toEqual({
            templateIdsToAdd: ["new-c"],
            templateIdsToRemove: [],
        });
    });
});
