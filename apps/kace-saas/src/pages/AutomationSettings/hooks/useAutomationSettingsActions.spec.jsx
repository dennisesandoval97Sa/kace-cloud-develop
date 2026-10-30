import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import useGeneralDelete from "@/hooks/useGeneralDelete";
import useAutomationSettingsActions from "./useAutomationSettingsActions";

const mocks = vi.hoisted(() => ({
    deleteAction: vi.fn(),
    navigate: vi.fn(),
}));

vi.mock("@/hooks/useGeneralDelete", () => ({
    default: vi.fn(() => ({ mutate: mocks.deleteAction })),
}));

vi.mock("react-router-dom", () => ({
    useNavigate: () => mocks.navigate,
}));

vi.mock("react-i18next", async () => {
    const { createTranslateMock } = await import("@/test-utils/i18n");

    return {
        useTranslation: () => ({
            t: createTranslateMock({
                "app.forms.error_delete": "No es posible eliminar",
                "app.forms.success_delete_module": "Se eliminó correctamente el registro de {{module}}",
                "app.title.automationSettings": "Configuración de Automatizaciones",
            }),
        }),
    };
});

describe("useAutomationSettingsActions", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("deletes through the DataTableV2 query-key prefix", () => {
        const { result } = renderHook(() => useAutomationSettingsActions());

        act(() => result.current.handleDeleteAutomationSettings("automation-setting-id"));

        expect(useGeneralDelete).toHaveBeenCalledWith({
            keyQuery: URL_AND_KEYS.automationSettings.key,
            successMessage: "Se eliminó correctamente el registro de Configuración de Automatizaciones",
            errorMessage: "No es posible eliminar Configuración de Automatizaciones",
        });
        expect(mocks.deleteAction).toHaveBeenCalledWith({
            id: "automation-setting-id",
            url: URL_AND_KEYS.automationSettings.url,
        });
    });

    it("preserves edit and read navigation", () => {
        const { result } = renderHook(() => useAutomationSettingsActions());

        act(() => {
            result.current.handleUpdateAutomationSettings("automation-setting-id");
            result.current.handleSeeAutomationSettings("automation-setting-id");
        });

        expect(mocks.navigate).toHaveBeenNthCalledWith(1, "/automation-settings/update/automation-setting-id");
        expect(mocks.navigate).toHaveBeenNthCalledWith(
            2,
            "/automation-settings/update/automation-setting-id?action=see",
        );
    });
});
