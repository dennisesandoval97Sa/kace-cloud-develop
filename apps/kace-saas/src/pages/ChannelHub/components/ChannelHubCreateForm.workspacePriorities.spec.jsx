import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import {
    buildRestFlowFamilyFilter,
    CHANNEL_HUB_REGISTRATION_FLOW_FILTER,
    CHANNEL_HUB_REGISTRATION_FLOW_ORDER,
    ChannelHubCreateFormView,
    mapRestFlows,
} from "./ChannelHubCreateForm";
import { CHANNEL_HUB_EXTERNAL_CODES } from "../data/externalCodes";
import { ChannelHubTestI18nProvider } from "../test/channelHubTestI18n";

const registrationFlowId = "6f0d7ac9-6f9c-4b69-b3cb-63ec0b935a4a";
const listFlowId = "8348cba5-184d-4673-85b9-8f6e5fa34bfd";
const updatePriorityFlowId = "41df5e89-8e97-4a65-9bde-da6877c89b01";
const alternateUpdatePriorityFlowId = "0bb9ebcd-8c56-45bb-aef0-bdaf18f46b94";

const registrationFlows = [{ id: registrationFlowId, description: "Channel Hub - Create connection" }];
const listFlows = [{ id: listFlowId, description: "Workspace priorities - List workspaces" }];
const priorityUpdateFlows = [
    { id: updatePriorityFlowId, description: "Workspace priorities - Update order" },
    { id: alternateUpdatePriorityFlowId, description: "Workspace priorities - Update order 2" },
];

const editData = {
    id: "account-1",
    email: "support@example.com",
    name: "Support",
    country_id: "co",
    operator_id: "microsoft",
    rest_flow_id: registrationFlowId,
    mail_rule_list_rest_flow_id: listFlowId,
    mail_rule_priority_update_rest_flow_id: updatePriorityFlowId,
    channel_hub_connection_id: "connection-1",
};

const workspacePriorities = {
    revision: "revision-1",
    canReorder: true,
    conflicts: [],
    items: [
        { workspaceId: "support", description: "Customer Support", tag: "support", priority: 1 },
        { workspaceId: "sales", description: "Sales", tag: "sales", priority: 2 },
    ],
};

class SubmittedChannelHubForms {
    requests = [];

    handle = async (values, _setErrors, _setStatus, options) => {
        this.requests.push({ values, options });
    };
}

const renderForm = (props = {}, initialEntry = "/channel-hub/update/account-1") => {
    const submissions = new SubmittedChannelHubForms();
    const view = render(
        <ChannelHubTestI18nProvider>
            <MemoryRouter initialEntries={[initialEntry]}>
                <ChannelHubCreateFormView
                    dataHandler={submissions.handle}
                    registrationFlows={registrationFlows}
                    listFlows={listFlows}
                    priorityUpdateFlows={priorityUpdateFlows}
                    {...props}
                />
            </MemoryRouter>
        </ChannelHubTestI18nProvider>,
    );
    return { ...view, submissions };
};

