import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SelectByListLevels } from "./SelectByListLevels";

Object.defineProperties(HTMLElement.prototype, {
    hasPointerCapture: { configurable: true, value: () => false },
    releasePointerCapture: { configurable: true, value: () => {} },
    scrollIntoView: { configurable: true, value: () => {} },
    setPointerCapture: { configurable: true, value: () => {} },
});

vi.mock("@kace/utils", () => ({
    apiService: { get: vi.fn(() => Promise.resolve({ data: { data: { items: [] } } })) },
    CLASSIFICATION_LEVELS_SERVICE: "/classification-levels",
}));

const renderWithClient = (ui) => {
    const queryClient = new QueryClient();
    return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

describe("SelectByListLevels", () => {
    it("offers all 10 levels by default (classic view / no maxLevel passed)", async () => {
        const user = userEvent.setup();
        renderWithClient(<SelectByListLevels value="" onChange={vi.fn()} />);

        await user.click(screen.getByTestId("btn_select_levels"));

        for (let level = 1; level <= 10; level += 1) {
            expect(screen.queryAllByTestId(`select_item_nivel${level}`).length).toBeGreaterThan(0);
        }
    });

    it("only offers levels up to maxLevel when the active view doesn't cover the rest (custom view scenario)", async () => {
        const user = userEvent.setup();
        renderWithClient(<SelectByListLevels value="" onChange={vi.fn()} maxLevel={5} />);

        await user.click(screen.getByTestId("btn_select_levels"));

        for (let level = 1; level <= 5; level += 1) {
            expect(screen.queryAllByTestId(`select_item_nivel${level}`).length).toBeGreaterThan(0);
        }
        for (let level = 6; level <= 10; level += 1) {
            expect(screen.queryAllByTestId(`select_item_nivel${level}`)).toHaveLength(0);
        }
    });

    it("renders no level options when maxLevel is 0 (custom view without classification columns)", async () => {
        const user = userEvent.setup();
        renderWithClient(<SelectByListLevels value="" onChange={vi.fn()} maxLevel={0} />);

        await user.click(screen.getByTestId("btn_select_levels"));

        expect(screen.queryAllByTestId("select_item_nivel1")).toHaveLength(0);
    });
});
