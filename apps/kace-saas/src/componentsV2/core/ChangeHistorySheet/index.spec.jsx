import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ChangeHistorySheet from "./index";

const debouncedOnFetch = vi.fn();
let historyState;

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

vi.mock("react-intersection-observer", () => ({
    useInView: () => ({ ref: vi.fn(), inView: true }),
}));

vi.mock("./hooks/useChangeHistory", () => ({
    default: () => historyState,
}));

vi.mock("./components/ChangeHistorySheeError", () => ({ default: () => null }));

vi.mock("./components/ChangeHistorySheetTimeline", () => ({ default: () => null }));

describe("ChangeHistorySheet - scroll infinito", () => {
    beforeEach(() => {
        debouncedOnFetch.mockClear();
        historyState = {
            historyData: [],
            refetch: vi.fn(),
            debouncedOnFetch,
            hasNextPage: true,
            isFetchingNextPage: false,
            status: "success",
        };
    });

    it("pide la siguiente página otra vez cuando termina de cargar y el final sigue visible", () => {
        const { rerender } = render(<ChangeHistorySheet />);
        expect(debouncedOnFetch).toHaveBeenCalledTimes(1);

        historyState = { ...historyState, isFetchingNextPage: true };
        rerender(<ChangeHistorySheet />);
        expect(debouncedOnFetch).toHaveBeenCalledTimes(1);

        historyState = { ...historyState, isFetchingNextPage: false };
        rerender(<ChangeHistorySheet />);
        expect(debouncedOnFetch).toHaveBeenCalledTimes(2);
    });

    it("no pide más páginas cuando ya no quedan", () => {
        historyState = { ...historyState, hasNextPage: false };
        render(<ChangeHistorySheet />);

        expect(debouncedOnFetch).not.toHaveBeenCalled();
    });
});

describe("ChangeHistorySheet - accesibilidad", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    beforeEach(() => {
        historyState = {
            historyData: [],
            refetch: vi.fn(),
            debouncedOnFetch: vi.fn(),
            hasNextPage: false,
            isFetchingNextPage: false,
            status: "success",
        };
    });

    it("el botón de apertura es un único botón con nombre accesible que controla el panel", () => {
        render(<ChangeHistorySheet />);

        const trigger = screen.getByRole("button", { name: "app.title.historyChanges" });
        expect(screen.getAllByRole("button")).toHaveLength(1);
        expect(trigger).toHaveAttribute("data-testid", "change_history_trigger_button");
        expect(trigger).toHaveAttribute("aria-expanded", "false");
    });

    it("el control de cierre es un botón con nombre accesible que cierra el panel", () => {
        render(<ChangeHistorySheet />);
        fireEvent.click(screen.getByTestId("change_history_trigger_button"));

        const closeButton = screen.getByRole("button", { name: "button.close" });
        expect(closeButton).toHaveAttribute("data-testid", "change_history_close");

        fireEvent.click(closeButton);
        expect(screen.queryByTestId("change_history_content")).not.toBeInTheDocument();
    });

    it("el panel abierto se anuncia con su título y sin ids duplicados", () => {
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
        const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
        render(<ChangeHistorySheet />);
        fireEvent.click(screen.getByTestId("change_history_trigger_button"));

        expect(screen.getByRole("dialog", { name: "app.title.historyChanges" })).toBeInTheDocument();
        expect(document.querySelectorAll("#change_history_sheet")).toHaveLength(1);
        expect(screen.getByTestId("change_history_header")).toBeInTheDocument();
        expect(consoleError).not.toHaveBeenCalled();
        expect(consoleWarn).not.toHaveBeenCalled();
    });
});
