import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ChannelHubCreate from "./ChannelHubCreate";
import { genericHandleSendInformation } from "@/services/genericHandleSendInformation";

const mocks = vi.hoisted(() => ({
    mutate: vi.fn(),
    latestFormProps: null,
    workspacePriorities: vi.fn(() => ({
        data: undefined,
        error: null,
        isLoading: false,
        isFetching: false,
        isUpdating: false,
        refetch: vi.fn(),
        updateWorkspacePriorities: vi.fn(),
    })),
    fetchedData: null,
}));

vi.mock("@/hooks/useGenericViewQuery", () => ({
    default: vi.fn(() => ({
        data: { data: mocks.fetchedData },
        isLoading: false,
    })),
}));

vi.mock("@/hooks/useGeneralMutation", () => ({
    default: vi.fn(() => ({
        mutate: mocks.mutate,
        isPending: false,
    })),
}));

vi.mock("@/services/genericHandleSendInformation", () => ({
    genericHandleSendInformation: vi.fn(() => ({ url: "/channel-hub", data: {} })),
}));

vi.mock("@/components/core/Cards/DashboardSectionCard", () => ({ DashboardSectionCard: "section" }));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key) => key,
    }),
}));

vi.mock("./ChannelHubCreateForm", () => ({
    default: (props) => {
        mocks.latestFormProps = props;
        return (
            <>
                <input data-testid="draft-name" defaultValue={props.data.name} />
                <button
                    type="button"
                    data-testid="attempt-submit"
                    onClick={() => props.dataHandler({ email: "changed@example.com" }, vi.fn(), vi.fn())}
                >
                    attempt submit
                </button>
            </>
        );
    },
}));

const renderCreate = (initialEntry) =>
    render(
        <MemoryRouter initialEntries={[initialEntry]}>
            <Routes>
                <Route
                    path="/channel-hub/update/:id"
                    element={<ChannelHubCreate useWorkspacePrioritiesHook={mocks.workspacePriorities} />}
                />
            </Routes>
        </MemoryRouter>,
    );

describe("ChannelHubCreate", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.latestFormProps = null;
        mocks.fetchedData = {
            id: "account-1",
            email: "support@example.com",
            name: "Support",
            country_id: "co",
            operator_id: "microsoft",
            rest_flow_id: "flow-1",
        };
    });

    it("keeps one form tree while workspace-priority loading becomes enabled", async () => {
        const user = userEvent.setup();
        const view = renderCreate("/channel-hub/update/account-1");
        await user.clear(screen.getByTestId("draft-name"));
        await user.type(screen.getByTestId("draft-name"), "Unsaved draft");

        mocks.fetchedData = {
            ...mocks.fetchedData,
            mail_rule_list_rest_flow_id: "list-flow",
            mail_rule_priority_update_rest_flow_id: "priority-flow",
            channel_hub_connection_id: "connection-1",
        };
        view.rerender(
            <MemoryRouter initialEntries={["/channel-hub/update/account-1"]}>
                <Routes>
                    <Route
                        path="/channel-hub/update/:id"
                        element={<ChannelHubCreate useWorkspacePrioritiesHook={mocks.workspacePriorities} />}
                    />
                </Routes>
            </MemoryRouter>,
        );

        expect(screen.getByTestId("draft-name")).toHaveValue("Unsaved draft");
        expect(mocks.workspacePriorities).toHaveBeenLastCalledWith({ accountId: "account-1", enabled: true });
    });

    it("derives read-only mode from action=see and blocks the mutation path", async () => {
        const user = userEvent.setup();

        renderCreate("/channel-hub/update/account-1?action=see");

        await waitFor(() => {
            expect(mocks.latestFormProps).toEqual(expect.objectContaining({ isReadOnly: true, isEditMode: true }));
        });

        await user.click(screen.getByTestId("attempt-submit"));

        expect(genericHandleSendInformation).not.toHaveBeenCalled();
        expect(mocks.mutate).not.toHaveBeenCalled();
    });

    it("allows submit in update mode when action=see is absent", async () => {
        const user = userEvent.setup();

        renderCreate("/channel-hub/update/account-1");

        await waitFor(() => {
            expect(mocks.latestFormProps).toEqual(expect.objectContaining({ isReadOnly: false, isEditMode: true }));
        });

        await user.click(screen.getByTestId("attempt-submit"));

        expect(genericHandleSendInformation).toHaveBeenCalled();
        expect(mocks.mutate).toHaveBeenCalled();
    });
});
