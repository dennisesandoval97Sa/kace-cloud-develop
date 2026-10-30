import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useRestFlowsActions from "./useRestFlowsActions";

const mocks = vi.hoisted(() => ({
    cancelQueries: vi.fn(),
    getQueryData: vi.fn(),
    setQueryData: vi.fn(),
    invalidateQueries: vi.fn(),
    mutate: vi.fn(),
    navigate: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
    mutationOptions: undefined,
}));

vi.mock("@tanstack/react-query", () => ({
    useQueryClient: () => ({
        cancelQueries: mocks.cancelQueries,
        getQueryData: mocks.getQueryData,
        setQueryData: mocks.setQueryData,
        invalidateQueries: mocks.invalidateQueries,
    }),
    useMutation: (options) => {
        mocks.mutationOptions = options;

        return { mutate: mocks.mutate, isPending: false };
    },
}));

vi.mock("react-router-dom", () => ({
    useNavigate: () => mocks.navigate,
}));

vi.mock("sonner", () => ({
    toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

vi.mock("@/services/deleteService", () => ({
    fetchDelete: vi.fn(),
}));

vi.mock("react-i18next", async () => {
    const { createTranslateMock } = await import("@/test-utils/i18n");

    return {
        useTranslation: () => ({
            t: createTranslateMock({
                "app.error.restFlow": "No es posible eliminar el rest flow",
                "app.forms.success_delete_module": "Se eliminó correctamente el registro de {{module}}",
                "app.title.restFlow": "Flujo rest",
            }),
        }),
    };
});

describe("useRestFlowsActions", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.mutationOptions = undefined;
        mocks.cancelQueries.mockResolvedValue();
    });

    it("confirms the delete with the interpolated module copy", () => {
        renderHook(() => useRestFlowsActions());

        mocks.mutationOptions.onSuccess();

        expect(mocks.invalidateQueries).toHaveBeenCalledWith(["wsRestFlowsData"]);
        expect(mocks.toastSuccess).toHaveBeenCalledWith("Se eliminó correctamente el registro de Flujo rest");
    });

    it("rolls back the optimistic removal when the delete fails", async () => {
        const previousGroups = { data: [{ id: "flow-1" }] };
        mocks.getQueryData.mockReturnValue(previousGroups);
        renderHook(() => useRestFlowsActions());

        const context = await mocks.mutationOptions.onMutate("flow-1");
        mocks.mutationOptions.onError(new Error("Network Error"), "flow-1", context);

        expect(context).toEqual({ previousGroups });
        expect(mocks.setQueryData).toHaveBeenLastCalledWith(["wsRestFlowsData"], previousGroups);
        expect(mocks.toastError).toHaveBeenCalledWith("No es posible eliminar el rest flow");
    });

    it("preserves edit and read navigation", () => {
        const { result } = renderHook(() => useRestFlowsActions());

        act(() => {
            result.current.handleUpdateRestFlow("flow-1");
            result.current.handleSeeRestFlow("flow-1");
        });

        expect(mocks.navigate).toHaveBeenNthCalledWith(1, "/rest-flows/update/flow-1");
        expect(mocks.navigate).toHaveBeenNthCalledWith(2, "/rest-flows/update/flow-1?action=see");
    });
});
