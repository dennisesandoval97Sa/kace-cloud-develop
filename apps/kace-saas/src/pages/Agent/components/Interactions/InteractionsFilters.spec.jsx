import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import InteractionsFilters, { INTERACTION_SEARCH_DEBOUNCE_MS, MyReviewsFilter } from "./InteractionsFilters";

/* eslint-disable react/function-component-definition, react/prop-types */
vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key) =>
            ({
                "interactions.filters.open": "Open",
                "interactions.filters.closed": "Closed",
                "interactions.title.selectType": "Select type",
                "interactions.title.searchPlaceholder": "Search interactions",
                "agent.interactions.filters.myReviews": "My interactions under review",
            })[key] ?? key,
    }),
}));

vi.mock("@kace/ui-shared", async () => {
    const React = await vi.importActual("react");

    function SelectItem() {
        return null;
    }

    function SelectTrigger() {
        return null;
    }

    const findChildByType = (children, type) => {
        let match = null;

        React.Children.forEach(children, (child) => {
            if (match || !React.isValidElement(child)) return;
            if (child.type === type) {
                match = child;
                return;
            }

            match = findChildByType(child.props.children, type);
        });

        return match;
    };

    const collectOptions = (children) => {
        const options = [];

        React.Children.forEach(children, (child) => {
            if (!React.isValidElement(child)) return;
            if (child.type === SelectItem) {
                options.push(
                    <option key={child.props.value} value={child.props.value}>
                        {child.props.children}
                    </option>,
                );
                return;
            }

            options.push(...collectOptions(child.props.children));
        });

        return options;
    };

    function Select({ children, value, onValueChange, disabled }) {
        const trigger = findChildByType(children, SelectTrigger);

        return (
            <select
                aria-label={trigger?.props?.["aria-label"]}
                value={value}
                onChange={(event) => onValueChange(event.target.value)}
                disabled={disabled}
            >
                {collectOptions(children)}
            </select>
        );
    }

    function Checkbox({ id, checked, onCheckedChange, className }) {
        return (
            <input
                id={id}
                type="checkbox"
                checked={checked}
                onChange={(event) => onCheckedChange(event.target.checked)}
                className={className}
            />
        );
    }

    return {
        Checkbox,
        Select,
        SelectContent: ({ children }) => children,
        SelectItem,
        SelectTrigger,
        SelectValue: () => null,
    };
});
/* eslint-enable react/function-component-definition, react/prop-types */

const renderFilters = (props = {}) => {
    const defaultProps = {
        selectedType: "open",
        onTypeChange: vi.fn(),
        myReviewsOnly: false,
        searchTerm: "",
        onSearchChange: vi.fn(),
    };

    return render(<InteractionsFilters {...defaultProps} {...props} />);
};

describe("InteractionsFilters", () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it("offers only Open and Closed and defaults to Open", () => {
        renderFilters();

        const statusSelect = screen.getByRole("combobox", { name: "Select type" });

        expect(statusSelect).toHaveValue("open");
        expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["Open", "Closed"]);
    });

    it("preserves and disables the selected status while filtering current-agent reviews", () => {
        renderFilters({
            selectedType: "closed",
            myReviewsOnly: true,
        });

        expect(screen.getByRole("combobox", { name: "Select type" })).toHaveValue("closed");
        expect(screen.getByRole("combobox", { name: "Select type" })).toBeDisabled();
    });

    it("delegates review-only checkbox changes", async () => {
        const user = userEvent.setup();
        const onMyReviewsOnlyChange = vi.fn();

        render(<MyReviewsFilter myReviewsOnly onMyReviewsOnlyChange={onMyReviewsOnlyChange} />);
        const checkbox = screen.getByRole("checkbox", { name: "My interactions under review" });

        expect(checkbox).toHaveClass(
            "border-gray-300",
            "focus-visible:ring-purple-500",
            "data-[state=checked]:bg-purple-600",
        );

        await user.click(checkbox);

        expect(onMyReviewsOnlyChange).toHaveBeenCalledWith(false);
    });

    it("updates the search input immediately but debounces the committed search", () => {
        vi.useFakeTimers();
        const onSearchChange = vi.fn();

        renderFilters({ onSearchChange });

        const input = screen.getByPlaceholderText("Search interactions");
        act(() => {
            fireEvent.change(input, { target: { value: "pagos" } });
        });

        expect(input).toHaveValue("pagos");
        expect(onSearchChange).not.toHaveBeenCalled();

        act(() => {
            vi.advanceTimersByTime(INTERACTION_SEARCH_DEBOUNCE_MS - 1);
        });

        expect(onSearchChange).not.toHaveBeenCalled();

        act(() => {
            vi.advanceTimersByTime(1);
        });

        expect(onSearchChange).toHaveBeenCalledTimes(1);
        expect(onSearchChange).toHaveBeenCalledWith("pagos");
    });

    it("commits only the latest non-empty search value after the debounce delay", () => {
        vi.useFakeTimers();
        const onSearchChange = vi.fn();

        renderFilters({ onSearchChange });

        const input = screen.getByPlaceholderText("Search interactions");
        act(() => {
            fireEvent.change(input, { target: { value: "pa" } });
        });

        act(() => {
            vi.advanceTimersByTime(INTERACTION_SEARCH_DEBOUNCE_MS - 1);
        });

        act(() => {
            fireEvent.change(input, { target: { value: "pagos" } });
        });

        act(() => {
            vi.advanceTimersByTime(1);
        });

        expect(onSearchChange).not.toHaveBeenCalled();

        act(() => {
            vi.advanceTimersByTime(INTERACTION_SEARCH_DEBOUNCE_MS - 1);
        });

        expect(onSearchChange).toHaveBeenCalledTimes(1);
        expect(onSearchChange).toHaveBeenCalledWith("pagos");
    });

    it("commits clearing the search input immediately and does not leave a pending search", () => {
        vi.useFakeTimers();
        const onSearchChange = vi.fn();

        renderFilters({ searchTerm: "pagos", onSearchChange });

        const input = screen.getByPlaceholderText("Search interactions");
        act(() => {
            fireEvent.change(input, { target: { value: "" } });
        });

        expect(input).toHaveValue("");
        expect(onSearchChange).toHaveBeenCalledTimes(1);
        expect(onSearchChange).toHaveBeenCalledWith("");

        act(() => {
            vi.advanceTimersByTime(INTERACTION_SEARCH_DEBOUNCE_MS);
        });

        expect(onSearchChange).toHaveBeenCalledTimes(1);
    });

    it("syncs external committed search changes and cancels stale pending commits", () => {
        vi.useFakeTimers();
        const onSearchChange = vi.fn();
        const props = {
            selectedType: "open",
            onTypeChange: vi.fn(),
            myReviewsOnly: false,
            searchTerm: "",
            onSearchChange,
        };

        const { rerender } = render(<InteractionsFilters {...props} />);

        const input = screen.getByPlaceholderText("Search interactions");
        act(() => {
            fireEvent.change(input, { target: { value: "pagos" } });
        });

        rerender(<InteractionsFilters {...props} searchTerm="restored" />);

        expect(input).toHaveValue("restored");

        act(() => {
            vi.advanceTimersByTime(INTERACTION_SEARCH_DEBOUNCE_MS);
        });

        expect(onSearchChange).not.toHaveBeenCalled();
    });
});
