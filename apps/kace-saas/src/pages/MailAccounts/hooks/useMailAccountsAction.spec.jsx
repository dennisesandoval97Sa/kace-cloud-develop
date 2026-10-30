import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import useGeneralDelete from "@/hooks/useGeneralDelete";
import useMailAccountsAction from "./useMailAccountsAction";

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
                "app.title.mailAccounts": "Cuentas correo",
            }),
        }),
    };
});

describe("useMailAccountsAction", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("deletes through the DataTableV2 query-key prefix", () => {
        const { result } = renderHook(() => useMailAccountsAction());

        act(() => result.current.handleDeleteMailAccount("mail-account-id"));

        expect(useGeneralDelete).toHaveBeenCalledWith({
            keyQuery: URL_AND_KEYS.mail_accounts.key,
            successMessage: "Se eliminó correctamente el registro de Cuentas correo",
            errorMessage: "No es posible eliminar Cuentas correo",
        });
        expect(mocks.deleteAction).toHaveBeenCalledWith({
            id: "mail-account-id",
            url: URL_AND_KEYS.mail_accounts.url,
        });
    });

    it("preserves edit and read navigation", () => {
        const { result } = renderHook(() => useMailAccountsAction());

        act(() => {
            result.current.handleUpdateMailAccount("mail-account-id");
            result.current.handleSeeMailAccount("mail-account-id");
        });

        expect(mocks.navigate).toHaveBeenNthCalledWith(1, "/mail-account/update/mail-account-id");
        expect(mocks.navigate).toHaveBeenNthCalledWith(2, "/mail-account/update/mail-account-id?action=see");
    });
});
