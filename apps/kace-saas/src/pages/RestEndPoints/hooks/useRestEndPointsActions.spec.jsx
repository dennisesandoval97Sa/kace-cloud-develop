import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useRestEndpointsActions from "./useRestEndPointsActions";

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
                "app.forms.success_delete_module": "Se eliminó correctamente el registro de {{module}}",
                "app.title.restEndPoint": "Rest endpoint",
                "app.error.restEndPoint": "No es posible eliminar el rest endpoint",
            }),
        }),
    };
});

describe("useRestEndpointsActions", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.mutationOptions = undefined;
        mocks.cancelQueries.mockResolvedValue();
    });

    it("confirms the delete with the interpolated module copy", () => {
        renderHook(() => useRestEndpointsActions());

        mocks.mutationOptions.onSuccess();

        expect(mocks.invalidateQueries).toHaveBeenCalledWith(["wsRestEndpointsData"]);
        expect(mocks.toastSuccess).toHaveBeenCalledWith("Se eliminó correctamente el registro de Rest endpoint");
    });

    it("rolls back the optimistic removal when the delete fails", async () => {
        const previousGroups = { data: [{ id: "endpoint-1" }] };
        mocks.getQueryData.mockReturnValue(previousGroups);
        renderHook(() => useRestEndpointsActions());

        const context = await mocks.mutationOptions.onMutate("endpoint-1");
        mocks.mutationOptions.onError(new Error("Network Error"), "endpoint-1", context);

        expect(context).toEqual({ previousGroups });
        expect(mocks.setQueryData).toHaveBeenLastCalledWith(["wsRestEndpointsData"], previousGroups);
        expect(mocks.toastError).toHaveBeenCalledWith("No es posible eliminar el rest endpoint");
    });

    it("preserves edit and read navigation", () => {
        const { result } = renderHook(() => useRestEndpointsActions());

        act(() => {
            result.current.handleUpdateRestEndpoints("endpoint-1");
            result.current.handleSeeRestEndpoints("endpoint-1");
        });

        expect(mocks.navigate).toHaveBeenNthCalledWith(1, "/rest-endpoints/update/endpoint-1");
        expect(mocks.navigate).toHaveBeenNthCalledWith(2, "/rest-endpoints/update/endpoint-1?action=see");
    });
});
