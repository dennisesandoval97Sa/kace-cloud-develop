/* eslint-disable react/prop-types */
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MultiSelectTemplate } from "./MultiSelectTemplate";

const hookState = {
    data: [{ id: "t1", label: "Alpha", value: "Alpha" }],
    isLoading: false,
    isLoadingMore: false,
    hasMore: true,
    searchQuery: { input: "", filter: "" },
    setSearchQuery: vi.fn(),
    setPage: vi.fn(),
    followInput: false,
    hideSearchButton: true,
    open: false,
    onOpenChange: vi.fn(),
    selectAllMatchingOrClear: vi.fn(),
};

vi.mock("../hooks/useClassificationTemplateSelect", () => ({
    useClassificationTemplateSelect: () => hookState,
}));

vi.mock("@kace/ui-shared", () => ({
    MultiSelect: (props) => (
        <div
            data-testid="ui-shared-multiselect"
            data-hide-search-button={String(props.hideSearchButton)}
            data-follow-input={String(props.followInput)}
            data-has-more={String(props.hasMore)}
            data-options={JSON.stringify(props.data)}
            data-open={String(props.open)}
            data-has-on-select-all={String(typeof props.onSelectAll === "function")}
        >
            <button type="button" data-testid="trigger-select-all" onClick={props.onSelectAll}>
                select all
            </button>
        </div>
    ),
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

describe("MultiSelectTemplate", () => {
    beforeEach(() => {
        hookState.selectAllMatchingOrClear.mockClear();
        hookState.searchQuery = { input: "", filter: "" };
        hookState.data = [{ id: "t1", label: "Alpha", value: "Alpha" }];
    });

    it("hides the search button and wires hook pagination/search/popover props", () => {
        render(<MultiSelectTemplate listValues={[]} setListValues={vi.fn()} />);

        const node = screen.getByTestId("ui-shared-multiselect");
        expect(node).toHaveAttribute("data-hide-search-button", "true");
        expect(node).toHaveAttribute("data-follow-input", "false");
        expect(node).toHaveAttribute("data-has-more", "true");
        expect(node).toHaveAttribute("data-options", JSON.stringify(hookState.data));
        expect(node).toHaveAttribute("data-open", "false");
        expect(node).toHaveAttribute("data-has-on-select-all", "true");
    });

    it("appends missing selected values after page data, sorted alphabetically among themselves", () => {
        const missingZ = { id: "tz", label: "Zulu Missing", value: "Zulu Missing" };
        const missingA = { id: "ta", label: "AAA Missing", value: "AAA Missing" };
        render(<MultiSelectTemplate listValues={[missingZ, missingA]} setListValues={vi.fn()} />);

        const node = screen.getByTestId("ui-shared-multiselect");
        const options = JSON.parse(node.getAttribute("data-options"));

        expect(options).toEqual([{ id: "t1", label: "Alpha", value: "Alpha" }, missingA, missingZ]);
    });

    it("hides missing selected values that do not match the active search filter", () => {
        hookState.searchQuery = { input: "zzz", filter: "zzz" };
        const missingSelected = { id: "t9", label: "AAA Missing", value: "AAA Missing" };
        render(<MultiSelectTemplate listValues={[missingSelected]} setListValues={vi.fn()} />);

        const node = screen.getByTestId("ui-shared-multiselect");
        const options = JSON.parse(node.getAttribute("data-options"));

        expect(options).toEqual([{ id: "t1", label: "Alpha", value: "Alpha" }]);
        hookState.searchQuery = { input: "", filter: "" };
    });

    it("does not duplicate a selected value that is already present in the hook data", () => {
        const alreadyLoaded = { id: "t1", label: "Alpha", value: "Alpha" };
        render(<MultiSelectTemplate listValues={[alreadyLoaded]} setListValues={vi.fn()} />);

        const node = screen.getByTestId("ui-shared-multiselect");
        const options = JSON.parse(node.getAttribute("data-options"));

        expect(options).toEqual(hookState.data);
    });

    it("delegates select-all to selectAllMatchingOrClear with current selection and setter", () => {
        const setListValues = vi.fn();
        const listValues = [{ id: "t1", label: "Alpha", value: "Alpha" }];

        render(<MultiSelectTemplate listValues={listValues} setListValues={setListValues} />);
        fireEvent.click(screen.getByTestId("trigger-select-all"));

        expect(hookState.selectAllMatchingOrClear).toHaveBeenCalledWith(listValues, setListValues);
    });
});
