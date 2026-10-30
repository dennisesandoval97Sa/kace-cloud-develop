import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import AdminCaseOneScript from "./AdminCaseOneScript";

const mockUseAdminCaseParams = vi.fn();
const mockUseOneScriptIframeHandshake = vi.fn();

vi.mock("./AdminCaseCardModules", () => ({
    AdminCaseCardModules: () => null,
}));

vi.mock("@kace_v2/shared/hooks/useOneScriptIframeHandshake", () => ({
    useOneScriptIframeHandshake: (...args) => mockUseOneScriptIframeHandshake(...args),
}));

vi.mock("@kace_v2/shared/hooks/useOneScriptHandshakeConfig", () => ({
    useOneScriptHandshakeConfig: () => ({ baseParams: {}, handshakeTokens: {} }),
}));

vi.mock("../hooks/useAdminCaseParams", () => ({
    default: () => mockUseAdminCaseParams(),
}));

vi.mock("../hooks/useAdminCaseCacheData", () => ({
    default: () => ({ caseCacheData: null }),
}));

const renderWithView = ({ isAdmin, urlQueryParams = {} }) => {
    mockUseAdminCaseParams.mockReturnValue({
        caseId: "case-1",
        roleNamespace: isAdmin ? "administrador" : "agente",
        urlQueryParams,
    });
    render(<AdminCaseOneScript oneScriptUrl="https://onescript.test/form" />);
    return mockUseOneScriptIframeHandshake.mock.lastCall[1].params;
};

describe("AdminCaseOneScript — role_namespace del handshake", () => {
    beforeEach(() => {
        mockUseOneScriptIframeHandshake.mockClear();
    });

    it("envía role_namespace 'agente' en la vista de agente (/agent/update)", () => {
        expect(renderWithView({ isAdmin: false }).role_namespace).toBe("agente");
    });

    it("envía role_namespace 'administrador' en la vista de administrador (/cases/update)", () => {
        expect(renderWithView({ isAdmin: true }).role_namespace).toBe("administrador");
    });

    it("un query param de la URL no puede sobrescribir role_namespace", () => {
        const params = renderWithView({ isAdmin: false, urlQueryParams: { role_namespace: "administrador" } });

        expect(params.role_namespace).toBe("agente");
    });
});
