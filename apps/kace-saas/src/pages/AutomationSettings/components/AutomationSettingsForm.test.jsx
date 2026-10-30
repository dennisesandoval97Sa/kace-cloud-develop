import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import AutomationSettingsForm from "./AutomationSettingsForm.jsx";

const scrollIntoView = vi.fn();
Element.prototype.scrollIntoView = scrollIntoView;

/*
 * The days list (cmdk Command) scrolls its active item with `block: "nearest"`.
 * Only the form's own positioning uses `block: "center"`.
 */
const advancedScrollCalls = () => scrollIntoView.mock.calls.filter(([options]) => options?.block === "center");

const formTree = ({ data, dataHandler, mode, route, isReadOnly }) => (
    <MemoryRouter initialEntries={[route]}>
        <AutomationSettingsForm data={data} dataHandler={dataHandler} mode={mode} isReadOnly={isReadOnly} />
    </MemoryRouter>
);

const renderForm = ({ data, dataHandler = vi.fn(), mode = "edit", route = "/", isReadOnly = false }) => {
    scrollIntoView.mockClear();
    const utils = render(formTree({ data, dataHandler, mode, route, isReadOnly }));

    return {
        dataHandler,
        ...utils,
        rerenderForm: (nextData) => utils.rerender(formTree({ data: nextData, dataHandler, mode, route, isReadOnly })),
    };
};

const existingAutomation = (overrides = {}) => ({
    id: "11111111-1111-4111-8111-111111111111",
    description: "Automation",
    frequency: "15 9 1 * *",
    start_date: "2026-07-01T00:00:00.000Z",
    end_date: "2026-12-31T00:00:00.000Z",
    ...overrides,
});

