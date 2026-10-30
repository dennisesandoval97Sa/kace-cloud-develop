/* eslint-disable react/prop-types */
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
    CommandList: ({ children, onScroll, onWheel, onTouchStart, onPointerDown, ...props }) => (
        <div
            data-testid="multiselect-list"
            onScroll={onScroll}
            onWheel={onWheel}
            onTouchStart={onTouchStart}
            onPointerDown={onPointerDown}
            {...props}
        >
            {children}
        </div>
    ),
}));

vi.mock("../ui/popover", () => ({
    Popover: ({ children, open, onOpenChange }) => (
        <div data-testid="popover" data-open={String(open)}>
            <button type="button" data-testid="open-popover" onClick={() => onOpenChange?.(true)} />
            <button type="button" data-testid="close-popover" onClick={() => onOpenChange?.(false)} />
            {open ? children : null}
        </div>
    ),
    PopoverTrigger: ({ children }) => <div>{children}</div>,
    PopoverContent: ({ children }) => <div>{children}</div>,
}));

vi.mock("./ButtonsAction", () => ({
    ButtonsAction: () => <div data-testid="buttons-action" />,
}));

vi.mock("./ListPopover", () => ({
    ListPopover: () => null,
}));

vi.mock("../../icons", () => ({
    CheckIcon: () => <span>check</span>,
}));

const scrollToBottom = () => {
    const list = screen.getByTestId("multiselect-list");
    Object.defineProperty(list, "scrollTop", { value: 100, configurable: true });
    Object.defineProperty(list, "scrollHeight", { value: 120, configurable: true });
    Object.defineProperty(list, "clientHeight", { value: 20, configurable: true });
    fireEvent.scroll(list);
};

const userScrollToBottom = () => {
    fireEvent.wheel(screen.getByTestId("multiselect-list"));
    scrollToBottom();
};

describe("MultiSelect infinite scroll gate", () => {
    const setPage = vi.fn();

    beforeEach(() => {
        setPage.mockReset();
    });

    it("does not page on programmatic scroll without a user gesture", () => {
        render(
            <MultiSelect
                data={[{ id: "1", label: "A", value: "A" }]}
                listValues={[]}
                setListValues={vi.fn()}
                open
                onOpenChange={vi.fn()}
                hasMore
                setPage={setPage}
            />,
        );

        scrollToBottom();

        expect(setPage).not.toHaveBeenCalled();
    });

    it("pages after a user gesture when hasMore", () => {
        render(
            <MultiSelect
                data={[{ id: "1", label: "A", value: "A" }]}
                listValues={[]}
                setListValues={vi.fn()}
                open
                onOpenChange={vi.fn()}
                hasMore
                setPage={setPage}
            />,
        );

        userScrollToBottom();

        expect(setPage).toHaveBeenCalledTimes(1);
    });

    it("pages on wheel-down when already pinned at the bottom", () => {
        render(
            <MultiSelect
                data={[{ id: "1", label: "A", value: "A" }]}
                listValues={[]}
                setListValues={vi.fn()}
                open
                onOpenChange={vi.fn()}
                hasMore
                setPage={setPage}
            />,
        );

        const list = screen.getByTestId("multiselect-list");
        Object.defineProperty(list, "scrollTop", { value: 100, configurable: true });
        Object.defineProperty(list, "scrollHeight", { value: 120, configurable: true });
        Object.defineProperty(list, "clientHeight", { value: 20, configurable: true });
        fireEvent.wheel(list, { deltaY: 40 });

        expect(setPage).toHaveBeenCalledTimes(1);
    });

    it("requires a new user gesture and taller content before paging again", () => {
        render(
            <MultiSelect
                data={[{ id: "1", label: "A", value: "A" }]}
                listValues={[]}
                setListValues={vi.fn()}
                open
                onOpenChange={vi.fn()}
                hasMore
                setPage={setPage}
            />,
        );

        userScrollToBottom();
        scrollToBottom();

        expect(setPage).toHaveBeenCalledTimes(1);

        const list = screen.getByTestId("multiselect-list");
        Object.defineProperty(list, "scrollTop", { value: 180, configurable: true });
        Object.defineProperty(list, "scrollHeight", { value: 200, configurable: true });
        Object.defineProperty(list, "clientHeight", { value: 20, configurable: true });
        fireEvent.wheel(list);
        fireEvent.scroll(list);

        expect(setPage).toHaveBeenCalledTimes(2);
    });

    it("resets the scroll gate when the popover reopens", () => {
        const onOpenChange = vi.fn();
        const { rerender } = render(
            <MultiSelect
                data={[{ id: "1", label: "A", value: "A" }]}
                listValues={[]}
                setListValues={vi.fn()}
                open
                onOpenChange={onOpenChange}
                hasMore
                setPage={setPage}
            />,
        );

        fireEvent.wheel(screen.getByTestId("multiselect-list"));
        rerender(
            <MultiSelect
                data={[{ id: "1", label: "A", value: "A" }]}
                listValues={[]}
                setListValues={vi.fn()}
                open={false}
                onOpenChange={onOpenChange}
                hasMore
                setPage={setPage}
            />,
        );
        rerender(
            <MultiSelect
                data={[{ id: "1", label: "A", value: "A" }]}
                listValues={[]}
                setListValues={vi.fn()}
                open
                onOpenChange={onOpenChange}
                hasMore
                setPage={setPage}
            />,
        );

        scrollToBottom();

        expect(setPage).not.toHaveBeenCalled();
    });
});
