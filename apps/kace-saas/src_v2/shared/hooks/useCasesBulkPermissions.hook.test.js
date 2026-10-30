import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import useUserInformation from "@kace/hooks/useUserInformation";
import useCasesBulkPermissions from "./useCasesBulkPermissions.hook";

vi.mock("@kace/hooks/useUserInformation", () => ({ default: vi.fn() }));

const perm = (module_id, name, granted = true) => ({ module_id, name, granted });

const render = (scope, { permissionsAdmin = [], permissionsAgent = [] } = {}) => {
    useUserInformation.mockReturnValue({ permissionsAdmin, permissionsAgent });
    return renderHook(() => useCasesBulkPermissions(scope)).result.current;
};

describe("useCasesBulkPermissions", () => {
    beforeEach(() => vi.clearAllMocks());

    it("denies everything without permissions", () => {
        expect(render("admin")).toEqual({
            canUpdateBoardRegister: false,
            canBulkClose: false,
            canBulkTransition: false,
            canBulkAssign: false,
        });
    });

    it.each([
        ["CasesBulkClose", "canBulkClose"],
        ["CasesBulkTransition", "canBulkTransition"],
        ["CasesBulkAssign", "canBulkAssign"],
    ])("grants %s from administrador/cases", (name, flag) => {
        expect(render("agent", { permissionsAdmin: [perm("cases", name)] })[flag]).toBe(true);
    });

    it("ignores bulk permissions that are present but not granted", () => {
        expect(render("admin", { permissionsAdmin: [perm("cases", "CasesBulkClose", false)] }).canBulkClose).toBe(
            false,
        );
    });

    it("ignores bulk permission names under the agent list", () => {
        expect(render("agent", { permissionsAgent: [perm("cases", "CasesBulkClose")] }).canBulkClose).toBe(false);
    });

    it("reads BoardsUpdateRegister from the scoped list", () => {
        const register = [perm("boards", "BoardsUpdateRegister")];
        expect(render("admin", { permissionsAdmin: register }).canUpdateBoardRegister).toBe(true);
        expect(render("agent", { permissionsAgent: register }).canUpdateBoardRegister).toBe(true);
        expect(render("agent", { permissionsAdmin: register }).canUpdateBoardRegister).toBe(false);
    });
});
