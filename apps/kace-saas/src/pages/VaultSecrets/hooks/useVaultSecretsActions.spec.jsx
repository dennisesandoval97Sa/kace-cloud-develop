import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useGeneralDelete from "../../../hooks/useGeneralDelete";
import {
    setIdSelectedAndDisableEdit,
    setIdSelectedAndEnableEdit,
    setOpenModal,
} from "../../../redux/state/modalBehavior";
import { URL_AND_KEYS } from "../../../utils/urlAndKeys";
import useVaultSecretsActions from "./useVaultSecretsActions";

const mocks = vi.hoisted(() => ({
    deleteAction: vi.fn(),
    dispatch: vi.fn(),
}));

vi.mock("react-redux", () => ({
    useDispatch: () => mocks.dispatch,
}));

vi.mock("../../../hooks/useGeneralDelete", () => ({
    default: vi.fn(() => ({ mutate: mocks.deleteAction })),
}));

vi.mock("../../../redux/state/modalBehavior", () => ({
    setIdSelectedAndDisableEdit: vi.fn((id) => ({ type: "view", payload: id })),
    setIdSelectedAndEnableEdit: vi.fn((id) => ({ type: "edit", payload: id })),
    setOpenModal: vi.fn((open) => ({ type: "open", payload: open })),
}));

describe("useVaultSecretsActions", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("deletes through the query-key prefix used by DataTableV2", () => {
        const { result } = renderHook(() => useVaultSecretsActions());

        act(() => result.current.handleDeleteSecretVault("secret-id"));

        expect(useGeneralDelete).toHaveBeenCalledWith({ keyQuery: URL_AND_KEYS.vaultSecret.key });
        expect(mocks.deleteAction).toHaveBeenCalledWith({
            id: "secret-id",
            url: URL_AND_KEYS.vaultSecret.url,
        });
    });

    it("preserves edit and read-only modal behavior", () => {
        const { result } = renderHook(() => useVaultSecretsActions());

        act(() => result.current.handleUpdateSecretVault("edit-id"));
        expect(setIdSelectedAndEnableEdit).toHaveBeenCalledWith("edit-id");
        expect(mocks.dispatch).toHaveBeenNthCalledWith(1, { type: "edit", payload: "edit-id" });
        expect(mocks.dispatch).toHaveBeenNthCalledWith(2, { type: "open", payload: true });

        act(() => result.current.handleSeeSecretVault("view-id"));
        expect(setIdSelectedAndDisableEdit).toHaveBeenCalledWith("view-id");
        expect(setOpenModal).toHaveBeenCalledWith(true);
        expect(mocks.dispatch).toHaveBeenNthCalledWith(3, { type: "view", payload: "view-id" });
        expect(mocks.dispatch).toHaveBeenNthCalledWith(4, { type: "open", payload: true });
    });
});
