/* eslint-disable react/prop-types */
import React, { forwardRef } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Select } from "./Select";

const setValueMock = vi.fn();
const fieldState = { value: "", name: "flujo_id" };

vi.mock("formik", () => ({
    useField: () => [fieldState, { touched: false, error: undefined }, { setValue: setValueMock, setTouched: vi.fn() }],
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key) =>
            ({
                "genericTexts.loading": "Cargando...",
                "select.searchPlaceholder": "Buscar...",
                "select.options": "Opciones",
                "select.noOptions": "No hay opciones disponibles",
                "button.clearSelection": "Limpiar selección",
            })[key] ?? key,
    }),
}));

vi.mock("@kace/ui-shared", () => ({
    Select: ({ children, onOpenChange, disabled }) => (
        <div data-testid="radix-select" data-disabled={String(Boolean(disabled))}>
            <button type="button" data-testid="open-select" disabled={disabled} onClick={() => onOpenChange?.(true)} />
            {children}
            <button type="button" data-testid="close-select" onClick={() => onOpenChange?.(false)} />
        </div>
    ),
    SelectContent: forwardRef(function SelectContentMock(
        { children, onScroll, onWheel, onTouchStart, onPointerDown, onPointerMove, onKeyDown, header },
        ref,
    ) {
        return (
            <div
                ref={ref}
                data-testid="select-content"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onKeyDown={onKeyDown}
            >
                {header ? <div data-testid="select-content-header">{header}</div> : null}
                <div data-testid="select-viewport" onScroll={onScroll} onWheel={onWheel} onTouchStart={onTouchStart}>
                    {children}
                </div>
                <button type="button" data-testid="select-scroll-down">
                    down
                </button>
            </div>
        );
    }),
    SelectGroup: ({ children }) => <div>{children}</div>,
    SelectItem: ({ children, value }) => <div data-testid={`item-${value}`}>{children}</div>,
    SelectLabel: ({ children }) => <div>{children}</div>,
    SelectTrigger: ({ children, ...props }) => (
        <button type="button" {...props}>
            {children}
        </button>
    ),
    SelectValue: ({ placeholder }) => <span>{placeholder}</span>,
    Label: ({ children }) => <label>{children}</label>,
    GeneralLoader: () => <div>loading</div>,
}));

vi.mock("../InputErrors", () => ({ InputErrors: () => null }));
vi.mock("@/utils/src/helpers", () => ({ formatTestId: (...parts) => parts.join("_") }));

const scrollToBottom = () => {
    const viewport = screen.getByTestId("select-viewport");
    Object.defineProperty(viewport, "scrollTop", { value: 100, configurable: true });
    Object.defineProperty(viewport, "scrollHeight", { value: 120, configurable: true });
    Object.defineProperty(viewport, "clientHeight", { value: 20, configurable: true });
    fireEvent.scroll(viewport);
};

const userScrollToBottom = () => {
    fireEvent.wheel(screen.getByTestId("select-viewport"));
    scrollToBottom();
};

