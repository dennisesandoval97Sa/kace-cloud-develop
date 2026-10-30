import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useGenericSearchQuery from "@/hooks/useGenericSearchQuery";
import ChannelHubCreateForm from "./ChannelHubCreateForm";
import { CHANNEL_HUB_EXTERNAL_CODES } from "../data/externalCodes";

const registrationFlowId = "6f0d7ac9-6f9c-4b69-b3cb-63ec0b935a4a";

vi.mock("@/hooks/useGenericSearchQuery", () => ({
    default: vi.fn(),
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key) =>
            ({
                "channelHub.noRegistrationFlows": "No active Channel Hub registration flows are available.",
                "genericTexts.loading": "Loading...",
            })[key] ?? key,
    }),
}));

describe("ChannelHubCreateForm", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useGenericSearchQuery.mockReturnValue({
            data: [{ id: registrationFlowId, description: "Channel Hub - Crear conexion" }],
            isLoading: false,
        });
    });

    it("searches active primary registration flows in description order", () => {
        render(
            <MemoryRouter>
                <ChannelHubCreateForm dataHandler={vi.fn()} />
            </MemoryRouter>,
        );

        expect(useGenericSearchQuery).toHaveBeenCalledWith(
            expect.objectContaining({
                keyQuery: "channel-hub-registration-flows",
                url: "/ws-rest-flows/search",
                table: "ws_rest_flows",
                order: { field: "description", direction: "asc" },
                filter: [
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
                ],
            }),
        );
    });

    it("maps registration flow labels from description or external code", () => {
        render(
            <MemoryRouter>
                <ChannelHubCreateForm dataHandler={vi.fn()} />
            </MemoryRouter>,
        );

        const select = useGenericSearchQuery.mock.calls[0][0].select;

        expect(
            select({
                data: [
                    { id: registrationFlowId, description: "Gmail connection" },
                    { id: "1b99d5fd-ced2-4d58-8fc2-f3000a407cd3", external_code: "channelhub-connection-outlook" },
                ],
            }),
        ).toEqual([
            { id: registrationFlowId, description: "Gmail connection" },
            { id: "1b99d5fd-ced2-4d58-8fc2-f3000a407cd3", description: "channelhub-connection-outlook" },
        ]);
    });

    it("disables the rest flow select and explains when no active registration flows exist", () => {
        useGenericSearchQuery.mockReturnValueOnce({ data: [], isLoading: false });

        render(
            <MemoryRouter>
                <ChannelHubCreateForm dataHandler={vi.fn()} />
            </MemoryRouter>,
        );

        expect(screen.getByTestId("channel_hub_form_rest_flow_id")).toBeDisabled();
        expect(screen.getByTestId("channel_hub_form_rest_flow_empty")).toHaveTextContent(
            "No active Channel Hub registration flows are available.",
        );
    });

    it("submits the selected Channel Hub operator", async () => {
        const dataHandler = vi.fn().mockResolvedValue(undefined);
        const user = userEvent.setup();

        render(
            <MemoryRouter>
                <ChannelHubCreateForm dataHandler={dataHandler} />
            </MemoryRouter>,
        );

        await user.type(screen.getByTestId("input_form_modal_email"), "support@example.com");
        await user.type(screen.getByTestId("input_form_modal_name"), "Support");
        await user.type(screen.getByTestId("input_form_modal_country_id"), "co");
        await user.selectOptions(screen.getByTestId("channel_hub_form_operator_id"), "microsoft");
        await user.selectOptions(screen.getByTestId("channel_hub_form_rest_flow_id"), registrationFlowId);

        await user.click(screen.getByTestId("btn_form_card_save"));

        await waitFor(() => {
            expect(dataHandler).toHaveBeenCalledWith(
                expect.objectContaining({ operator_id: "microsoft" }),
                expect.any(Function),
                expect.any(Function),
            );
        });
    });

    it("locks operator and email but keeps name, country and rest flow editable in edit mode", () => {
        const dataHandler = vi.fn().mockResolvedValue(undefined);

        render(
            <MemoryRouter initialEntries={["/channel-hub/update/account-1"]}>
                <ChannelHubCreateForm
                    dataHandler={dataHandler}
                    data={{
                        id: "account-1",
                        email: "support@example.com",
                        name: "Support",
                        country_id: "co",
                        operator_id: "microsoft",
                        rest_flow_id: registrationFlowId,
                    }}
                    isEditMode
                />
            </MemoryRouter>,
        );

        // Operator and email are immutable on update: visible but disabled.
        expect(screen.getByTestId("channel_hub_form_operator_id")).toBeDisabled();
        expect(screen.getByTestId("input_form_modal_email")).toBeDisabled();

        // Name, country and rest flow stay editable (rest flow editable to fix a wrong pick on create).
        expect(screen.getByTestId("input_form_modal_name")).toBeEnabled();
        expect(screen.getByTestId("input_form_modal_country_id")).toBeEnabled();
        expect(screen.getByTestId("channel_hub_form_rest_flow_id")).toBeEnabled();
    });

    it("disables editable controls and submit when rendered in read-only view mode", () => {
        const dataHandler = vi.fn().mockResolvedValue(undefined);

        render(
            <MemoryRouter initialEntries={["/channel-hub/update/account-1?action=see"]}>
                <ChannelHubCreateForm
                    dataHandler={dataHandler}
                    data={{
                        id: "account-1",
                        email: "support@example.com",
                        name: "Support",
                        country_id: "co",
                        operator_id: "microsoft",
                        rest_flow_id: registrationFlowId,
                    }}
                    isEditMode
                    isReadOnly
                />
            </MemoryRouter>,
        );

        expect(screen.getByTestId("input_form_modal_email")).toBeDisabled();
        expect(screen.getByTestId("input_form_modal_name")).toBeDisabled();
        expect(screen.getByTestId("input_form_modal_country_id")).toBeDisabled();
        expect(screen.getByTestId("channel_hub_form_operator_id")).toBeDisabled();
        expect(screen.getByTestId("channel_hub_form_rest_flow_id")).toBeDisabled();
        expect(screen.getByTestId("btn_form_card_update")).toBeDisabled();
    });
});
