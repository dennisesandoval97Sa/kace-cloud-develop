import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import useAdminCaseOneScriptKace from "./useAdminCaseOneScriptKace";

const mockUseAdminCaseParams = vi.fn();
const mockUseOneScriptIframeHandshake = vi.fn();

vi.mock("@/pages/Cases/components/AdminCase/hooks/useAdminCaseParams", () => ({
    default: () => mockUseAdminCaseParams(),
}));

vi.mock("@/pages/Cases/components/AdminCase/hooks/useAdminCaseCacheData", () => ({
    default: () => ({ caseCacheData: null }),
}));

vi.mock("@/hooks/useConfigAgentData", () => ({
    default: () => ({ cases: { cases_one_script_base_form: "form-1" } }),
}));

vi.mock("@/hooks/useGenericViewQuery", () => ({
    default: () => ({ data: { url: "https://onescript.test/form" }, isLoading: false }),
}));

vi.mock("@kace_v2/shared/hooks/useOneScriptIframeHandshake", () => ({
    useOneScriptIframeHandshake: (...args) => mockUseOneScriptIframeHandshake(...args),
}));

vi.mock("@kace_v2/shared/hooks/useOneScriptHandshakeConfig", () => ({
    useOneScriptHandshakeConfig: () => ({ baseParams: {}, handshakeTokens: {} }),
}));

const handshakeParamsFor = ({ roleNamespace, urlQueryParams = {} }) => {
    mockUseAdminCaseParams.mockReturnValue({
        caseId: "case-1",
        oneScriptFormId: "form-1",
        roleNamespace,
        urlQueryParams,
    });
    renderHook(() => useAdminCaseOneScriptKace());
    return mockUseOneScriptIframeHandshake.mock.lastCall[1].params;
};

describe("useAdminCaseOneScriptKace — role_namespace del handshake", () => {
    beforeEach(() => {
        mockUseOneScriptIframeHandshake.mockClear();
    });

    it("envía el namespace de la vista de agente", () => {
        expect(handshakeParamsFor({ roleNamespace: "agente" }).role_namespace).toBe("agente");
    });

    it("envía el namespace de la vista de administrador", () => {
        expect(handshakeParamsFor({ roleNamespace: "administrador" }).role_namespace).toBe("administrador");
    });

    it("un query param de la URL no puede sobrescribir role_namespace", () => {
        const params = handshakeParamsFor({
            roleNamespace: "agente",
            urlQueryParams: { role_namespace: "administrador" },
        });

        expect(params.role_namespace).toBe("agente");
    });
});