describe("ChannelHubCreateForm workspace priorities", () => {
    it("defines canonical active-primary RestFlow searches", () => {
        expect(CHANNEL_HUB_REGISTRATION_FLOW_ORDER).toEqual({ field: "description", direction: "asc" });
        expect(CHANNEL_HUB_REGISTRATION_FLOW_FILTER).toEqual([
            {
                groupType: "OR",
                filters: [
                    {
                        field: "external_code",
                        operator: "eq",
                        value: CHANNEL_HUB_EXTERNAL_CODES.CONNECTION,
                        type: "AND",
                    },
                    {
                        field: "external_code",
                        operator: "like",
                        value: CHANNEL_HUB_EXTERNAL_CODES.CONNECTION_PREFIX_DASH,
                        type: "OR",
                    },
                    {
                        field: "external_code",
                        operator: "like",
                        value: CHANNEL_HUB_EXTERNAL_CODES.CONNECTION_PREFIX_UNDERSCORE,
                        type: "OR",
                    },
                ],
            },
            { field: "is_primary", operator: "eq", value: 1, type: "AND" },
            { field: "is_active", operator: "eq", value: 1, type: "AND" },
            { field: "deleted_at", operator: "null", value: "null", type: "AND" },
        ]);
        expect(buildRestFlowFamilyFilter(CHANNEL_HUB_EXTERNAL_CODES.MAIL_RULES_LIST)[0].filters).toEqual([
            {
                field: "external_code",
                operator: "eq",
                value: CHANNEL_HUB_EXTERNAL_CODES.MAIL_RULES_LIST,
                type: "AND",
            },
        ]);
    });

    it("maps RestFlow labels from description, external code, or id", () => {
        expect(
            mapRestFlows({
                data: [
                    { id: registrationFlowId, description: "Gmail connection" },
                    { id: listFlowId, external_code: "channelhub-mail-rules-list" },
                    { id: updatePriorityFlowId },
                    { description: "missing id" },
                ],
            }),
        ).toEqual([
            { id: registrationFlowId, description: "Gmail connection" },
            { id: listFlowId, description: "channelhub-mail-rules-list" },
            { id: updatePriorityFlowId, description: updatePriorityFlowId },
        ]);
    });

    it("offers canonical RestFlow families and hides priorities during create", () => {
        renderForm();

        expect(screen.getByRole("option", { name: "Workspace priorities - List workspaces" })).toBeInTheDocument();
        expect(screen.getByRole("option", { name: "Workspace priorities - Update order" })).toBeInTheDocument();
        expect(screen.queryByTestId("workspace-priorities-section")).not.toBeInTheDocument();
    });

    it("disables registration selection and explains when no active flows exist", () => {
        renderForm({ registrationFlows: [] });

        expect(screen.getByTestId("channel_hub_form_rest_flow_id")).toBeDisabled();
        expect(screen.getByTestId("channel_hub_form_rest_flow_empty")).toHaveTextContent(
            "No active Channel Hub registration flows are available.",
        );
    });

    it("submits the selected operator and workspace RestFlows", async () => {
        const user = userEvent.setup();
        const { submissions } = renderForm();

        await user.type(screen.getByTestId("input_form_modal_email"), "support@example.com");
        await user.type(screen.getByTestId("input_form_modal_name"), "Support");
        await user.type(screen.getByTestId("input_form_modal_country_id"), "co");
        await user.selectOptions(screen.getByTestId("channel_hub_form_operator_id"), "microsoft");
        await user.selectOptions(screen.getByTestId("channel_hub_form_rest_flow_id"), registrationFlowId);
        await user.selectOptions(screen.getByTestId("channel_hub_form_mail_rule_list_rest_flow_id"), listFlowId);
        await user.selectOptions(
            screen.getByTestId("channel_hub_form_mail_rule_priority_update_rest_flow_id"),
            updatePriorityFlowId,
        );
        await user.click(screen.getByTestId("btn_form_card_save"));

        await waitFor(() => expect(submissions.requests).toHaveLength(1));
        expect(submissions.requests[0]).toEqual({
            values: expect.objectContaining({
                operator_id: "microsoft",
                mail_rule_list_rest_flow_id: listFlowId,
                mail_rule_priority_update_rest_flow_id: updatePriorityFlowId,
            }),
            options: undefined,
        });
        expect(submissions.requests[0].values).not.toHaveProperty("channel_hub_connection_id");
    });

    it("applies async create defaults only to untouched flow fields without resetting the dirty draft", async () => {
        const user = userEvent.setup();
        const { rerender } = renderForm({ listFlows: [], priorityUpdateFlows });

        await user.type(screen.getByTestId("input_form_modal_name"), "Unsaved account name");
        await user.selectOptions(
            screen.getByTestId("channel_hub_form_mail_rule_priority_update_rest_flow_id"),
            alternateUpdatePriorityFlowId,
        );
        await user.selectOptions(screen.getByTestId("channel_hub_form_mail_rule_priority_update_rest_flow_id"), "");
        await user.tab();

        rerender(
            <ChannelHubTestI18nProvider>
                <MemoryRouter initialEntries={["/channel-hub/create"]}>
                    <ChannelHubCreateFormView
                        dataHandler={vi.fn()}
                        registrationFlows={registrationFlows}
                        listFlows={listFlows}
                        priorityUpdateFlows={[priorityUpdateFlows[0]]}
                    />
                </MemoryRouter>
            </ChannelHubTestI18nProvider>,
        );

        await waitFor(() =>
            expect(screen.getByTestId("channel_hub_form_mail_rule_list_rest_flow_id")).toHaveValue(listFlowId),
        );
        expect(screen.getByTestId("input_form_modal_name")).toHaveValue("Unsaved account name");
        expect(screen.getByTestId("channel_hub_form_mail_rule_priority_update_rest_flow_id")).toHaveValue("");
    });

    it("keeps reordering local until the account update is submitted", async () => {
        const user = userEvent.setup();
        const { submissions } = renderForm({ data: editData, workspacePriorities, isEditMode: true });

        await user.click(screen.getByRole("button", { name: "Move Customer Support down" }));
        expect(submissions.requests).toEqual([]);
        await user.click(screen.getByTestId("btn_form_card_update"));

        await waitFor(() => expect(submissions.requests).toHaveLength(1));
        expect(submissions.requests[0].options).toEqual({
            workspacePriorityUpdate: {
                revision: "revision-1",
                orderedWorkspaceIds: ["sales", "support"],
            },
        });
    });

    it("preserves dirty account fields across a background refresh of the same account", async () => {
        const user = userEvent.setup();
        const { rerender } = renderForm({ data: editData, workspacePriorities, isEditMode: true });

        await user.clear(screen.getByTestId("input_form_modal_name"));
        await user.type(screen.getByTestId("input_form_modal_name"), "Unsaved support name");
        rerender(
            <ChannelHubTestI18nProvider>
                <MemoryRouter initialEntries={["/channel-hub/update/account-1"]}>
                    <ChannelHubCreateFormView
                        dataHandler={vi.fn()}
                        data={{ ...editData, name: "Background refresh" }}
                        workspacePriorities={workspacePriorities}
                        registrationFlows={registrationFlows}
                        listFlows={listFlows}
                        priorityUpdateFlows={priorityUpdateFlows}
                        isEditMode
                    />
                </MemoryRouter>
            </ChannelHubTestI18nProvider>,
        );

        expect(screen.getByTestId("input_form_modal_name")).toHaveValue("Unsaved support name");
    });

    it("preserves a dirty priority order across background refresh", async () => {
        const user = userEvent.setup();
        const { submissions, rerender } = renderForm({ data: editData, workspacePriorities, isEditMode: true });
        await user.click(screen.getByRole("button", { name: "Move Customer Support down" }));

        rerender(
            <ChannelHubTestI18nProvider>
                <MemoryRouter initialEntries={["/channel-hub/update/account-1"]}>
                    <ChannelHubCreateFormView
                        dataHandler={submissions.handle}
                        data={editData}
                        workspacePriorities={{ ...workspacePriorities, revision: "revision-2" }}
                        registrationFlows={registrationFlows}
                        listFlows={listFlows}
                        priorityUpdateFlows={priorityUpdateFlows}
                        isEditMode
                    />
                </MemoryRouter>
            </ChannelHubTestI18nProvider>,
        );
        expect(screen.getAllByTestId("workspace-priority-name").map((node) => node.textContent)).toEqual([
            "Sales",
            "Customer Support",
        ]);
        await user.click(screen.getByTestId("btn_form_card_update"));

        await waitFor(() => expect(submissions.requests).toHaveLength(1));
        expect(submissions.requests[0].options.workspacePriorityUpdate).toEqual({
            revision: "revision-2",
            orderedWorkspaceIds: ["sales", "support"],
        });
    });

    it("does not resend a dirty draft while the current order is unavailable", async () => {
        const user = userEvent.setup();
        const { submissions, rerender } = renderForm({ data: editData, workspacePriorities, isEditMode: true });

        await user.click(screen.getByRole("button", { name: "Move Customer Support down" }));
        rerender(
            <ChannelHubTestI18nProvider>
                <MemoryRouter initialEntries={["/channel-hub/update/account-1"]}>
                    <ChannelHubCreateFormView
                        dataHandler={submissions.handle}
                        data={editData}
                        workspacePriorities={workspacePriorities}
                        workspacePrioritiesError={new Error("Reload unavailable")}
                        registrationFlows={registrationFlows}
                        listFlows={listFlows}
                        priorityUpdateFlows={priorityUpdateFlows}
                        isEditMode
                    />
                </MemoryRouter>
            </ChannelHubTestI18nProvider>,
        );
        await user.click(screen.getByTestId("btn_form_card_update"));

        await waitFor(() => expect(submissions.requests).toHaveLength(1));
        expect(submissions.requests[0].options).toBeUndefined();
    });

    it("invalidates the loaded order when a saved priority RestFlow changes", async () => {
        const user = userEvent.setup();
        const { submissions } = renderForm({ data: editData, workspacePriorities, isEditMode: true });

        await user.selectOptions(
            screen.getByTestId("channel_hub_form_mail_rule_priority_update_rest_flow_id"),
            alternateUpdatePriorityFlowId,
        );

        expect(screen.getByTestId("workspace-priorities-configuration-changed")).toHaveTextContent(
            "Save the RestFlow changes and reload this account before reordering workspaces.",
        );
        expect(screen.queryByTestId("workspace-priority-list")).not.toBeInTheDocument();
        await user.click(screen.getByTestId("btn_form_card_update"));
        await waitFor(() => expect(submissions.requests).toHaveLength(1));
        expect(submissions.requests[0]).toEqual({
            values: expect.objectContaining({
                mail_rule_priority_update_rest_flow_id: alternateUpdatePriorityFlowId,
            }),
            options: undefined,
        });
    });

    it("locks immutable fields in edit mode and every control in read-only mode", () => {
        const { unmount } = renderForm({ data: editData, isEditMode: true });

        expect(screen.getByTestId("channel_hub_form_operator_id")).toBeDisabled();
        expect(screen.getByTestId("input_form_modal_email")).toBeDisabled();
        expect(screen.getByTestId("input_form_modal_name")).toBeEnabled();
        expect(screen.getByTestId("channel_hub_form_rest_flow_id")).toBeEnabled();

        unmount();
        renderForm(
            {
                data: editData,
                isEditMode: true,
                isReadOnly: true,
            },
            "/channel-hub/update/account-1?action=see",
        );

        expect(screen.getByTestId("input_form_modal_name")).toBeDisabled();
        expect(screen.getByTestId("input_form_modal_country_id")).toBeDisabled();
        expect(screen.getByTestId("channel_hub_form_rest_flow_id")).toBeDisabled();
        expect(screen.getByTestId("btn_form_card_update")).toBeDisabled();
    });
});
