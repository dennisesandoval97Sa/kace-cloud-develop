import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useGenericSearchInfiniteQuery from "@/hooks/useGenericSearchInfiniteQuery";
import { CHANNEL_HUB_EXTERNAL_CODES } from "@/pages/ChannelHub/data/externalCodes";
import WorkspaceForm from "./WorkspaceForm";

const tagCreationFlowId = "6e6a7b7f-2b9f-45bb-b639-c313ea5fd28a";
const tagUpdateFlowId = "d29967a3-8988-4b78-9542-c3c1fe4a992b";
const tagDeletionFlowId = "17da1fa7-e0b4-45a1-9b82-393ea2362d39";
const connectionFlowId = "5f74d4b7-9e55-4892-9b6d-695fbc694335";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key) =>
            ({
                "workspace.form.mail_accounts": "Mail Accounts",
                "workspace.form.channel_hub_accounts": "Channel Hub Accounts",
                "workspace.form.groups": "Groups",
                "workspace.form.tag_rest_flows": "Tag REST Flows",
                "workspace.form.tag_creation_flow": "Tag Creation Flow",
                "workspace.form.tag_update_flow": "Tag Update Flow",
                "workspace.form.tag_deletion_flow": "Tag Deletion Flow",
                "workspace.placeholder.tag_creation_flow": "Select tag creation flow",
                "workspace.placeholder.tag_update_flow": "Select tag update flow",
                "workspace.placeholder.tag_deletion_flow": "Select tag deletion flow",
                "workspace.rules.add": "Add rule",
                "workspace.rules.deleteRow": "Delete row",
                "workspace.rules.empty": "No rules added",
            })[key] ?? key,
    }),
}));

vi.mock("@/hooks/useGenericSearchInfiniteQuery", () => ({
    default: vi.fn(() => ({
        data: [
            {
                id: tagCreationFlowId,
                value: tagCreationFlowId,
                label: "Channel Hub - Crear tag",
                description: "Channel Hub - Crear tag",
                external_code: "channelhub-tag-create",
            },
            {
                id: tagUpdateFlowId,
                value: tagUpdateFlowId,
                label: "Channel Hub - Actualizar tag",
                description: "Channel Hub - Actualizar tag",
                external_code: "channelhub-tag-update",
            },
            {
                id: tagDeletionFlowId,
                value: tagDeletionFlowId,
                label: "Channel Hub - Eliminar tag",
                description: "Channel Hub - Eliminar tag",
                external_code: "channelhub-tag-delete",
            },
            {
                id: connectionFlowId,
                value: connectionFlowId,
                label: "Channel Hub - Connection",
                description: "Channel Hub - Connection",
                external_code: "channelhub-connection",
            },
        ],
        isLoading: false,
    })),
}));

vi.mock("@kace/ui-shared", async () => {
    const actual = await vi.importActual("@kace/ui-shared");
    const { default: PropTypes } = await vi.importActual("prop-types");
    const MockMultiSelect = ({
        nameTesting,
        listValues = [],
        setListValues,
        triggerAriaLabel,
        triggerAriaDescribedBy,
        triggerAriaInvalid,
    }) => (
        <div data-testid={`multiselect-${nameTesting}`}>
            <button
                type="button"
                data-testid={`trigger_multiselect_${nameTesting}`}
                aria-label={triggerAriaLabel}
                aria-describedby={triggerAriaDescribedBy}
                aria-invalid={triggerAriaInvalid || undefined}
            >
                {listValues.map((item) => item.label ?? item.email ?? item.id).join(",")}
            </button>
            <button type="button" data-testid={`clear-${nameTesting}`} onClick={() => setListValues?.([])}>
                clear
            </button>
        </div>
    );
    MockMultiSelect.propTypes = {
        nameTesting: PropTypes.string,
        listValues: PropTypes.arrayOf(PropTypes.object),
        setListValues: PropTypes.func,
    };

    return {
        ...actual,
        MultiSelect: MockMultiSelect,
    };
});

const renderWorkspaceForm = (props) => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
        },
    });

    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter>
                <WorkspaceForm {...props} />
            </MemoryRouter>
        </QueryClientProvider>,
    );
};

