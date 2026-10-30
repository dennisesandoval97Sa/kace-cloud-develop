import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import usePermissionsUser from "@kace/hooks/usePermissionsUser";
import useActionsAgenda from "./useActionsAgenda";

const mocks = vi.hoisted(() => ({
    deleteAction: vi.fn(),
    dispatch: vi.fn(),
}));

vi.mock("react-redux", () => ({
    useDispatch: () => mocks.dispatch,
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key) => key,
    }),
}));

vi.mock("@kace/hooks/useGeneralDelete", () => ({
    default: () => ({ mutate: mocks.deleteAction }),
}));

vi.mock("@kace/hooks/usePermissionsUser", () => ({
    default: vi.fn(() => ({
        arrayAction: [],
        canBeCreate: false,
    })),
}));

describe("useActionsAgenda", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("uses Agenda permissions for every table action and create access", () => {
        renderHook(() => useActionsAgenda());

        expect(usePermissionsUser).toHaveBeenCalledWith({
            moduleId: "agendas",
            actions: [
                expect.objectContaining({ name: "AgendasUpdate" }),
                expect.objectContaining({ name: "AgendasDelete" }),
                expect.objectContaining({ name: "AgendasRead" }),
            ],
            nameCreate: "AgendasCreate",
        });
    });
});
