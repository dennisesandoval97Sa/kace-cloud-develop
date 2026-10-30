import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DropdownSearch } from "./DropdownSearch";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

describe("DropdownSearch", () => {
    it('renders a controlled <input type="search"> with the given value and placeholder', () => {
        render(<DropdownSearch value="abc" onChange={() => {}} placeholder="Find" />);
        const input = screen.getByRole("searchbox");
        expect(input).toBeInTheDocument();
        expect(input.value).toBe("abc");
        expect(input.placeholder).toBe("Find");
        expect(input.getAttribute("aria-label")).toBe("app.dropdown.searchAriaLabel");
    });

    it("calls onChange with the new value on each keystroke", () => {
        const onChange = vi.fn();
        render(<DropdownSearch value="" onChange={onChange} />);
        const input = screen.getByRole("searchbox");
        fireEvent.change(input, { target: { value: "x" } });
        fireEvent.change(input, { target: { value: "xy" } });
        expect(onChange).toHaveBeenNthCalledWith(1, "x");
        expect(onChange).toHaveBeenNthCalledWith(2, "xy");
    });

    it("stops every keydown from bubbling so Radix DropdownMenu does not consume printable characters for typeahead", () => {
        const parentKeyDown = vi.fn();
        render(
            <div onKeyDown={parentKeyDown}>
                <DropdownSearch value="" onChange={() => {}} />
            </div>,
        );
        const input = screen.getByRole("searchbox");

        fireEvent.keyDown(input, { key: "Escape" });
        fireEvent.keyDown(input, { key: "Enter" });
        fireEvent.keyDown(input, { key: "ArrowDown" });
        fireEvent.keyDown(input, { key: "a" });

        expect(parentKeyDown).not.toHaveBeenCalled();
    });
});
