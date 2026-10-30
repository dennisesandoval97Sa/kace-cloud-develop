import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useFieldModalLiteral from "./useFieldModalLiteral";

/*
 * El hook registra tres mutaciones en orden: crear, actualizar y eliminar.
 * Se capturan sus opciones para poder disparar cada `onSuccess` por separado y
 * verificar que la edición no reutiliza el copy de creación.
 */
const CREATE = 0;
const UPDATE = 1;
const DELETE = 2;

const mocks = vi.hoisted(() => ({
    invalidateQueries: vi.fn(),
    mutationOptions: [],
    mutations: [],
    toastSuccess: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
    useQueryClient: () => ({
        invalidateQueries: mocks.invalidateQueries,
    }),
    useMutation: (options) => {
        const mutate = vi.fn();
        mocks.mutationOptions.push(options);
        mocks.mutations.push(mutate);

        return { mutate, isPending: false };
    },
}));

vi.mock("sonner", () => ({
    toast: { success: mocks.toastSuccess, error: vi.fn(), info: vi.fn() },
}));

vi.mock("../../../services/generic-send-information", () => ({
    sendInformation: vi.fn(),
}));

vi.mock("../../../hooks/useGenericSearchQuery", () => ({
    default: () => ({ data: undefined, isLoading: false }),
}));

vi.mock("../../../utils/main", async (importOriginal) => {
    const actual = await importOriginal();

    return {
        ...actual,
        apiService: { get: vi.fn() },
    };
});

vi.mock("react-i18next", async () => {
    const { createTranslateMock } = await import("@/test-utils/i18n");

    return {
        useTranslation: () => ({
            t: createTranslateMock({
                "app.alerts.fieldCreate": "Campo creado exitosamente",
                "app.alerts.fieldEdit": "Campo editado exitosamente",
                "app.alerts.fieldDelete": "Campo eliminado exitosamente",
            }),
        }),
    };
});

describe("useFieldModalLiteral", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.mutationOptions = [];
        mocks.mutations = [];
    });

    it("confirms a created field with the creation copy", () => {
        const setOpenModal = vi.fn();
        renderHook(() => useFieldModalLiteral({ id: "literal-1", setOpenModal }));

        mocks.mutationOptions[CREATE].onSuccess("field-1", { parentId: "literal-1" });

        expect(mocks.toastSuccess).toHaveBeenCalledWith("Campo creado exitosamente");
        expect(setOpenModal).toHaveBeenCalledWith(false);
    });

    it("confirms an edited field with the edition copy and not the creation one", () => {
        const setOpenModal = vi.fn();
        renderHook(() => useFieldModalLiteral({ id: "literal-1", setOpenModal }));

        mocks.mutationOptions[UPDATE].onSuccess("field-1", { parentId: "literal-1" });

        expect(mocks.toastSuccess).toHaveBeenCalledWith("Campo editado exitosamente");
        expect(mocks.toastSuccess).not.toHaveBeenCalledWith("Campo creado exitosamente");
        expect(setOpenModal).toHaveBeenCalledWith(false);
    });

    it("confirms a deleted field with the deletion copy and not the creation one", () => {
        const setOpenModal = vi.fn();
        renderHook(() => useFieldModalLiteral({ id: "literal-1", setOpenModal }));

        mocks.mutationOptions[DELETE].onSuccess("field-1", { field: { tipo_literal: "literal-1" } });

        expect(mocks.toastSuccess).toHaveBeenCalledWith("Campo eliminado exitosamente");
        expect(mocks.toastSuccess).not.toHaveBeenCalledWith("Campo creado exitosamente");
        expect(setOpenModal).toHaveBeenCalledWith(false);
    });

    it("routes an existing field through the update mutation", () => {
        const { result } = renderHook(() => useFieldModalLiteral({ id: "literal-1" }));

        act(() => {
            result.current.handleSendFieldInformation({ id: "field-1", nombre: "Campo" }, "literal-1");
        });

        expect(mocks.mutations[UPDATE]).toHaveBeenCalledTimes(1);
        expect(mocks.mutations[CREATE]).not.toHaveBeenCalled();
    });

    it("routes a new field through the creation mutation", () => {
        const { result } = renderHook(() => useFieldModalLiteral({ id: "literal-1" }));

        act(() => {
            result.current.handleSendFieldInformation({ nombre: "Campo" }, "literal-1");
        });

        expect(mocks.mutations[CREATE]).toHaveBeenCalledTimes(1);
        expect(mocks.mutations[UPDATE]).not.toHaveBeenCalled();
    });
});
