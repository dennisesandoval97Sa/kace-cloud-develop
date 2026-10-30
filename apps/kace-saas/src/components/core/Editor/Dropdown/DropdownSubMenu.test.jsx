import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DropdownSubMenu } from "./DropdownSubMenu";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key, fallback) => fallback ?? key }),
}));

vi.mock("@tanstack/react-query", () => ({
    useQuery: ({ queryKey }) => {
        const url = queryKey[2];
        const fixtures = {
            cases: [
                { column_name: "updated_at" },
                { column_name: "canal_id" },
                { column_name: "sla_remaining_days" },
                { column_name: "sla_elapsed_time" },
                { column_name: "descripción" },
                { column_name: "estado_actual" },
            ],
        };
        return { data: fixtures[url] ?? [] };
    },
}));

vi.mock("@/hooks/useAuxiliariesOptions", () => ({
    default: () => ({ auxiliariesRules: [] }),
}));

import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuTrigger } from "@kace/ui-shared";

describe("DropdownSubMenu — sort and search", () => {
    const openSubMenu = async () => {
        render(
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button type="button">open</button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuGroup>
                        <DropdownSubMenu text="cases" schema="cases" url="cases" handleSelectChange={() => {}} />
                    </DropdownMenuGroup>
                </DropdownMenuContent>
            </DropdownMenu>,
        );
        await userEvent.click(screen.getByRole("button", { name: "open" }));
        const trigger = screen.getByTestId("subMenuTrigger_cases");
        await userEvent.click(trigger);
    };

    it("renders options sorted alphabetically by column_name (case- and accent-insensitive)", async () => {
        await openSubMenu();
        const items = await screen.findAllByTestId(/^subMenuOption_cases_/);
        const labels = items.map((el) => el.textContent);
        expect(labels).toEqual([
            "canal_id",
            "descripción",
            "estado_actual",
            "sla_elapsed_time",
            "sla_remaining_days",
            "updated_at",
        ]);
    });

    it("filters options by substring, case-insensitive", async () => {
        await openSubMenu();
        const input = await screen.findByRole("searchbox");
        await userEvent.type(input, "SLA");
        const items = await screen.findAllByTestId(/^subMenuOption_cases_/);
        const labels = items.map((el) => el.textContent);
        expect(labels).toEqual(["sla_elapsed_time", "sla_remaining_days"]);
    });

    it("matches across accents when filtering", async () => {
        await openSubMenu();
        const input = await screen.findByRole("searchbox");
        await userEvent.type(input, "descrip");
        const items = await screen.findAllByTestId(/^subMenuOption_cases_/);
        const labels = items.map((el) => el.textContent);
        expect(labels).toEqual(["descripción"]);
    });

    it("shows the no-results message when no option matches", async () => {
        await openSubMenu();
        const input = await screen.findByRole("searchbox");
        await userEvent.type(input, "zzzzz");
        expect(screen.getByText("app.dropdown.noResults")).toBeInTheDocument();
        expect(screen.queryAllByTestId(/^subMenuOption_cases_/)).toHaveLength(0);
    });

    it("resets the search query on remount (guards against lifting the state out of useState)", async () => {
        // First mount: type a query, assert the filtered list.
        const { unmount } = render(
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button type="button">open</button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuGroup>
                        <DropdownSubMenu text="cases" schema="cases" url="cases" handleSelectChange={() => {}} />
                    </DropdownMenuGroup>
                </DropdownMenuContent>
            </DropdownMenu>,
        );
        await userEvent.click(screen.getByRole("button", { name: "open" }));
        await userEvent.click(screen.getByTestId("subMenuTrigger_cases"));
        const input = await screen.findByRole("searchbox");
        await userEvent.type(input, "SLA");
        const filtered = await screen.findAllByTestId(/^subMenuOption_cases_/);
        expect(filtered.map((el) => el.textContent)).toEqual(["sla_elapsed_time", "sla_remaining_days"]);

        // Simulate Radix unmount on dropdown close.
        unmount();

        // Simulate reopen: a fresh mount of the same component (Radix re-creates
        // the subtree). The search input must be empty, the full list back.
        render(
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button type="button">open</button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuGroup>
                        <DropdownSubMenu text="cases" schema="cases" url="cases" handleSelectChange={() => {}} />
                    </DropdownMenuGroup>
                </DropdownMenuContent>
            </DropdownMenu>,
        );
        await userEvent.click(screen.getByRole("button", { name: "open" }));
        await userEvent.click(screen.getByTestId("subMenuTrigger_cases"));
        const reopenedInput = await screen.findByRole("searchbox");
        expect(reopenedInput.value).toBe("");
        const allItems = await screen.findAllByTestId(/^subMenuOption_cases_/);
        expect(allItems).toHaveLength(6);
    });
});