describe("AutomationSettingsForm", () => {
    it("reopens a created custom cron in the advanced editor", async () => {
        const user = userEvent.setup();
        const create = renderForm({
            data: { description: "Monthly automation" },
            mode: "create",
        });

        await user.click(await screen.findByTestId("btn_automation_advanced_crontab_plus_icon"));
        const cronInput = await screen.findByTestId("input_form_custom_crontab");
        await user.clear(cronInput);
        await user.type(cronInput, "15 9 1 * *");
        await user.click(screen.getByTestId("btn_form_card_save"));

        await waitFor(() => expect(create.dataHandler).toHaveBeenCalledOnce());
        const persistedAutomation = create.dataHandler.mock.calls[0][0];
        expect(persistedAutomation.frequency).toBe("15 9 1 * *");
        create.unmount();

        renderForm({
            data: existingAutomation({
                ...persistedAutomation,
            }),
        });

        expect(await screen.findByTestId("input_form_custom_crontab")).toHaveValue("15 9 1 * *");
        expect(screen.queryByTestId("atomation_days_label")).not.toBeInTheDocument();
        await waitFor(() => expect(advancedScrollCalls()).toHaveLength(1));
    });

    it("opens a valid cron outside the simple parser range in the advanced editor", async () => {
        renderForm({
            data: existingAutomation({
                description: "Sunday automation",
                frequency: "15 9 * * 0",
            }),
        });

        expect(await screen.findByTestId("input_form_custom_crontab")).toHaveValue("15 9 * * 0");
        expect(screen.queryByTestId("atomation_days_label")).not.toBeInTheDocument();
    });

    it("keeps a preset-compatible cron in the simple frequency editor", async () => {
        renderForm({
            data: existingAutomation({
                description: "Frequent automation",
                frequency: "*/5 * * * *",
            }),
        });

        expect(await screen.findByTestId("atomation_days_label")).toBeInTheDocument();
        expect(screen.getByTestId("btn_select_form_trigger_every_5_minutes")).toBeInTheDocument();
        expect(screen.queryByTestId("input_form_custom_crontab")).not.toBeInTheDocument();
    });

    it("scrolls to the advanced frequency field when editing an advanced cron", async () => {
        renderForm({ data: existingAutomation({ frequency: "15 9 * * 0" }) });

        await screen.findByTestId("input_form_custom_crontab");
        await waitFor(() => expect(advancedScrollCalls()).toHaveLength(1));
    });

    /*
     * Moving focus on load is a context change the user did not start (WCAG 2.1 SC 3.2.1),
     * so the field is only scrolled into view.
     */
    it("leaves focus untouched when scrolling to the advanced frequency field", async () => {
        renderForm({ data: existingAutomation({ frequency: "15 9 * * 0" }) });

        const cronInput = await screen.findByTestId("input_form_custom_crontab");
        await waitFor(() => expect(advancedScrollCalls()).toHaveLength(1));
        expect(cronInput).not.toHaveFocus();
    });

    it("scrolls only once when the form rehydrates with a different advanced cron", async () => {
        const { rerenderForm } = renderForm({ data: existingAutomation({ frequency: "15 9 * * 0" }) });

        await screen.findByTestId("input_form_custom_crontab");
        await waitFor(() => expect(advancedScrollCalls()).toHaveLength(1));

        rerenderForm(existingAutomation({ frequency: "30 10 2 * *" }));

        expect(await screen.findByTestId("input_form_custom_crontab")).toHaveValue("30 10 2 * *");
        expect(advancedScrollCalls()).toHaveLength(1);
    });

    it("does not scroll when editing a preset-compatible cron", async () => {
        renderForm({ data: existingAutomation({ frequency: "*/5 * * * *" }) });

        await screen.findByTestId("atomation_days_label");
        expect(advancedScrollCalls()).toHaveLength(0);
    });

    it("does not scroll when only viewing an advanced cron", async () => {
        renderForm({
            data: existingAutomation({ frequency: "15 9 * * 0" }),
            route: "/?action=see",
            isReadOnly: true,
        });

        await screen.findByTestId("input_form_custom_crontab");
        expect(advancedScrollCalls()).toHaveLength(0);
    });

    it("does not scroll in create mode", async () => {
        renderForm({ data: { description: "New automation" }, mode: "create" });

        await screen.findByTestId("atomation_days_label");
        expect(advancedScrollCalls()).toHaveLength(0);
    });

    it("does not scroll when toggling the advanced editor in create mode", async () => {
        const user = userEvent.setup();
        renderForm({ data: { description: "New automation" }, mode: "create" });

        await user.click(await screen.findByTestId("btn_automation_advanced_crontab_plus_icon"));

        await screen.findByTestId("input_form_custom_crontab");
        expect(advancedScrollCalls()).toHaveLength(0);
    });

    it("does not scroll when toggling the advanced editor in edit mode with a preset cron", async () => {
        const user = userEvent.setup();
        renderForm({ data: existingAutomation({ frequency: "*/5 * * * *" }) });

        await screen.findByTestId("atomation_days_label");
        await user.click(screen.getByTestId("btn_automation_advanced_crontab_plus_icon"));

        await screen.findByTestId("input_form_custom_crontab");
        expect(advancedScrollCalls()).toHaveLength(0);
    });

    it("keeps the advanced editor controls disabled in read-only mode", async () => {
        renderForm({
            data: existingAutomation({ frequency: "15 9 * * 0" }),
            route: "/?action=see",
            isReadOnly: true,
        });

        expect(await screen.findByTestId("input_form_custom_crontab")).toBeDisabled();
        expect(screen.getByTestId("input_form_custom_description")).toBeDisabled();
        expect(screen.getByTestId("btn_automation_advanced_crontab_clean_icon")).toBeDisabled();
    });

    it("keeps the simple editor controls disabled in read-only mode", async () => {
        renderForm({
            data: existingAutomation({ frequency: "*/5 * * * *" }),
            route: "/?action=see",
            isReadOnly: true,
        });

        await screen.findByTestId("atomation_days_label");
        expect(screen.getByTestId("btn_select_form_trigger_every_5_minutes")).toBeDisabled();
        expect(screen.getByTestId("atomation_item_select_days_1")).toHaveAttribute("aria-disabled", "true");
    });

    it("disables the date range picker in read-only mode", async () => {
        renderForm({
            data: existingAutomation({ frequency: "*/5 * * * *" }),
            route: "/?action=see",
            isReadOnly: true,
        });

        await screen.findByTestId("atomation_days_label");

        expect(screen.getByTestId("btn_date_picker_with_range_2026-07-01_2026-12-31")).toBeDisabled();
    });

    /*
     * The route stays clean so the FormCard overlay does not swallow the click:
     * this asserts the form's own submit gate, not the overlay.
     */
    it("does not submit in read-only mode", async () => {
        const user = userEvent.setup();
        const update = renderForm({
            data: existingAutomation({ frequency: "15 9 * * 0" }),
            isReadOnly: true,
        });

        await screen.findByTestId("input_form_custom_crontab");
        await user.click(screen.getByTestId("btn_form_card_update"));

        expect(update.dataHandler).not.toHaveBeenCalled();
    });

    it.each([
        ["unchanged", null, "15 9 1 * *"],
        ["edited", "30 10 1 * *", "30 10 1 * *"],
    ])("submits an %s advanced cron without transforming it", async (_scenario, nextFrequency, expectedFrequency) => {
        const user = userEvent.setup();
        const update = renderForm({
            data: existingAutomation({
                description: "Monthly automation",
            }),
        });
        const cronInput = await screen.findByTestId("input_form_custom_crontab");

        if (nextFrequency) {
            await user.clear(cronInput);
            await user.type(cronInput, nextFrequency);
        }
        await user.click(screen.getByTestId("btn_form_card_update"));

        await waitFor(() => expect(update.dataHandler).toHaveBeenCalledOnce());
        expect(update.dataHandler.mock.calls[0][0].frequency).toBe(expectedFrequency);
    });

    it("rebuilds only a simple cron when its execution days change", async () => {
        const user = userEvent.setup();
        const update = renderForm({
            data: existingAutomation({
                description: "Frequent automation",
                frequency: "*/5 * * * *",
            }),
        });

        await user.click(await screen.findByTestId("atomation_item_select_days_1"));
        await user.click(screen.getByTestId("btn_form_card_update"));

        await waitFor(() => expect(update.dataHandler).toHaveBeenCalledOnce());
        expect(update.dataHandler.mock.calls[0][0].frequency).toBe("*/5 * * * 2,3,4,5,6,7");
    });
});
