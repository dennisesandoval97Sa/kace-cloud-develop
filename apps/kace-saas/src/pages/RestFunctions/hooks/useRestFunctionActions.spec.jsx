import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useRestFunctionActions from "./useRestFunctionActions";

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
                "app.error.restFunction": "No es posible eliminar la función rest",
                "app.forms.success_delete_module": "Se eliminó correctamente el registro de {{module}}",
                "app.title.restFunction": "Función rest",
            }),
        }),
    };
});

describe("useRestFunctionActions", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.mutationOptions = undefined;
        mocks.cancelQueries.mockResolvedValue();
    });

    it("confirms the delete with the interpolated module copy", () => {
        renderHook(() => useRestFunctionActions());

        mocks.mutationOptions.onSuccess();

        expect(mocks.invalidateQueries).toHaveBeenCalledWith(["wsRestFunctionsData"]);
        expect(mocks.toastSuccess).toHaveBeenCalledWith("Se eliminó correctamente el registro de Función rest");
    });

    it("rolls back the optimistic removal when the delete fails", async () => {
        const previousGroups = { data: [{ id: "function-1" }] };
        mocks.getQueryData.mockReturnValue(previousGroups);
        renderHook(() => useRestFunctionActions());

        const context = await mocks.mutationOptions.onMutate("function-1");
        mocks.mutationOptions.onError(new Error("Network Error"), "function-1", context);

        expect(context).toEqual({ previousGroups });
        expect(mocks.setQueryData).toHaveBeenLastCalledWith(["wsRestFunctionsData"], previousGroups);
        expect(mocks.toastError).toHaveBeenCalledWith("No es posible eliminar la función rest");
    });

    it("preserves edit and read navigation", () => {
        const { result } = renderHook(() => useRestFunctionActions());

        act(() => {
            result.current.handleUpdateRestFunction("function-1");
            result.current.handleSeeRestFunction("function-1");
        });

        expect(mocks.navigate).toHaveBeenNthCalledWith(1, "/rest-functions/update/function-1");
        expect(mocks.navigate).toHaveBeenNthCalledWith(2, "/rest-functions/update/function-1?action=see");
    });
});
