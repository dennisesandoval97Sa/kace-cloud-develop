import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useAdminCaseHandleActions from "./useAdminCaseHandleActions";

const mocks = vi.hoisted(() => ({
    mutateAsync: vi.fn(),
    handleCreateDescription: vi.fn(),
    handleGeolocation: vi.fn(),
    handleCacheData: vi.fn(),
    navigateToPath: vi.fn(),
    apiPost: vi.fn(),
    toastError: vi.fn(),
    toastWarning: vi.fn(),
    t: vi.fn((key) => key),
    adminCaseParams: {
        userId: "client-1",
        navigateToPath: vi.fn(),
        extraParam: "create",
        parentId: null,
        interactionId: "interaction-1",
    },
    caseCacheData: {
        cliente_id: "client-1",
        responsable_id: "responsible-1",
        grupo_id: "group-1",
    },
    user: {
        id: "user-1",
        selectedGroup: "group-1",
    },
    configAgent: {
        cases: {
            allow_description_empty: false,
        },
    },
}));

vi.mock("@kace/utils", () => ({
    apiService: {
        post: (...args) => mocks.apiPost(...args),
    },
    removeKey: (data, keys = []) =>
        Object.fromEntries(Object.entries(data ?? {}).filter(([key]) => !keys.includes(key))),
}));

vi.mock("@kace/hooks/useConfigAgentData", () => ({
    default: () => mocks.configAgent,
}));

vi.mock("@kace/hooks/useUserInformation", () => ({
    default: () => ({
        user: mocks.user,
    }),
}));

vi.mock("@kace/hooks/useGeolocation", () => ({
    default: () => ({
        handleGeolocation: mocks.handleGeolocation,
    }),
}));

vi.mock("@kace/hooks/useGeneralMutation", () => ({
    default: () => ({
        mutateAsync: mocks.mutateAsync,
        isPending: false,
    }),
}));

vi.mock("./useAdminCaseParams", () => ({
    default: () => ({
        ...mocks.adminCaseParams,
        navigateToPath: mocks.navigateToPath,
    }),
}));

vi.mock("./useAdminCaseCacheData", () => ({
    default: () => ({
        caseCacheData: mocks.caseCacheData,
        handleCacheData: mocks.handleCacheData,
    }),
}));

vi.mock("./useAdminCaseDescription", () => ({
    default: () => ({
        handleCreateDescription: mocks.handleCreateDescription,
    }),
}));

vi.mock("sonner", () => ({
    toast: {
        error: (...args) => mocks.toastError(...args),
        warning: (...args) => mocks.toastWarning(...args),
    },
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: mocks.t,
    }),
}));

const validValues = {
    id: "case-1",
    cliente_id: "client-1",
    transicion_id: "transition-1",
    clasificacion_id: "classification-1",
    descripcion_caso_id: "description-1",
    descripcion_caso: "<p>Necesita soporte</p>",
    responsable_id: "responsible-1",
    grupo_id: "group-1",
};

describe("useAdminCaseHandleActions", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.adminCaseParams = {
            userId: "client-1",
            navigateToPath: vi.fn(),
            extraParam: "create",
            parentId: null,
            interactionId: "interaction-1",
        };
        mocks.caseCacheData = {
            cliente_id: "client-1",
            responsable_id: "responsible-1",
            grupo_id: "group-1",
        };
        mocks.configAgent = {
            cases: {
                allow_description_empty: false,
            },
        };
        mocks.mutateAsync.mockResolvedValue({ data: { data: { id: "server-case-1" } } });
        mocks.handleCreateDescription.mockResolvedValue(undefined);
        mocks.apiPost.mockResolvedValue({ data: { message: "interaction join cases processed" } });
    });

    it("links a newly saved native case to the source interaction", async () => {
        const { result } = renderHook(() => useAdminCaseHandleActions());

        await act(async () => {
            await result.current.handleSaveCase(validValues);
        });

        expect(mocks.apiPost).toHaveBeenCalledWith("/interactions/interaction-cases", {
            interaction_id: "interaction-1",
            caso_id: "server-case-1",
        });
        expect(mocks.navigateToPath).toHaveBeenCalledWith("client-1");
    });

    it("keeps the saved native case when interaction linking fails", async () => {
        mocks.apiPost.mockRejectedValueOnce(new Error("link failed"));
        const { result } = renderHook(() => useAdminCaseHandleActions());

        await act(async () => {
            await expect(result.current.handleSaveCase(validValues)).resolves.toBeUndefined();
        });

        expect(mocks.mutateAsync).toHaveBeenCalled();
        expect(mocks.toastWarning).toHaveBeenCalledWith("app.alerts.interactionCaseLinkFailed");
        expect(mocks.navigateToPath).toHaveBeenCalledWith("client-1");
    });

    it("uses the latest case configuration when validating an empty description", () => {
        const { result, rerender } = renderHook(() => useAdminCaseHandleActions());

        expect(result.current.isValidDataForm({ ...validValues, descripcion_caso: "" })).toBe(false);
        expect(mocks.toastError).toHaveBeenCalledWith("app.alerts.inputDescription");

        mocks.toastError.mockClear();
        mocks.configAgent = {
            cases: {
                allow_description_empty: true,
            },
        };

        rerender();

        expect(result.current.isValidDataForm({ ...validValues, descripcion_caso: "" })).toBe(true);
        expect(mocks.toastError).not.toHaveBeenCalled();
    });
});
