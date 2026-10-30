import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

const mockMutate = vi.fn();
const mockQueryClient = {
    getQueryData: vi.fn().mockReturnValue(undefined),
    cancelQueries: vi.fn().mockResolvedValue(undefined),
    setQueryData: vi.fn(),
    invalidateQueries: vi.fn(),
};
const mockPost = vi.fn().mockResolvedValue({ status: 200, data: { data: { id: "flow-id" } } });

vi.mock("@tanstack/react-query", () => ({
    useMutation: () => ({ mutate: mockMutate }),
    useQuery: () => ({ data: undefined, isLoading: false }),
    useQueryClient: () => mockQueryClient,
}));
vi.mock("react-router-dom", () => ({
    useNavigate: () => vi.fn(),
    useParams: () => ({ id: "flow-id" }),
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (k) => k }) }));
vi.mock("../../../hooks/usePermissionsUser", () => ({
    default: () => ({ arrayAction: [], canBeCreate: true }),
}));
vi.mock("../../../hooks/useGeneralMutation", () => ({
    default: () => ({
        mutate: mockMutate,
        isPending: false,
        queryClient: mockQueryClient,
    }),
}));
vi.mock("../../../hooks/useGenericSearchQuery", () => ({
    default: () => ({ data: [], isLoading: false }),
}));
vi.mock("@/hooks/useGenericSearchQuery", () => ({
    default: () => ({ data: [], isLoading: false }),
}));
vi.mock("@/utils/urlAndKeys", () => ({
    URL_AND_KEYS: {
        ans: { url: "/ans", key: "ans" },
        transitionRules: { url: "/transition-rules", key: "transition-rules" },
        flows: { url: "/flows", key: "flows", view: "flows", entity: "flows" },
    },
}));
vi.mock("@kace/utils", () => ({
    apiService: { post: mockPost, get: mockPost },
}));
vi.mock("../../../utils/URL", () => ({
    FLOW_SERVICE: "/flows",
    STATE_SERVICE: "/states",
}));
vi.mock("../../../services/genericSearch", () => ({
    genericSearch: vi.fn().mockResolvedValue({ data: [] }),
}));
vi.mock("../../../services/genericHandleSendInformation", () => ({
    genericHandleSendInformation: ({ values, urlService, options }) => ({
        id: values.id,
        url: values.id ? `${urlService}/${values.id}` : urlService,
        dataPost: values,
        options,
    }),
}));

describe("useFlowActions.handleFlow", () => {
    beforeEach(() => {
        mockMutate.mockClear();
        mockPost.mockClear();
    });

    it("posts a single request to /flows/:id and never to /transitions", async () => {
        const { default: useFlowActions } = await import("../hooks/useFlowActions");
        const { result } = renderHook(() => useFlowActions());
        const { handleFlow } = result.current;

        const values = {
            id: "flow-id",
            nombre: "Test",
            json_flujo: {
                edges: [
                    { id: "e1", source: "0", target: "state-A" },
                    { id: "e2", source: "state-A", target: "state-B" },
                ],
            },
        };

        await handleFlow(values, vi.fn(), vi.fn());

        expect(mockMutate).toHaveBeenCalledTimes(1);
        const mutationArg = mockMutate.mock.calls[0][0];
        expect(mutationArg.url).toBe("/flows/flow-id");

        const allUrls = mockPost.mock.calls.map((c) => c[0]);
        expect(allUrls.some((u) => String(u).includes("/transitions"))).toBe(false);

        const payloadJson = JSON.stringify(mutationArg.dataPost);
        expect(payloadJson).not.toMatch(/kace_transition/);
        expect(payloadJson).not.toMatch(/transition_existed/);
    });
});
