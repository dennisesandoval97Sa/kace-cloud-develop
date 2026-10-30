import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAgendaToGroupUpdate } from "./useAgendaToGroupUpdate";

const mocks = vi.hoisted(() => ({
    dispatch: vi.fn(),
    invalidateQueries: vi.fn(),
    mutationOptions: [],
    sendInformation: vi.fn(),
    toastError: vi.fn(),
    toastSuccess: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
    useQueryClient: () => ({
        invalidateQueries: mocks.invalidateQueries,
    }),
    useMutation: (options) => {
        mocks.mutationOptions.push(options);

        return {
            mutate: (data) => options.mutationFn(data),
        };
    },
}));

vi.mock("react-redux", () => ({
    useDispatch: () => mocks.dispatch,
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key) => key,
    }),
}));

vi.mock("sonner", () => ({
    toast: {
        error: mocks.toastError,
        success: mocks.toastSuccess,
    },
}));

vi.mock("../../../redux/state/modalBehavior", () => ({
    setOpenModal: (open) => ({ type: "modal/setOpenModal", payload: open }),
}));

vi.mock("@kace/urls", () => ({
    AGENDA_GROUP_SERVICE: "/agendas-groups",
}));

vi.mock("../../../services/generic-send-information", () => ({
    sendInformation: mocks.sendInformation,
}));

describe("useAgendaToGroupUpdate", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.mutationOptions = [];
        mocks.sendInformation.mockResolvedValue({ status: 201 });
    });

    it("uses the canonical agenda id when creating agenda-group relationships after agenda creation", async () => {
        const optimisticAgendaId = "11111111-1111-4111-8111-111111111111";
        const canonicalAgendaId = "22222222-2222-4222-8222-222222222222";
        const groups = ["33333333-3333-4333-8333-333333333333", "44444444-4444-4444-8444-444444444444"];
        const { result, rerender } = renderHook(() => useAgendaToGroupUpdate());

        act(() => {
            result.current.handleAgendaToGroup(groups, optimisticAgendaId, null);
        });
        rerender();

        await act(async () => {
            result.current.handleAgendaToGroupUpdate(canonicalAgendaId);
        });

        expect(mocks.sendInformation).toHaveBeenCalledWith({
            id: null,
            url: "/agendas-groups/batch",
            dataPost: groups.map((groupId) => ({
                agenda_id: canonicalAgendaId,
                group_id: groupId,
            })),
        });
    });
});
