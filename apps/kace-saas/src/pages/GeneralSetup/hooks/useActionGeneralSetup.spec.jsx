import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useGeneralDelete from "@kace/hooks/useGeneralDelete";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import useActionsGeneralSetup from "./useActionGeneralSetup";

const mocks = vi.hoisted(() => ({
    deleteMutate: vi.fn(),
    navigate: vi.fn(),
}));

vi.mock("@kace/hooks/useGeneralDelete", () => ({
    default: vi.fn(() => ({ mutate: mocks.deleteMutate })),
}));

vi.mock("react-i18next", async () => {
    const { createTranslateMock } = await import("@/test-utils/i18n");

    return {
        useTranslation: () => ({
            t: createTranslateMock({
                "app.forms.error_delete": "No es posible eliminar",
                "app.forms.success_delete_module": "Se eliminó correctamente el registro de {{module}}",
                "app.title.generalSetup": "Configuraciones generales",
            }),
        }),
    };
});

vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual("react-router-dom");

    return {
        ...actual,
        useNavigate: () => mocks.navigate,
    };
});

describe("useActionsGeneralSetup", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("configures translated entity-specific delete messages", () => {
        renderHook(() => useActionsGeneralSetup());

        expect(useGeneralDelete).toHaveBeenCalledWith({
            keyQuery: URL_AND_KEYS.globalConfiguration.key,
            errorMessage: "No es posible eliminar Configuraciones generales",
            successMessage: "Se eliminó correctamente el registro de Configuraciones generales",
        });
    });
});