describe("Select opt-in search and infinite scroll", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        setValueMock.mockReset();
        fieldState.value = "";
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("does not render search input without onSearchChange", () => {
        render(<Select name="flujo_id" options={[{ value: "1", label: "A" }]} />);

        expect(screen.queryByPlaceholderText("Buscar...")).toBeNull();
    });

    it("debounces onSearchChange", () => {
        const onSearchChange = vi.fn();
        render(<Select name="flujo_id" options={[{ value: "1", label: "A" }]} onSearchChange={onSearchChange} />);

        fireEvent.change(screen.getByPlaceholderText("Buscar..."), { target: { value: "nor" } });
        expect(onSearchChange).not.toHaveBeenCalled();

        act(() => {
            vi.advanceTimersByTime(300);
        });

        expect(onSearchChange).toHaveBeenCalledWith("nor");
    });

    it("does not emit onSearchChange on mount", () => {
        const onSearchChange = vi.fn();
        render(<Select name="flujo_id" options={[{ value: "1", label: "A" }]} onSearchChange={onSearchChange} />);

        act(() => {
            vi.advanceTimersByTime(400);
        });

        expect(onSearchChange).not.toHaveBeenCalled();
    });

    it("does not re-emit an unchanged term when onSearchChange identity changes", () => {
        const firstOnSearchChange = vi.fn();
        const { rerender } = render(
            <Select name="flujo_id" options={[{ value: "1", label: "A" }]} onSearchChange={firstOnSearchChange} />,
        );

        const secondOnSearchChange = vi.fn();
        rerender(
            <Select name="flujo_id" options={[{ value: "1", label: "A" }]} onSearchChange={secondOnSearchChange} />,
        );

        act(() => {
            vi.advanceTimersByTime(400);
        });

        expect(firstOnSearchChange).not.toHaveBeenCalled();
        expect(secondOnSearchChange).not.toHaveBeenCalled();
    });

    it("stops propagation on search input key/mouse events so Radix does not steal focus", () => {
        render(<Select name="flujo_id" options={[{ value: "1", label: "A" }]} onSearchChange={vi.fn()} />);

        const input = screen.getByPlaceholderText("Buscar...");
        const keyDownEvent = new KeyboardEvent("keydown", { key: "a", bubbles: true, cancelable: true });
        const keyDownStopSpy = vi.spyOn(keyDownEvent, "stopPropagation");
        fireEvent(input, keyDownEvent);
        expect(keyDownStopSpy).toHaveBeenCalled();

        const mouseDownEvent = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
        const mouseDownStopSpy = vi.spyOn(mouseDownEvent, "stopPropagation");
        fireEvent(input, mouseDownEvent);
        expect(mouseDownStopSpy).toHaveBeenCalled();
    });

    it("does not call fetchNextPage on programmatic scroll without a user gesture", () => {
        const fetchNextPage = vi.fn();
        render(
            <Select name="flujo_id" options={[{ value: "1", label: "A" }]} fetchNextPage={fetchNextPage} hasNextPage />,
        );

        scrollToBottom();

        expect(fetchNextPage).not.toHaveBeenCalled();
    });

    it("calls fetchNextPage on scroll after a user gesture when hasNextPage", () => {
        const fetchNextPage = vi.fn();
        render(
            <Select name="flujo_id" options={[{ value: "1", label: "A" }]} fetchNextPage={fetchNextPage} hasNextPage />,
        );

        userScrollToBottom();

        expect(fetchNextPage).toHaveBeenCalledTimes(1);
    });

    it("loads the next page on wheel-down when already pinned at the bottom", () => {
        const fetchNextPage = vi.fn();
        render(
            <Select name="flujo_id" options={[{ value: "1", label: "A" }]} fetchNextPage={fetchNextPage} hasNextPage />,
        );

        const viewport = screen.getByTestId("select-viewport");
        Object.defineProperty(viewport, "scrollTop", { value: 100, configurable: true });
        Object.defineProperty(viewport, "scrollHeight", { value: 120, configurable: true });
        Object.defineProperty(viewport, "clientHeight", { value: 20, configurable: true });
        fireEvent.wheel(viewport, { deltaY: 40 });

        expect(fetchNextPage).toHaveBeenCalledTimes(1);
    });

    it("does not load the next page on wheel-up when already at the bottom", () => {
        const fetchNextPage = vi.fn();
        render(
            <Select name="flujo_id" options={[{ value: "1", label: "A" }]} fetchNextPage={fetchNextPage} hasNextPage />,
        );

        const viewport = screen.getByTestId("select-viewport");
        Object.defineProperty(viewport, "scrollTop", { value: 100, configurable: true });
        Object.defineProperty(viewport, "scrollHeight", { value: 120, configurable: true });
        Object.defineProperty(viewport, "clientHeight", { value: 20, configurable: true });
        fireEvent.wheel(viewport, { deltaY: -40 });

        expect(fetchNextPage).not.toHaveBeenCalled();
    });

    it("requires a new user gesture and taller content before fetching another page", () => {
        const fetchNextPage = vi.fn();
        render(
            <Select name="flujo_id" options={[{ value: "1", label: "A" }]} fetchNextPage={fetchNextPage} hasNextPage />,
        );

        userScrollToBottom();
        scrollToBottom();

        expect(fetchNextPage).toHaveBeenCalledTimes(1);

        const viewport = screen.getByTestId("select-viewport");
        Object.defineProperty(viewport, "scrollTop", { value: 180, configurable: true });
        Object.defineProperty(viewport, "scrollHeight", { value: 200, configurable: true });
        Object.defineProperty(viewport, "clientHeight", { value: 20, configurable: true });
        fireEvent.wheel(viewport);
        fireEvent.scroll(viewport);

        expect(fetchNextPage).toHaveBeenCalledTimes(2);
    });

    it("resets the scroll gate when the select reopens", () => {
        const fetchNextPage = vi.fn();
        render(
            <Select name="flujo_id" options={[{ value: "1", label: "A" }]} fetchNextPage={fetchNextPage} hasNextPage />,
        );

        fireEvent.wheel(screen.getByTestId("select-viewport"));
        fireEvent.click(screen.getByTestId("close-select"));
        fireEvent.click(screen.getByTestId("open-select"));
        scrollToBottom();

        expect(fetchNextPage).not.toHaveBeenCalled();
    });

    it("does not call fetchNextPage when hasNextPage is false", () => {
        const fetchNextPage = vi.fn();
        render(<Select name="flujo_id" options={[{ value: "1", label: "A" }]} fetchNextPage={fetchNextPage} />);

        userScrollToBottom();

        expect(fetchNextPage).not.toHaveBeenCalled();
    });

    it("does not call fetchNextPage while the next page is loading", () => {
        const fetchNextPage = vi.fn();
        render(
            <Select
                name="flujo_id"
                options={[{ value: "1", label: "A" }]}
                fetchNextPage={fetchNextPage}
                hasNextPage
                isFetchingNextPage
            />,
        );

        userScrollToBottom();

        expect(fetchNextPage).not.toHaveBeenCalled();
    });

    it("keeps the gate armed when a bottom gesture happens while fetching", () => {
        const fetchNextPage = vi.fn();
        const { rerender } = render(
            <Select
                name="flujo_id"
                options={[{ value: "1", label: "A" }]}
                fetchNextPage={fetchNextPage}
                hasNextPage
                isFetchingNextPage
            />,
        );

        userScrollToBottom();
        expect(fetchNextPage).not.toHaveBeenCalled();

        rerender(
            <Select
                name="flujo_id"
                options={[{ value: "1", label: "A" }]}
                fetchNextPage={fetchNextPage}
                hasNextPage
                isFetchingNextPage={false}
            />,
        );
        scrollToBottom();

        expect(fetchNextPage).toHaveBeenCalledTimes(1);
    });

    it("calls fetchNextPage after ArrowDown arms the gate and the viewport reaches the bottom", () => {
        const fetchNextPage = vi.fn();
        render(
            <Select name="flujo_id" options={[{ value: "1", label: "A" }]} fetchNextPage={fetchNextPage} hasNextPage />,
        );

        fireEvent.keyDown(screen.getByTestId("select-content"), { key: "ArrowDown" });
        scrollToBottom();

        expect(fetchNextPage).toHaveBeenCalledTimes(1);
    });

    it("calls fetchNextPage after pointer interaction on the scroll-down control", () => {
        const fetchNextPage = vi.fn();
        render(
            <Select name="flujo_id" options={[{ value: "1", label: "A" }]} fetchNextPage={fetchNextPage} hasNextPage />,
        );

        fireEvent.pointerDown(screen.getByTestId("select-scroll-down"));
        scrollToBottom();

        expect(fetchNextPage).toHaveBeenCalledTimes(1);
    });

    it("clears the search input when the select closes", () => {
        render(<Select name="flujo_id" options={[{ value: "1", label: "A" }]} onSearchChange={vi.fn()} />);

        const input = screen.getByPlaceholderText("Buscar...");
        fireEvent.change(input, { target: { value: "nor" } });
        expect(input.value).toBe("nor");

        fireEvent.click(screen.getByTestId("close-select"));

        expect(screen.getByPlaceholderText("Buscar...").value).toBe("");
    });

    it("does not call fetchNextPage when the scroll handler is absent", () => {
        const fetchNextPage = vi.fn();
        render(<Select name="flujo_id" options={[{ value: "1", label: "A" }]} />);

        scrollToBottom();

        expect(fetchNextPage).not.toHaveBeenCalled();
    });

    it("keeps the search input outside the scrollable viewport so it stays visible", () => {
        render(
            <Select
                name="flujo_id"
                options={[
                    { value: "1", label: "A" },
                    { value: "2", label: "B" },
                ]}
                onSearchChange={vi.fn()}
            />,
        );

        const header = screen.getByTestId("select-content-header");
        const viewport = screen.getByTestId("select-viewport");
        const input = screen.getByTestId("select-search-input");

        expect(header).toContainElement(input);
        expect(viewport).not.toContainElement(input);
        expect(viewport).toHaveTextContent("A");
    });

    it("disables the select until the first query finishes when disableUntilReady", () => {
        const { rerender } = render(
            <Select name="flujo_id" options={[]} onSearchChange={vi.fn()} isLoading disableUntilReady />,
        );

        expect(screen.getByTestId("radix-select")).toHaveAttribute("data-disabled", "true");
        expect(screen.getByTestId("open-select")).toBeDisabled();
        expect(screen.getByText("Cargando...")).toBeInTheDocument();

        rerender(
            <Select
                name="flujo_id"
                options={[{ value: "1", label: "Alpha" }]}
                onSearchChange={vi.fn()}
                isLoading={false}
                disableUntilReady
            />,
        );

        expect(screen.getByTestId("radix-select")).toHaveAttribute("data-disabled", "false");
        expect(screen.getByTestId("open-select")).not.toBeDisabled();
        expect(screen.getByTestId("select-search-input")).not.toBeDisabled();
    });

    it("does not disable plain selects while loading", () => {
        render(<Select name="flujo_id" options={[]} isLoading />);

        expect(screen.getByTestId("radix-select")).toHaveAttribute("data-disabled", "false");
        expect(screen.getByTestId("open-select")).not.toBeDisabled();
        expect(screen.queryByText("Cargando...")).not.toBeInTheDocument();
    });

    it("keeps the select enabled during later loading after the first query", () => {
        const { rerender } = render(
            <Select
                name="flujo_id"
                options={[{ value: "1", label: "Alpha" }]}
                onSearchChange={vi.fn()}
                isLoading={false}
                disableUntilReady
            />,
        );

        expect(screen.getByTestId("radix-select")).toHaveAttribute("data-disabled", "false");

        rerender(
            <Select
                name="flujo_id"
                options={[{ value: "1", label: "Alpha" }]}
                onSearchChange={vi.fn()}
                isLoading
                disableUntilReady
            />,
        );

        expect(screen.getByTestId("radix-select")).toHaveAttribute("data-disabled", "false");
        expect(screen.getByTestId("select-search-input")).not.toBeDisabled();
    });

    it("shows a clear button that resets the selected value", () => {
        fieldState.value = "1";
        const handle = vi.fn();
        const onSearchChange = vi.fn();

        render(
            <Select
                name="flujo_id"
                options={[{ value: "1", label: "Alpha" }]}
                onSearchChange={onSearchChange}
                isLoading={false}
                clearable
                handle={handle}
            />,
        );

        fireEvent.click(screen.getByTestId("btn_select_clear_flujo_id"));

        expect(setValueMock).toHaveBeenCalledWith("");
        expect(handle).toHaveBeenCalledWith("");
        expect(onSearchChange).toHaveBeenCalledWith("");
    });

    it("keeps focus on the search input after options update from a search", () => {
        const { rerender } = render(
            <Select
                name="flujo_id"
                options={[{ value: "1", label: "Alpha" }]}
                onSearchChange={vi.fn()}
                isLoading={false}
            />,
        );

        fireEvent.click(screen.getByTestId("open-select"));
        const input = screen.getByTestId("select-search-input");
        input.focus();
        expect(document.activeElement).toBe(input);

        fireEvent.change(input, { target: { value: "be" } });
        act(() => {
            vi.advanceTimersByTime(300);
        });

        const distractor = document.createElement("button");
        document.body.appendChild(distractor);
        distractor.focus();
        expect(document.activeElement).toBe(distractor);

        rerender(
            <Select
                name="flujo_id"
                options={[{ value: "2", label: "Beta" }]}
                onSearchChange={vi.fn()}
                isLoading={false}
            />,
        );

        act(() => {
            vi.advanceTimersByTime(0);
        });

        expect(document.activeElement).toBe(screen.getByTestId("select-search-input"));
        distractor.remove();
    });
});
