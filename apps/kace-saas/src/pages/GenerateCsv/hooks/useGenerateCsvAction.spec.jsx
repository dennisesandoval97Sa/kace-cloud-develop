import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useGeneralDelete from "@/hooks/useGeneralDelete";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import useGenerateCsvAction from "./useGenerateCsvAction";

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
                "app.title.generateCsv": "Generador CSV",
            }),
        }),
    };
});

describe("useGenerateCsvAction", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("deletes through the CSV Generator DataTableV2 query-key prefix", () => {
        const { result } = renderHook(() => useGenerateCsvAction());

        act(() => result.current.handleDeleteGenerateCsv("csv-export-view-id"));

        expect(useGeneralDelete).toHaveBeenCalledWith({
            keyQuery: URL_AND_KEYS.generateCsv.key,
            successMessage: "Se eliminó correctamente el registro de Generador CSV",
            errorMessage: "No es posible eliminar Generador CSV",
        });
        expect(mocks.deleteAction).toHaveBeenCalledWith({
            id: "csv-export-view-id",
            url: URL_AND_KEYS.generateCsv.url,
        });
    });

    it("preserves edit and read navigation", () => {
        const { result } = renderHook(() => useGenerateCsvAction());

        act(() => {
            result.current.handleUpdateGenerateCsv("csv-export-view-id");
            result.current.handleSeeGenerateCsv("csv-export-view-id");
        });

        expect(mocks.navigate).toHaveBeenNthCalledWith(1, "/generate-csv/update/csv-export-view-id");
        expect(mocks.navigate).toHaveBeenNthCalledWith(2, "/generate-csv/update/csv-export-view-id?action=see");
    });
});