describe("WorkspaceForm", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("requests active primary tag REST flows by the closed Channel Hub external code set", () => {
        renderWorkspaceForm({ dataHandler: vi.fn() });

        expect(useGenericSearchInfiniteQuery).toHaveBeenCalledWith(
            expect.objectContaining({
                filter: [
                    {
                        groupType: "OR",
                        filters: [
                            {
                                field: "external_code",
                                operator: "eq",
                                value: CHANNEL_HUB_EXTERNAL_CODES.TAG_CREATE,
                                type: "AND",
                            },
                            {
                                field: "external_code",
                                operator: "eq",
                                value: CHANNEL_HUB_EXTERNAL_CODES.TAG_UPDATE,
                                type: "OR",
                            },
                            {
                                field: "external_code",
                                operator: "eq",
                                value: CHANNEL_HUB_EXTERNAL_CODES.TAG_DELETE,
                                type: "OR",
                            },
                        ],
                    },
                    { field: "is_primary", operator: "eq", value: 1, type: "AND" },
                    { field: "is_active", operator: "eq", value: 1, type: "AND" },
                    { field: "deleted_at", operator: "null", value: "null", type: "AND" },
                ],
            }),
        );
    });

    it("renders Channel Hub Accounts instead of Mail Accounts", () => {
        renderWorkspaceForm({ dataHandler: vi.fn() });

        expect(screen.getByText("Channel Hub Accounts")).toBeInTheDocument();
        expect(screen.queryByText("Mail Accounts")).not.toBeInTheDocument();
        expect(screen.getByTestId("multiselect-channelHubAccounts")).toBeInTheDocument();
        expect(screen.queryByTestId("multiselect-mailAccounts")).not.toBeInTheDocument();
    });

    it("submits selected Channel Hub accounts and groups using the API relation fields", async () => {
        const channelHubAccountId = "bb4e9857-11c1-43f4-9119-947d6a6f7587";
        const groupId = "4f3114a4-0229-4d76-8f5c-b048b72f0c74";
        const dataHandler = vi.fn();
        const user = userEvent.setup();

        renderWorkspaceForm({
            dataHandler,
            data: {
                id: "4cecb6b5-69cf-4f93-8c54-c12d206f0efd",
                description: "Support workspace",
                is_active: true,
                tag: "support",
                channel_hub_accounts: [
                    {
                        id: channelHubAccountId,
                        email: "support@example.com",
                        name: "Support",
                    },
                ],
                groups: [
                    {
                        id: groupId,
                        nombre: "Administrators",
                        descripcion: "Admins",
                    },
                ],
            },
        });

        await waitFor(() => {
            expect(screen.getByTestId("multiselect-channelHubAccounts")).toHaveTextContent("support@example.com");
            expect(screen.getByTestId("multiselect-groups")).toHaveTextContent("Administrators");
        });

        await user.click(screen.getByTestId("btn_form_card_update"));

        await waitFor(() => {
            expect(dataHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    channel_hub_accounts: [{ id: channelHubAccountId }],
                    groups: [{ id: groupId }],
                }),
            );
        });

        const submittedPayload = dataHandler.mock.calls[0][0];
        expect(submittedPayload).not.toHaveProperty("mail_account_ids");
        expect(submittedPayload).not.toHaveProperty("group_ids");
        expect(submittedPayload).not.toHaveProperty("mails_accounts");
    });

    it("submits every selected Channel Hub account (ADR-017: multiple accounts per workspace)", async () => {
        const firstChannelHubAccountId = "bb4e9857-11c1-43f4-9119-947d6a6f7587";
        const secondChannelHubAccountId = "25d9db55-9657-4574-82f8-ec95c4de12f5";
        const groupId = "4f3114a4-0229-4d76-8f5c-b048b72f0c74";
        const dataHandler = vi.fn();
        const user = userEvent.setup();

        renderWorkspaceForm({
            dataHandler,
            data: {
                id: "4cecb6b5-69cf-4f93-8c54-c12d206f0efd",
                description: "Support workspace",
                is_active: true,
                tag: "support",
                channel_hub_accounts: [
                    {
                        id: firstChannelHubAccountId,
                        email: "support@example.com",
                        name: "Support",
                    },
                    {
                        id: secondChannelHubAccountId,
                        email: "backoffice@example.com",
                        name: "Backoffice",
                    },
                ],
                groups: [
                    {
                        id: groupId,
                        nombre: "Administrators",
                        descripcion: "Admins",
                    },
                ],
            },
        });

        await waitFor(() => {
            expect(screen.getByTestId("multiselect-channelHubAccounts")).toHaveTextContent("support@example.com");
            expect(screen.getByTestId("multiselect-channelHubAccounts")).toHaveTextContent("backoffice@example.com");
        });

        await user.click(screen.getByTestId("btn_form_card_update"));

        await waitFor(() => {
            expect(dataHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    channel_hub_accounts: [{ id: firstChannelHubAccountId }, { id: secondChannelHubAccountId }],
                    groups: [{ id: groupId }],
                }),
            );
        });
    });

    it("allows clearing the last group and submits an explicit empty relation array", async () => {
        const dataHandler = vi.fn();
        const user = userEvent.setup();

        renderWorkspaceForm({
            dataHandler,
            data: {
                id: "4cecb6b5-69cf-4f93-8c54-c12d206f0efd",
                description: "Support workspace",
                is_active: true,
                tag: "support",
                channel_hub_accounts: [{ id: "bb4e9857-11c1-43f4-9119-947d6a6f7587", email: "support@example.com" }],
                groups: [{ id: "4f3114a4-0229-4d76-8f5c-b048b72f0c74", nombre: "Administrators" }],
            },
        });

        await user.click(await screen.findByTestId("clear-groups"));
        await user.click(screen.getByTestId("btn_form_card_update"));

        await waitFor(() => {
            expect(dataHandler).toHaveBeenCalledWith(expect.objectContaining({ groups: [] }));
        });
        expect(screen.queryByTestId("workspace_groups_error")).not.toBeInTheDocument();
    });

    it("allows creating a workspace without selecting a group", async () => {
        const dataHandler = vi.fn();
        const user = userEvent.setup();

        renderWorkspaceForm({
            dataHandler,
            data: {
                description: "Unassigned workspace",
                is_active: true,
                tag: "unassigned",
                channel_hub_accounts: [{ id: "bb4e9857-11c1-43f4-9119-947d6a6f7587", email: "unassigned@example.com" }],
                groups: [],
            },
        });

        await user.click(screen.getByTestId("btn_form_card_save"));

        await waitFor(() => {
            expect(dataHandler).toHaveBeenCalledWith(expect.objectContaining({ groups: [] }));
        });
        expect(screen.queryByTestId("workspace_groups_error")).not.toBeInTheDocument();
    });

    it("renders and submits selected Tag REST Flows", async () => {
        const dataHandler = vi.fn();
        const user = userEvent.setup();

        renderWorkspaceForm({
            dataHandler,
            data: {
                id: "4cecb6b5-69cf-4f93-8c54-c12d206f0efd",
                description: "Support workspace",
                is_active: true,
                tag: "support",
                channel_hub_accounts: [
                    {
                        id: "bb4e9857-11c1-43f4-9119-947d6a6f7587",
                        email: "support@example.com",
                    },
                ],
                groups: [
                    {
                        id: "4f3114a4-0229-4d76-8f5c-b048b72f0c74",
                        nombre: "Administrators",
                    },
                ],
                tag_creation_flow_id: tagCreationFlowId,
                tag_update_flow_id: tagUpdateFlowId,
                tag_deletion_flow_id: tagDeletionFlowId,
            },
        });

        expect(screen.getByText("Tag REST Flows")).toBeInTheDocument();
        const creationSelect = screen.getByLabelText("Tag Creation Flow");
        const updateSelect = screen.getByLabelText("Tag Update Flow");
        const deletionSelect = screen.getByLabelText("Tag Deletion Flow");

        expect(creationSelect).toHaveValue(tagCreationFlowId);
        expect(updateSelect).toHaveValue(tagUpdateFlowId);
        expect(deletionSelect).toHaveValue(tagDeletionFlowId);
        expect([...creationSelect.options].map((option) => option.textContent)).toEqual([
            "Select tag creation flow",
            "Channel Hub - Crear tag",
        ]);
        expect([...updateSelect.options].map((option) => option.textContent)).toEqual([
            "Select tag update flow",
            "Channel Hub - Actualizar tag",
        ]);
        expect([...deletionSelect.options].map((option) => option.textContent)).toEqual([
            "Select tag deletion flow",
            "Channel Hub - Eliminar tag",
        ]);

        await user.click(screen.getByTestId("btn_form_card_update"));

        await waitFor(() => {
            expect(dataHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    tag_creation_flow_id: tagCreationFlowId,
                    tag_update_flow_id: tagUpdateFlowId,
                    tag_deletion_flow_id: tagDeletionFlowId,
                }),
            );
        });
    });

    it("shows a localized Formik error when submitting without a Channel Hub account", async () => {
        const dataHandler = vi.fn();
        const user = userEvent.setup();

        renderWorkspaceForm({
            dataHandler,
            data: {
                id: "4cecb6b5-69cf-4f93-8c54-c12d206f0efd",
                description: "Support workspace",
                is_active: true,
                tag: "support",
                channel_hub_accounts: [],
                groups: [
                    {
                        id: "4f3114a4-0229-4d76-8f5c-b048b72f0c74",
                        nombre: "Administrators",
                    },
                ],
            },
        });

        await user.click(screen.getByTestId("btn_form_card_update"));

        expect(dataHandler).not.toHaveBeenCalled();
        expect(await screen.findByTestId("workspace_channel_hub_accounts_error")).toHaveTextContent(
            "Select at least one Channel Hub account for this workspace",
        );
    });

    it("keeps the tag field editable when creating a workspace (P10)", () => {
        renderWorkspaceForm({ dataHandler: vi.fn() });

        const tagInput = screen.getByTestId("input_form_custom_workspace_form_tag");
        expect(tagInput).not.toBeDisabled();
    });

    it("disables the tag field when editing an existing workspace (P10)", async () => {
        renderWorkspaceForm({
            dataHandler: vi.fn(),
            data: {
                id: "4cecb6b5-69cf-4f93-8c54-c12d206f0efd",
                description: "Support workspace",
                is_active: true,
                tag: "support",
                channel_hub_accounts: [],
                groups: [],
            },
        });

        const tagInput = screen.getByTestId("input_form_custom_workspace_form_tag");
        await waitFor(() => {
            expect(tagInput).toBeDisabled();
            expect(tagInput).toHaveValue("support");
        });
    });

    it("submits a body rule as bodyContains (P11)", async () => {
        const dataHandler = vi.fn();
        const user = userEvent.setup();

        renderWorkspaceForm({
            dataHandler,
            data: {
                id: "4cecb6b5-69cf-4f93-8c54-c12d206f0efd",
                description: "Support workspace",
                is_active: true,
                tag: "support",
                channel_hub_accounts: [
                    {
                        id: "bb4e9857-11c1-43f4-9119-947d6a6f7587",
                        email: "support@example.com",
                    },
                ],
                groups: [{ id: "4f3114a4-0229-4d76-8f5c-b048b72f0c74", nombre: "Administrators" }],
                tableRules: [{ field: "body", operator: "contains", value: "invoice" }],
            },
        });

        await user.click(screen.getByTestId("btn_form_card_update"));

        await waitFor(() => {
            expect(dataHandler).toHaveBeenCalled();
        });

        const payload = dataHandler.mock.calls[0][0];
        expect(payload.rules.bodyContains).toEqual(["invoice"]);
        expect(payload.rules).not.toHaveProperty("bodyEquals");
    });

    it("never sends bodyEquals to Channel Hub even if a body/equals rule slips in (P11)", async () => {
        const dataHandler = vi.fn();
        const user = userEvent.setup();

        renderWorkspaceForm({
            dataHandler,
            data: {
                id: "4cecb6b5-69cf-4f93-8c54-c12d206f0efd",
                description: "Support workspace",
                is_active: true,
                tag: "support",
                channel_hub_accounts: [
                    {
                        id: "bb4e9857-11c1-43f4-9119-947d6a6f7587",
                        email: "support@example.com",
                    },
                ],
                groups: [{ id: "4f3114a4-0229-4d76-8f5c-b048b72f0c74", nombre: "Administrators" }],
                tableRules: [{ field: "body", operator: "equals", value: "invoice" }],
            },
        });

        await user.click(screen.getByTestId("btn_form_card_update"));

        await waitFor(() => {
            expect(dataHandler).toHaveBeenCalled();
        });

        const payload = dataHandler.mock.calls[0][0];
        expect(payload.rules).not.toHaveProperty("bodyEquals");
        expect(payload.rules.bodyContains).toEqual([]);
    });

    it.each([
        ["", "Required"],
        ["abc", "Minimum 4 characters"],
        ["a".repeat(51), "Maximum 50 characters"],
    ])("blocks submit and alerts when a rule value is %j", async (value, expectedMessage) => {
        const dataHandler = vi.fn();
        const user = userEvent.setup();

        renderWorkspaceForm({
            dataHandler,
            data: {
                id: "4cecb6b5-69cf-4f93-8c54-c12d206f0efd",
                description: "Support workspace",
                is_active: true,
                tag: "support",
                channel_hub_accounts: [{ id: "bb4e9857-11c1-43f4-9119-947d6a6f7587", email: "support@example.com" }],
                groups: [],
                tableRules: [{ field: "subject", operator: "contains", value }],
            },
        });

        await user.click(screen.getByTestId("btn_form_card_update"));

        expect(await screen.findByTestId("workspace_rule_value_error_0")).toHaveTextContent(expectedMessage);
        expect(dataHandler).not.toHaveBeenCalled();
    });

    it("submits rule values within the 4-50 character range", async () => {
        const dataHandler = vi.fn();
        const user = userEvent.setup();

        renderWorkspaceForm({
            dataHandler,
            data: {
                id: "4cecb6b5-69cf-4f93-8c54-c12d206f0efd",
                description: "Support workspace",
                is_active: true,
                tag: "support",
                channel_hub_accounts: [{ id: "bb4e9857-11c1-43f4-9119-947d6a6f7587", email: "support@example.com" }],
                groups: [],
                tableRules: [
                    { field: "subject", operator: "contains", value: "abcd" },
                    { field: "from", operator: "equals", value: "a".repeat(50) },
                ],
            },
        });

        await user.click(screen.getByTestId("btn_form_card_update"));

        await waitFor(() => {
            expect(dataHandler).toHaveBeenCalled();
        });
        expect(screen.queryByTestId("workspace_rule_value_error_0")).not.toBeInTheDocument();
    });

    it.each([
        ["    ", "Minimum 4 characters"],
        ["  ab  ", "Minimum 4 characters"],
        [` ${"a".repeat(51)} `, "Maximum 50 characters"],
    ])("measures rule value %j without its surrounding whitespace", async (value, expectedMessage) => {
        const dataHandler = vi.fn();
        const user = userEvent.setup();

        renderWorkspaceForm({
            dataHandler,
            data: {
                id: "4cecb6b5-69cf-4f93-8c54-c12d206f0efd",
                description: "Support workspace",
                is_active: true,
                tag: "support",
                channel_hub_accounts: [{ id: "bb4e9857-11c1-43f4-9119-947d6a6f7587", email: "support@example.com" }],
                groups: [],
                tableRules: [{ field: "subject", operator: "contains", value }],
            },
        });

        await user.click(screen.getByTestId("btn_form_card_update"));

        expect(await screen.findByTestId("workspace_rule_value_error_0")).toHaveTextContent(expectedMessage);
        expect(dataHandler).not.toHaveBeenCalled();
    });

    it("submits a valid rule value as typed, keeping its surrounding whitespace", async () => {
        const dataHandler = vi.fn();
        const user = userEvent.setup();

        renderWorkspaceForm({
            dataHandler,
            data: {
                id: "4cecb6b5-69cf-4f93-8c54-c12d206f0efd",
                description: "Support workspace",
                is_active: true,
                tag: "support",
                channel_hub_accounts: [{ id: "bb4e9857-11c1-43f4-9119-947d6a6f7587", email: "support@example.com" }],
                groups: [],
                tableRules: [{ field: "from", operator: "contains", value: "  abcd  " }],
            },
        });

        await user.click(screen.getByTestId("btn_form_card_update"));

        await waitFor(() => {
            expect(dataHandler).toHaveBeenCalled();
        });
        expect(dataHandler.mock.calls[0][0].rules.fromContains).toEqual(["  abcd  "]);
    });

    it("links the rule value error to its input and announces it", async () => {
        const user = userEvent.setup();

        renderWorkspaceForm({
            dataHandler: vi.fn(),
            data: {
                id: "4cecb6b5-69cf-4f93-8c54-c12d206f0efd",
                description: "Support workspace",
                is_active: true,
                tag: "support",
                channel_hub_accounts: [{ id: "bb4e9857-11c1-43f4-9119-947d6a6f7587", email: "support@example.com" }],
                groups: [],
                tableRules: [{ field: "subject", operator: "contains", value: "abcd" }],
            },
        });

        const input = await screen.findByDisplayValue("abcd");
        expect(input).toHaveAttribute("aria-invalid", "false");
        expect(input).not.toHaveAttribute("aria-describedby");

        await user.clear(input);
        await user.type(input, "abc");
        await user.click(screen.getByTestId("btn_form_card_update"));

        const alert = await screen.findByRole("alert");
        expect(alert).toHaveTextContent("Minimum 4 characters");
        expect(input).toHaveAttribute("aria-invalid", "true");
        expect(input).toHaveAttribute("aria-describedby", alert.id);
    });

    it("submits without blocking on a row added with Add rule and left empty", async () => {
        const dataHandler = vi.fn();
        const user = userEvent.setup();

        renderWorkspaceForm({
            dataHandler,
            data: {
                id: "4cecb6b5-69cf-4f93-8c54-c12d206f0efd",
                description: "Support workspace",
                is_active: true,
                tag: "support",
                channel_hub_accounts: [{ id: "bb4e9857-11c1-43f4-9119-947d6a6f7587", email: "support@example.com" }],
                groups: [],
                tableRules: [{ field: "subject", operator: "contains", value: "abcd" }],
            },
        });

        await screen.findByDisplayValue("abcd");
        await user.click(screen.getByRole("button", { name: "Add rule" }));
        await user.click(screen.getByTestId("btn_form_card_update"));

        await waitFor(() => {
            expect(dataHandler).toHaveBeenCalled();
        });
        expect(screen.queryByTestId("workspace_rule_value_error_1")).not.toBeInTheDocument();
        expect(dataHandler.mock.calls[0][0].rules.subjectContains).toEqual(["abcd"]);
    });

    it("blocks submit and alerts when a rule row has a field and value but no operator", async () => {
        const dataHandler = vi.fn();
        const user = userEvent.setup();

        renderWorkspaceForm({
            dataHandler,
            data: {
                id: "4cecb6b5-69cf-4f93-8c54-c12d206f0efd",
                description: "Support workspace",
                is_active: true,
                tag: "support",
                channel_hub_accounts: [{ id: "bb4e9857-11c1-43f4-9119-947d6a6f7587", email: "support@example.com" }],
                groups: [],
                tableRules: [{ field: "subject", operator: "", value: "abcd" }],
            },
        });

        await screen.findByDisplayValue("abcd");
        await user.click(screen.getByTestId("btn_form_card_update"));

        expect(await screen.findByTestId("workspace_rule_operator_error_0")).toHaveTextContent("Required");
        expect(screen.getByTestId("workspace_rule_operator_error_0")).toHaveAttribute("role", "alert");
        const [fieldTrigger, operatorTrigger] = screen.getAllByRole("combobox");
        expect(operatorTrigger).toHaveAttribute("aria-invalid", "true");
        expect(operatorTrigger).toHaveAttribute("aria-describedby", "workspace_rule_operator_error_0");
        expect(fieldTrigger).toHaveAttribute("aria-invalid", "false");
        expect(fieldTrigger).not.toHaveAttribute("aria-describedby");
        expect(screen.queryByTestId("workspace_rule_field_error_0")).not.toBeInTheDocument();
        expect(screen.queryByTestId("workspace_rule_value_error_0")).not.toBeInTheDocument();
        expect(dataHandler).not.toHaveBeenCalled();
    });

    it("blocks submit when a value is typed on a row added with Add rule without field and operator", async () => {
        const dataHandler = vi.fn();
        const user = userEvent.setup();

        renderWorkspaceForm({
            dataHandler,
            data: {
                id: "4cecb6b5-69cf-4f93-8c54-c12d206f0efd",
                description: "Support workspace",
                is_active: true,
                tag: "support",
                channel_hub_accounts: [{ id: "bb4e9857-11c1-43f4-9119-947d6a6f7587", email: "support@example.com" }],
                groups: [],
                tableRules: [{ field: "subject", operator: "contains", value: "abcd" }],
            },
        });

        await screen.findByDisplayValue("abcd");
        await user.click(screen.getByRole("button", { name: "Add rule" }));
        await user.type(screen.getAllByPlaceholderText("workspace.placeholder.value")[1], "wxyz");
        await user.click(screen.getByTestId("btn_form_card_update"));

        expect(await screen.findByTestId("workspace_rule_field_error_1")).toHaveTextContent("Required");
        expect(screen.getByTestId("workspace_rule_operator_error_1")).toHaveTextContent("Required");
        expect(dataHandler).not.toHaveBeenCalled();
    });

    const workspaceWithRules = (tableRules) => ({
        id: "4cecb6b5-69cf-4f93-8c54-c12d206f0efd",
        description: "Support workspace",
        is_active: true,
        tag: "support",
        channel_hub_accounts: [{ id: "bb4e9857-11c1-43f4-9119-947d6a6f7587", email: "support@example.com" }],
        groups: [],
        tableRules,
    });

    it("names every rule cell by its column and row", async () => {
        renderWorkspaceForm({
            dataHandler: vi.fn(),
            data: workspaceWithRules([
                { field: "subject", operator: "contains", value: "abcd" },
                { field: "body", operator: "contains", value: "wxyz" },
            ]),
        });

        await screen.findByDisplayValue("abcd");
        [1, 2].forEach((row) => {
            expect.soft(screen.queryByRole("combobox", { name: `workspace.table.field ${row}` })).toBeInTheDocument();
            expect
                .soft(screen.queryByRole("combobox", { name: `workspace.table.operator ${row}` }))
                .toBeInTheDocument();
            expect.soft(screen.queryByRole("textbox", { name: `workspace.table.value ${row}` })).toBeInTheDocument();
        });
    });

    it("focuses the first invalid rule cell when submit is blocked", async () => {
        const user = userEvent.setup();

        renderWorkspaceForm({
            dataHandler: vi.fn(),
            data: workspaceWithRules([
                { field: "subject", operator: "contains", value: "abcd" },
                { field: "subject", operator: "", value: "ab" },
            ]),
        });

        await screen.findByDisplayValue("abcd");
        await user.click(screen.getByTestId("btn_form_card_update"));

        const operatorTrigger = screen.getByRole("combobox", { name: "workspace.table.operator 2" });
        await waitFor(() => expect(operatorTrigger).toHaveFocus());
    });

    it("keeps the focus where the user moves it after a blocked submit", async () => {
        const user = userEvent.setup();

        renderWorkspaceForm({
            dataHandler: vi.fn(),
            data: workspaceWithRules([{ field: "subject", operator: "contains", value: "ab" }]),
        });

        const valueInput = await screen.findByDisplayValue("ab");
        await user.click(screen.getByTestId("btn_form_card_update"));
        await waitFor(() => expect(valueInput).toHaveFocus());

        // Every keystroke validates again while the rule is still invalid.
        const descriptionInput = screen.getByDisplayValue("Support workspace");
        await user.type(descriptionInput, " team");

        expect(descriptionInput).toHaveValue("Support workspace team");
        expect(screen.getByTestId("workspace_rule_value_error_0")).toBeInTheDocument();
        expect(descriptionInput).toHaveFocus();
    });

    it("focuses the description input by id when only a non-rule field is invalid", async () => {
        const dataHandler = vi.fn();
        const user = userEvent.setup();

        renderWorkspaceForm({
            dataHandler,
            data: {
                ...workspaceWithRules([{ field: "subject", operator: "contains", value: "abcd" }]),
                description: "x",
            },
        });

        await screen.findByDisplayValue("abcd");
        await user.click(screen.getByTestId("btn_form_card_update"));

        const descriptionInput = screen.getByDisplayValue("x");
        // ui-shared/Input strips the name attribute from the DOM, so the fallback targets id.
        expect(descriptionInput).toHaveAttribute("id", "description");
        await waitFor(() => expect(descriptionInput).toHaveFocus());
        expect(dataHandler).not.toHaveBeenCalled();
    });

    it("focuses the Channel Hub accounts trigger when it is the only invalid field", async () => {
        const dataHandler = vi.fn();
        const user = userEvent.setup();

        renderWorkspaceForm({
            dataHandler,
            data: {
                ...workspaceWithRules([]),
                channel_hub_accounts: [],
            },
        });

        await user.click(screen.getByTestId("btn_form_card_update"));

        const trigger = screen.getByTestId("trigger_multiselect_channelHubAccounts");
        await waitFor(() => expect(trigger).toHaveFocus());
        // The trigger must carry an accessible name and describe its error so AT users
        // hear what just got focus and why.
        expect(trigger).toHaveAttribute("aria-label", "Channel Hub Accounts");
        expect(trigger).toHaveAttribute("aria-describedby", "workspace_channel_hub_accounts_error");
        expect(trigger).toHaveAttribute("aria-invalid", "true");
        expect(screen.getByTestId("workspace_channel_hub_accounts_error")).toHaveAttribute("role", "alert");
        expect(dataHandler).not.toHaveBeenCalled();
    });

    it("deactivates an active workspace from the switch keeping its persisted rules outside the 4-50 range", async () => {
        const dataHandler = vi.fn();
        const user = userEvent.setup();

        renderWorkspaceForm({
            dataHandler,
            data: {
                id: "4cecb6b5-69cf-4f93-8c54-c12d206f0efd",
                description: "Support workspace",
                is_active: true,
                tag: "support",
                rules: { ruleName: "support", subjectContains: ["IT"] },
                channel_hub_accounts: [{ id: "bb4e9857-11c1-43f4-9119-947d6a6f7587", email: "support@example.com" }],
                groups: [],
            },
        });

        await screen.findByDisplayValue("IT");
        const statusSwitch = screen.getByRole("switch");
        expect(statusSwitch).toBeChecked();
        await user.click(statusSwitch);
        expect(statusSwitch).not.toBeChecked();
        await user.click(screen.getByTestId("btn_form_card_update"));

        await waitFor(() => {
            expect(dataHandler).toHaveBeenCalled();
        });
        expect(dataHandler.mock.calls[0][0].is_active).toBe(false);
        expect(dataHandler.mock.calls[0][0]).not.toHaveProperty("rules");
        expect(screen.queryByTestId("workspace_rule_value_error_0")).not.toBeInTheDocument();
    });

    it("deactivates an existing workspace whose persisted rule values are outside the 4-50 range", async () => {
        const dataHandler = vi.fn();
        const user = userEvent.setup();

        renderWorkspaceForm({
            dataHandler,
            data: {
                id: "4cecb6b5-69cf-4f93-8c54-c12d206f0efd",
                description: "Support workspace",
                is_active: false,
                tag: "support",
                rules: { ruleName: "support", subjectContains: ["IT"] },
                channel_hub_accounts: [{ id: "bb4e9857-11c1-43f4-9119-947d6a6f7587", email: "support@example.com" }],
                groups: [],
            },
        });

        await screen.findByDisplayValue("IT");
        await user.click(screen.getByTestId("btn_form_card_update"));

        await waitFor(() => {
            expect(dataHandler).toHaveBeenCalled();
        });
        expect(dataHandler.mock.calls[0][0].is_active).toBe(false);
        expect(dataHandler.mock.calls[0][0]).not.toHaveProperty("rules");
        expect(screen.queryByTestId("workspace_rule_value_error_0")).not.toBeInTheDocument();
    });

    it("does not count an empty row added with Add rule as a rule change on an inactive workspace", async () => {
        const dataHandler = vi.fn();
        const user = userEvent.setup();

        renderWorkspaceForm({
            dataHandler,
            data: {
                id: "4cecb6b5-69cf-4f93-8c54-c12d206f0efd",
                description: "Support workspace",
                is_active: false,
                tag: "support",
                rules: { ruleName: "support", subjectContains: ["IT"] },
                channel_hub_accounts: [{ id: "bb4e9857-11c1-43f4-9119-947d6a6f7587", email: "support@example.com" }],
                groups: [],
            },
        });

        await screen.findByDisplayValue("IT");
        await user.click(screen.getByRole("button", { name: "Add rule" }));
        await user.click(screen.getByTestId("btn_form_card_update"));

        await waitFor(() => {
            expect(dataHandler).toHaveBeenCalled();
        });
        expect(dataHandler.mock.calls[0][0]).not.toHaveProperty("rules");
    });

    it("deactivates keeping a persisted legacy rule with an empty value without validating it", async () => {
        const dataHandler = vi.fn();
        const user = userEvent.setup();

        renderWorkspaceForm({
            dataHandler,
            data: {
                id: "4cecb6b5-69cf-4f93-8c54-c12d206f0efd",
                description: "Support workspace",
                is_active: false,
                tag: "support",
                rules: [{ field: "subject", operator: "contains", value: "" }],
                channel_hub_accounts: [{ id: "bb4e9857-11c1-43f4-9119-947d6a6f7587", email: "support@example.com" }],
                groups: [],
            },
        });

        await screen.findAllByPlaceholderText("workspace.placeholder.value");
        await user.click(screen.getByTestId("btn_form_card_update"));

        await waitFor(() => {
            expect(dataHandler).toHaveBeenCalled();
        });
        expect(dataHandler.mock.calls[0][0]).not.toHaveProperty("rules");
        expect(screen.queryByTestId("workspace_rule_value_error_0")).not.toBeInTheDocument();
    });

    it("counts a partially filled row as a rule change on an inactive workspace and blocks submit", async () => {
        const dataHandler = vi.fn();
        const user = userEvent.setup();

        renderWorkspaceForm({
            dataHandler,
            data: {
                id: "4cecb6b5-69cf-4f93-8c54-c12d206f0efd",
                description: "Support workspace",
                is_active: false,
                tag: "support",
                rules: { ruleName: "support", subjectContains: ["support rule"] },
                channel_hub_accounts: [{ id: "bb4e9857-11c1-43f4-9119-947d6a6f7587", email: "support@example.com" }],
                groups: [],
            },
        });

        await screen.findByDisplayValue("support rule");
        await user.click(screen.getByRole("button", { name: "Add rule" }));
        await user.type(screen.getAllByPlaceholderText("workspace.placeholder.value")[1], "wxyz");
        await user.click(screen.getByTestId("btn_form_card_update"));

        expect(await screen.findByTestId("workspace_rule_field_error_1")).toHaveTextContent("Required");
        expect(screen.getByTestId("workspace_rule_operator_error_1")).toHaveTextContent("Required");
        expect(dataHandler).not.toHaveBeenCalled();
    });

    it("validates and sends rules edited on an inactive workspace", async () => {
        const dataHandler = vi.fn();
        const user = userEvent.setup();

        renderWorkspaceForm({
            dataHandler,
            data: {
                id: "4cecb6b5-69cf-4f93-8c54-c12d206f0efd",
                description: "Support workspace",
                is_active: false,
                tag: "support",
                rules: { ruleName: "support", subjectContains: ["support rule"] },
                channel_hub_accounts: [{ id: "bb4e9857-11c1-43f4-9119-947d6a6f7587", email: "support@example.com" }],
                groups: [],
            },
        });

        const input = await screen.findByDisplayValue("support rule");
        await user.clear(input);
        await user.type(input, "abc");
        await user.click(screen.getByTestId("btn_form_card_update"));

        expect(await screen.findByTestId("workspace_rule_value_error_0")).toHaveTextContent("Minimum 4 characters");
        expect(dataHandler).not.toHaveBeenCalled();

        await user.type(input, "d");
        await user.click(screen.getByTestId("btn_form_card_update"));

        await waitFor(() => {
            expect(dataHandler).toHaveBeenCalled();
        });
        expect(dataHandler.mock.calls[0][0].rules.subjectContains).toEqual(["abcd"]);
    });

    it("validates rule values when creating an inactive workspace", async () => {
        const dataHandler = vi.fn();
        const user = userEvent.setup();

        renderWorkspaceForm({
            dataHandler,
            data: {
                description: "Support workspace",
                is_active: false,
                tag: "support",
                channel_hub_accounts: [{ id: "bb4e9857-11c1-43f4-9119-947d6a6f7587", email: "support@example.com" }],
                groups: [],
                tableRules: [{ field: "subject", operator: "contains", value: "IT" }],
            },
        });

        await screen.findByDisplayValue("IT");
        await user.click(screen.getByTestId("btn_form_card_save"));

        expect(await screen.findByTestId("workspace_rule_value_error_0")).toHaveTextContent("Minimum 4 characters");
        expect(dataHandler).not.toHaveBeenCalled();
    });

    it("requires fixing a persisted rule value outside the 4-50 range before updating", async () => {
        const dataHandler = vi.fn();
        const user = userEvent.setup();

        renderWorkspaceForm({
            dataHandler,
            data: {
                id: "4cecb6b5-69cf-4f93-8c54-c12d206f0efd",
                description: "Support workspace",
                is_active: true,
                tag: "support",
                rules: { ruleName: "support", subjectContains: ["abc"] },
                channel_hub_accounts: [{ id: "bb4e9857-11c1-43f4-9119-947d6a6f7587", email: "support@example.com" }],
                groups: [],
            },
        });

        await screen.findByDisplayValue("abc");
        await user.click(screen.getByTestId("btn_form_card_update"));

        expect(await screen.findByTestId("workspace_rule_value_error_0")).toHaveTextContent("Minimum 4 characters");
        expect(dataHandler).not.toHaveBeenCalled();

        await user.type(screen.getByDisplayValue("abc"), "d");
        await user.click(screen.getByTestId("btn_form_card_update"));

        await waitFor(() => {
            expect(dataHandler).toHaveBeenCalled();
        });
        expect(dataHandler.mock.calls[0][0].rules.subjectContains).toEqual(["abcd"]);
    });

    it("renders persisted API rules as editable rows on update", async () => {
        renderWorkspaceForm({
            dataHandler: vi.fn(),
            data: {
                id: "4cecb6b5-69cf-4f93-8c54-c12d206f0efd",
                description: "Support workspace",
                is_active: true,
                tag: "support",
                rules: {
                    ruleName: "support",
                    subjectContains: ["test"],
                    subjectEquals: [],
                    ccContains: [],
                    ccEquals: [],
                    fromContains: [],
                    fromEquals: [],
                    toContains: [],
                    toEquals: [],
                    bodyContains: [],
                    bodyEquals: [],
                    actionRules: {
                        classifyAs: "support",
                    },
                },
                channel_hub_accounts: [],
                groups: [],
            },
        });

        await waitFor(() => {
            expect(screen.getByDisplayValue("test")).toBeInTheDocument();
        });
        expect(screen.queryByText("No rules added")).not.toBeInTheDocument();
    });
});
