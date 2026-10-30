import { describe, expect, it, vi } from "vitest";
import { createCaseAction } from "./openCaseAction";

describe("createCaseAction", () => {
    it("carries the source interaction id into the agent case creation URL", () => {
        const dispatch = vi.fn();
        const navigate = vi.fn();

        createCaseAction({
            dispatch,
            navigate,
            clientId: "client-1",
            canCreateSubcases: true,
            interactionId: "interaction-1",
        });

        expect(navigate).toHaveBeenCalledWith(
            "/agent/create/client-1?action=create&parent_id=null&interaction_id=interaction-1",
        );
    });

    it("preserves the existing case creation URL when there is no source interaction", () => {
        const dispatch = vi.fn();
        const navigate = vi.fn();

        createCaseAction({
            dispatch,
            navigate,
            clientId: "client-1",
            canCreateSubcases: false,
        });

        expect(navigate).toHaveBeenCalledWith("/agent/create/client-1?action=create");
    });
});
