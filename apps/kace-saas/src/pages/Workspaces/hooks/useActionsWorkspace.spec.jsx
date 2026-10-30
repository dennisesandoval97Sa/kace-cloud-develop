import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useActionsWorkspace from "./useActionsWorkspace";
import useGeneralDelete from "@/hooks/useGeneralDelete";
import { dataTableConfig } from "../data/constants";

const mocks = vi.hoisted(() => ({
    apiPost: vi.fn(),
    deleteMutate: vi.fn(),
    invalidateQueries: vi.fn(),
    navigate: vi.fn(),
    toastError: vi.fn(),
    toastSuccess: vi.fn(),
}));

vi.mock("@/hooks/useGeneralDelete", () => ({
    default: vi.fn(() => ({ mutate: mocks.deleteMutate })),
}));

vi.mock("@/utils/main", () => ({
    apiService: {
        post: mocks.apiPost,
    },
}));

vi.mock("@/config/routesDictionary", () => ({
    ROUTES: {
        WORKSPACE: {
            path: "/workspaces",
        },
    },
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key) => key,
    }),
}));

vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual("react-router-dom");

    return {
        ...actual,
        useNavigate: () => mocks.navigate,
    };
});

vi.mock("sonner", () => ({
    toast: {
        error: mocks.toastError,
        success: mocks.toastSuccess,
    },
}));

const renderUseActionsWorkspace = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            mutations: { retry: false },
            queries: { retry: false },
        },
    });
    queryClient.invalidateQueries = mocks.invalidateQueries;

    const wrapper = ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;

    return renderHook(() => useActionsWorkspace(), { wrapper });
};

describe("useActionsWorkspace", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.apiPost.mockResolvedValue({ status: 202 });
    });

    it("registers the delete mutation under the same query key the workspaces table uses", () => {
        // The table (useDataTable) queries under dataTableConfig.key; deleting must invalidate
        // that exact key so the removed workspace disappears without a manual reload (P7).
        renderUseActionsWorkspace();

        expect(useGeneralDelete).toHaveBeenCalledWith({ keyQuery: dataTableConfig.key });
    });

    it("calls the Workspace register endpoint with only the workspace id", async () => {
        const workspace = {
            id: "workspace-id",
            rules: {},
            tag_creation_flow_id: "flow-id",
        };
        const { result } = renderUseActionsWorkspace();

        act(() => {
            result.current.handleRegisterTags("workspace-id", undefined, workspace);
        });

        await waitFor(() => {
            expect(mocks.apiPost).toHaveBeenCalledWith("/workspaces/workspace-id/channel-hub-tags/register", {});
        });
        expect(mocks.toastSuccess).toHaveBeenCalledWith("workspace.actions.registerTagsSuccess");
        expect(mocks.toastError).not.toHaveBeenCalled();
    });

    it("does not call the REST Flow hook when the workspace has no tag creation flow", () => {
        const { result } = renderUseActionsWorkspace();

        act(() => {
            result.current.handleRegisterTags("workspace-id", undefined, {
                id: "workspace-id",
                tag_creation_flow_id: null,
            });
        });

        expect(mocks.apiPost).not.toHaveBeenCalled();
        expect(mocks.toastError).toHaveBeenCalledWith("workspace.actions.registerTagsMissingFlow");
    });

    it("does not call the register endpoint when the workspace already has a rule id", () => {
        const { result } = renderUseActionsWorkspace();

        act(() => {
            result.current.handleRegisterTags("workspace-id", undefined, {
                id: "workspace-id",
                tag_creation_flow_id: "flow-id",
                rules: {
                    ruleId: "3EJTuLucMyGCOmCcJehd6yT9Ywk",
                },
            });
        });

        expect(mocks.apiPost).not.toHaveBeenCalled();
        expect(mocks.toastError).toHaveBeenCalledWith("workspace.actions.registerTagsAlreadyRegistered");
    });

    it("registers pending accounts added to a legacy registered workspace", async () => {
        const { result } = renderUseActionsWorkspace();

        act(() => {
            result.current.handleRegisterTags("workspace-id", undefined, {
                id: "workspace-id",
                tag_creation_flow_id: "flow-id",
                rules: { ruleId: "legacy-rule-id" },
                channel_hub_accounts: [
                    {
                        id: "legacy-account",
                        channel_hub_connection_id: "connection-1",
                        channel_hub_rule_id: null,
                    },
                    {
                        id: "added-account",
                        channel_hub_connection_id: "connection-2",
                        channel_hub_rule_id: null,
                    },
                ],
            });
        });

        await waitFor(() => {
            expect(mocks.apiPost).toHaveBeenCalledWith("/workspaces/workspace-id/channel-hub-tags/register", {});
        });
    });

    it("does not call the register endpoint when every account is registered", () => {
        const { result } = renderUseActionsWorkspace();

        act(() => {
            result.current.handleRegisterTags("workspace-id", undefined, {
                id: "workspace-id",
                tag_creation_flow_id: "flow-id",
                rules: {},
                channel_hub_accounts: [
                    {
                        id: "account-1",
                        channel_hub_connection_id: "connection-1",
                        channel_hub_rule_id: "rule-1",
                    },
                    {
                        id: "account-2",
                        channel_hub_connection_id: "connection-2",
                        channel_hub_rule_id: "rule-2",
                    },
                ],
            });
        });

        expect(mocks.apiPost).not.toHaveBeenCalled();
        expect(mocks.toastError).toHaveBeenCalledWith("workspace.actions.registerTagsAlreadyRegistered");
    });

    it("rejects registration when the workspace id is missing", () => {
        const { result } = renderUseActionsWorkspace();

        act(() => {
            result.current.handleRegisterTags(undefined, undefined, {
                tag_creation_flow_id: "flow-id",
                rules: {},
            });
        });

        expect(mocks.apiPost).not.toHaveBeenCalled();
        expect(mocks.toastError).toHaveBeenCalledWith("workspace.actions.registerTagsError");
    });

    it("invalidates workspaces and shows the backend message when registration fails", async () => {
        mocks.apiPost.mockRejectedValueOnce({
            response: {
                data: {
                    message: "Workspace already has a Channel Hub rule registered",
                },
            },
        });
        const { result } = renderUseActionsWorkspace();

        act(() => {
            result.current.handleRegisterTags("workspace-id", undefined, {
                id: "workspace-id",
                tag_creation_flow_id: "flow-id",
                rules: {},
            });
        });

        await waitFor(() => {
            expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["workspaces"] });
        });
        expect(mocks.toastError).toHaveBeenCalledWith("Workspace already has a Channel Hub rule registered");
    });
});
