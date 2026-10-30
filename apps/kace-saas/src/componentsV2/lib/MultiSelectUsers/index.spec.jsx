/* eslint-disable react/prop-types, react/display-name -- Los mocks son componentes desechables del test. */
import { forwardRef } from "react";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MultiSelectUsers from "./index";

const fetchNextPage = vi.fn();
let usersQueryState;

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key) => key }) }));
vi.mock("react-intersection-observer", () => ({ useInView: () => ({ ref: vi.fn(), inView: true }) }));
vi.mock("@/components/ui-shared", () => ({
    Button: ({ children, ...props }) => <button {...props}>{children}</button>,
    Command: ({ children }) => <div>{children}</div>,
    CommandEmpty: ({ children }) => <div>{children}</div>,
    CommandGroup: ({ children }) => <div>{children}</div>,
    CommandInput: () => <input />,
    CommandItem: forwardRef(({ children }, ref) => <div ref={ref}>{children}</div>),
    CommandList: ({ children }) => <div>{children}</div>,
    GeneralLoader: () => null,
    LoaderThreeDots: () => null,
    Popover: ({ children }) => <div>{children}</div>,
    PopoverContent: ({ children }) => <div>{children}</div>,
    PopoverTrigger: ({ children }) => <div>{children}</div>,
}));
vi.mock("@/components/ui-shared/src/components/multiSelect/ListPopover", () => ({ ListPopover: () => null }));
vi.mock("@/hooks/useGenericSearchInfiniteQuery", () => ({ default: () => usersQueryState }));
vi.mock("@/hooks/useGenericSearchQuery", () => ({ default: () => ({ data: undefined, isLoading: false }) }));

const DEBOUNCE_MS = 600;

describe("MultiSelectUsers - scroll infinito", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        fetchNextPage.mockClear();
        usersQueryState = {
            data: [],
            isLoading: false,
            isFetchingNextPage: false,
            hasNextPage: true,
            fetchNextPage,
        };
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("pide la siguiente página otra vez cuando termina de cargar y el final sigue visible", () => {
        const { rerender } = render(<MultiSelectUsers />);
        act(() => vi.advanceTimersByTime(DEBOUNCE_MS));
        expect(fetchNextPage).toHaveBeenCalledTimes(1);

        usersQueryState = { ...usersQueryState, isFetchingNextPage: true };
        rerender(<MultiSelectUsers />);
        act(() => vi.advanceTimersByTime(DEBOUNCE_MS));
        expect(fetchNextPage).toHaveBeenCalledTimes(1);

        usersQueryState = { ...usersQueryState, isFetchingNextPage: false };
        rerender(<MultiSelectUsers />);
        act(() => vi.advanceTimersByTime(DEBOUNCE_MS));
        expect(fetchNextPage).toHaveBeenCalledTimes(2);
    });

    it("deja de pedir páginas cuando ya no quedan", () => {
        const { rerender } = render(<MultiSelectUsers />);
        act(() => vi.advanceTimersByTime(DEBOUNCE_MS));

        usersQueryState = { ...usersQueryState, isFetchingNextPage: true };
        rerender(<MultiSelectUsers />);
        usersQueryState = { ...usersQueryState, isFetchingNextPage: false, hasNextPage: false };
        rerender(<MultiSelectUsers />);
        act(() => vi.advanceTimersByTime(DEBOUNCE_MS * 3));

        expect(fetchNextPage).toHaveBeenCalledTimes(1);
    });
});
