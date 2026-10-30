import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DropdownMenuModel } from "./DropdownMenuModel";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key, fallback) => fallback ?? key }),
}));

vi.mock("@tanstack/react-query", () => ({
    useQuery: () => ({ data: [] }),
}));

vi.mock("@/hooks/useAuxiliariesOptions", () => ({
    default: () => ({ auxiliariesRules: [] }),
}));

describe("DropdownMenuModel — top-level sort and search", () => {
    const openMenu = async () => {
        render(<DropdownMenuModel handleSelectChange={() => {}} />);
        const trigger = screen.getByTestId("dropdown_menu_model_fields");
        await userEvent.click(trigger);
    };

    it("renders models sorted alphabetically by text", async () => {
        await openMenu();
        const triggers = await screen.findAllByTestId(/^subMenuTrigger_/);
        const labels = triggers.map((el) => el.textContent);
        expect(labels).toEqual(["aux_cases", "aux_clients", "cases", "classifications", "clients", "states", "users"]);
    });

    it("filters models by substring, case-insensitive", async () => {
        await openMenu();
        const input = await screen.findByRole("searchbox");
        await userEvent.type(input, "clie");
        const triggers = await screen.findAllByTestId(/^subMenuTrigger_/);
        const labels = triggers.map((el) => el.textContent);
        expect(labels).toEqual(["aux_clients", "clients"]);
    });

    it("shows the no-results message when no model matches", async () => {
        await openMenu();
        const input = await screen.findByRole("searchbox");
        await userEvent.type(input, "zzzzz");
        expect(screen.getByText("app.dropdown.noResults")).toBeInTheDocument();
        expect(screen.queryAllByTestId(/^subMenuTrigger_/)).toHaveLength(0);
    });
});
