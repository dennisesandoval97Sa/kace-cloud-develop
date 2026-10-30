import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useActionsGroup from "./useActionsGroup";

const mocks = vi.hoisted(() => ({
    cancelQueries: vi.fn(),
    getQueryData: vi.fn(),
    setQueryData: vi.fn(),
    invalidateQueries: vi.fn(),
    removeQueries: vi.fn(),
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
        removeQueries: mocks.removeQueries,
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

vi.mock("@/utils/main", () => ({
    apiService: { get: vi.fn() },
}));

vi.mock("react-i18next", async () => {
    const { createTranslateMock } = await import("@/test-utils/i18n");

    return {
        useTranslation: () => ({
            t: createTranslateMock({
                "app.forms.success_delete_module": "Se eliminó correctamente el registro de {{module}}",
                "app.title.group_singular": "Grupo",
            }),
        }),
    };
});

describe("useActionsGroup", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.mutationOptions = undefined;
        mocks.cancelQueries.mockResolvedValue();
    });

    it("confirms the delete with the interpolated module copy", () => {
        renderHook(() => useActionsGroup());

        mocks.mutationOptions.onSuccess(undefined, "group-1");

        expect(mocks.invalidateQueries).toHaveBeenCalledWith(["groupsData"]);
        expect(mocks.removeQueries).toHaveBeenCalledWith({ queryKey: ["usersByGroup", "group-1"] });
        expect(mocks.toastSuccess).toHaveBeenCalledWith("Se eliminó correctamente el registro de Grupo");
    });

    it("rolls back the optimistic removal and reports the error copy", async () => {
        const previousGroups = { data: [{ id: "group-1" }] };
        mocks.getQueryData.mockReturnValue(previousGroups);
        renderHook(() => useActionsGroup());

        const context = await mocks.mutationOptions.onMutate("group-1");
        mocks.mutationOptions.onError(new Error("Network Error"), "group-1", context);

        expect(context).toEqual({ previousGroups });
        expect(mocks.setQueryData).toHaveBeenLastCalledWith(["groupsData"], previousGroups);
        expect(mocks.toastError).toHaveBeenCalledWith("Network Error");
    });

    it("preserves edit and read navigation while dropping the membership cache", () => {
        const { result } = renderHook(() => useActionsGroup());

        act(() => {
            result.current.handleUpdateGroup("group-1");
            result.current.handleSeeGroup("group-1");
        });

        expect(mocks.removeQueries).toHaveBeenCalledWith({ queryKey: ["usersByGroup", "group-1"] });
        expect(mocks.navigate).toHaveBeenNthCalledWith(1, "/group/update/group-1");
        expect(mocks.navigate).toHaveBeenNthCalledWith(2, "/group/update/group-1?action=see");
    });
});
