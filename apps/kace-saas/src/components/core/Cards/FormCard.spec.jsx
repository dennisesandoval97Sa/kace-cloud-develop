import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import FormCard from "./FormCard";

vi.mock("@/services/cognitoService", () => ({ handlerLogout: vi.fn() }));

const renderFormCard = (url, props = {}) =>
    render(
        <MemoryRouter initialEntries={[url]}>
            <Routes>
                <Route
                    path="/module/update/:id"
                    element={
                        <FormCard isId title="Module" {...props}>
                            <button type="button">Add item</button>
                        </FormCard>
                    }
                />
            </Routes>
        </MemoryRouter>,
    );

describe("FormCard", () => {
    it("disables every button inside the form when viewing a record", () => {
        renderFormCard("/module/update/1?action=see");

        expect(screen.getByRole("button", { name: "Add item" })).toBeDisabled();
        expect(screen.getByTestId("btn_form_card_update")).toBeDisabled();
        expect(screen.getByTestId("btn_back_form_card")).toBeEnabled();
    });

    it("keeps the form buttons enabled when editing a record", () => {
        renderFormCard("/module/update/1");

        expect(screen.getByRole("button", { name: "Add item" })).toBeEnabled();
        expect(screen.getByTestId("btn_form_card_update")).toBeEnabled();
    });

    it("leaves the content enabled when the page manages read only itself", () => {
        renderFormCard("/module/update/1?action=see", { lockChildrenInSeeMode: false });

        expect(screen.getByRole("button", { name: "Add item" })).toBeEnabled();
        expect(screen.getByTestId("btn_form_card_update")).toBeDisabled();
    });
});
