import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { joiFormikAdapter } from "@kace/utils";
import { AutomationSettingsUpdateSchema } from "../../../schemas/AutomationSettingsSchema";
import AutomationSettingsForm from "./AutomationSettingsForm";

window.HTMLElement.prototype.scrollIntoView = vi.fn();

vi.mock("react-i18next", async (importOriginal) => ({
    ...(await importOriginal()),
    useTranslation: () => ({
        i18n: { language: "en" },
        t: (key) => {
            if (key === "button.update") return "Update";
            if (key === "button.save") return "Save";
            if (key === "app.title.automationSettings") return "Automation Settings";
            return key;
        },
    }),
}));

vi.mock("@kace/utils", async (importOriginal) => {
    const actual = await importOriginal();

    return {
        ...actual,
        joiFormikAdapter: vi.fn(actual.joiFormikAdapter),
    };
});

describe("AutomationSettingsForm mode", () => {
    it("uses update semantics and the update schema in edit mode", async () => {
        const dataHandler = vi.fn();

        render(
            <MemoryRouter>
                <AutomationSettingsForm
                    data={{
                        description: "Existing automation",
                        frequency: "0 * * * *",
                        start_date: "2026-01-01T00:00:00.000Z",
                        end_date: "2026-12-31T00:00:00.000Z",
                    }}
                    dataHandler={dataHandler}
                    mode="edit"
                />
            </MemoryRouter>,
        );

        expect(await screen.findByRole("button", { name: "Update" })).toBeInTheDocument();
        expect(joiFormikAdapter).toHaveBeenCalledWith(AutomationSettingsUpdateSchema);
    });
});
