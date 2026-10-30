import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useBannersAction from "./useBannersAction";

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
                "app.forms.error_delete": "No es posible eliminar",
                "app.forms.success_delete_module": "Se eliminó correctamente el registro de {{module}}",
                "app.title.banners": "Banners",
            }),
        }),
    };
});

describe("useBannersAction", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.mutationOptions = undefined;
        mocks.cancelQueries.mockResolvedValue();
    });

    it("confirms the delete with the interpolated module copy", () => {
        renderHook(() => useBannersAction());

        mocks.mutationOptions.onSuccess();

        expect(mocks.invalidateQueries).toHaveBeenCalledWith(["bannersData"]);
        expect(mocks.toastSuccess).toHaveBeenCalledWith("Se eliminó correctamente el registro de Banners");
    });

    it("rolls back the optimistic removal and reports the module in the error copy", async () => {
        const previousGroups = { data: [{ id: "banner-1" }] };
        mocks.getQueryData.mockReturnValue(previousGroups);
        renderHook(() => useBannersAction());

        const context = await mocks.mutationOptions.onMutate("banner-1");
        mocks.mutationOptions.onError(new Error("Network Error"), "banner-1", context);

        expect(context).toEqual({ previousGroups });
        expect(mocks.setQueryData).toHaveBeenLastCalledWith(["bannersData"], previousGroups);
        expect(mocks.toastError).toHaveBeenCalledWith("No es posible eliminar Banners");
    });

    it("preserves edit and read navigation", () => {
        const { result } = renderHook(() => useBannersAction());

        act(() => {
            result.current.handleUpdateBanner("banner-1");
            result.current.handleSeeBanner("banner-1");
        });

        expect(mocks.navigate).toHaveBeenNthCalledWith(1, "/banners/update/banner-1");
        expect(mocks.navigate).toHaveBeenNthCalledWith(2, "/banners/update/banner-1?action=see");
    });
});
