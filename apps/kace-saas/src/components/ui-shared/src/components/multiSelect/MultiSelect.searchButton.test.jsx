/* eslint-disable react/prop-types */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MultiSelect } from "./MultiSelect";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

vi.mock("@kace/ui-shared", () => ({
    GeneralLoader: () => <div>loading</div>,
}));

vi.mock("../ui/command", () => ({
    Command: ({ children }) => <div>{children}</div>,
    CommandEmpty: ({ children }) => <div>{children}</div>,
    CommandGroup: ({ children }) => <div>{children}</div>,
    CommandItem: ({ children, ...props }) => <div {...props}>{children}</div>,
    CommandList: ({ children }) => <div data-testid="multiselect-list">{children}</div>,
    CommandInput: ({ onValueChange, ...props }) => (
        <input {...props} onChange={(event) => onValueChange?.(event.target.value)} />
    ),
}));

vi.mock("../ui/popover", () => ({
    Popover: ({ children, open }) => <div data-testid="popover">{open ? children : null}</div>,
    PopoverTrigger: ({ children }) => <div>{children}</div>,
    PopoverContent: ({ children }) => <div>{children}</div>,
}));

vi.mock("../ui/button", () => ({
    Button: ({ children, ...props }) => <button {...props}>{children}</button>,
}));

vi.mock("./ListPopover", () => ({
    ListPopover: () => null,
}));

vi.mock("../../icons", () => ({
    CheckIcon: () => <span>check</span>,
    CheckAllIcon: () => <span>check-all</span>,
}));

const renderSelector = (props = {}) =>
    render(
        <MultiSelect
            data={[{ id: "1", label: "Soporte N1", value: "Soporte N1" }]}
            listValues={[]}
            setListValues={vi.fn()}
            open
            onOpenChange={vi.fn()}
            {...props}
        />,
    );

describe("MultiSelect explicit search action", () => {
    it("hides the search action when the consumer wires no server-side search", () => {
        renderSelector();

        expect(screen.queryByTestId("btn_search")).not.toBeInTheDocument();
    });

    it("keeps the search action and forwards the typed query when setSearchQuery is provided", async () => {
        const setSearchQuery = vi.fn();
        renderSelector({ setSearchQuery });

        fireEvent.change(screen.getByTestId("input_search"), { target: { value: "sopor" } });
        fireEvent.click(screen.getByTestId("btn_search"));

        expect(setSearchQuery).toHaveBeenCalledWith({ input: "sopor", filter: "" });
        await waitFor(() => {
            expect(setSearchQuery).toHaveBeenCalledWith({ input: "sopor", filter: "sopor" });
        });
    });

    it("still honours an explicit hideSearchButton alongside setSearchQuery", () => {
        renderSelector({ setSearchQuery: vi.fn(), hideSearchButton: true });

        expect(screen.queryByTestId("btn_search")).not.toBeInTheDocument();
    });
});
