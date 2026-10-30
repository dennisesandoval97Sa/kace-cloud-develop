import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, useMemo } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useClassificationTemplateSelect } from "./useClassificationTemplateSelect";

const searchMock = vi.fn();
const fetchingState = { current: false };
const fetchAllMatchingTemplatesMock = vi.fn();
const toastError = vi.fn();

vi.mock("@/hooks/useGenericSearchQuery", () => ({
    default: ({ filter, pagination, enabled }) => {
        const result = useMemo(() => {
            if (!enabled) return undefined;
            return searchMock(filter, pagination, enabled);
        }, [enabled, filter, pagination]);
        return {
            data: result,
            isFetching: fetchingState.current,
            isLoading: false,
            refetch: vi.fn(),
        };
    },
}));

vi.mock("../helpers/fetchAllMatchingTemplates", async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        fetchAllMatchingTemplates: (...args) => fetchAllMatchingTemplatesMock(...args),
    };
});

vi.mock("@kace/utils", async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, TEMPLATES_SERVICE: "/templates" };
});

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

vi.mock("sonner", () => ({
    toast: {
        error: (...args) => toastError(...args),
    },
}));

const wrapper = ({ children }) =>
    createElement(
        QueryClientProvider,
        { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
        children,
    );

const openPopover = (result) => {
    act(() => {
        result.current.onOpenChange(true);
    });
};

describe("useClassificationTemplateSelect", () => {
    beforeEach(() => {
        fetchingState.current = false;
        searchMock.mockReset();
        fetchAllMatchingTemplatesMock.mockReset();
        toastError.mockReset();
        searchMock.mockImplementation((filter, pagination) => {
            const offset = pagination?.offset ?? 0;
            if (offset === 0) {
                return {
                    rows: [
                        { id: "t1", descripcion: "Alpha" },
                        { id: "t2", descripcion: "Beta" },
                    ],
                    total: 3,
                };
            }
            return {
                rows: [{ id: "t3", descripcion: "Gamma" }],
                total: 3,
            };
        });
    });

    it("exposes hideSearchButton true and followInput false for ui-shared MultiSelect", () => {
        const { result } = renderHook(() => useClassificationTemplateSelect({ pageSize: 2 }), { wrapper });
        expect(result.current.hideSearchButton).toBe(true);
        expect(result.current.followInput).toBe(false);
    });

    it("loads first page mapped to id/label/value and reports hasMore after opening", async () => {
        const { result } = renderHook(() => useClassificationTemplateSelect({ pageSize: 2 }), { wrapper });
        openPopover(result);

        await waitFor(() => {
            expect(result.current.data.map((row) => row.id)).toEqual(["t1", "t2"]);
        });
        expect(result.current.data[0]).toEqual({ id: "t1", label: "Alpha", value: "Alpha" });
        expect(result.current.hasMore).toBe(true);
    });

    it("accumulates next page without duplicates when setPage increases", async () => {
        const { result } = renderHook(() => useClassificationTemplateSelect({ pageSize: 2 }), { wrapper });
        openPopover(result);

        await waitFor(() => expect(result.current.data).toHaveLength(2));

        act(() => {
            result.current.setPage(2);
        });

        await waitFor(() => {
            expect(result.current.data.map((row) => row.id)).toEqual(["t1", "t2", "t3"]);
        });
        expect(result.current.hasMore).toBe(false);
    });

    it("merges API search hits by id when filter is set", async () => {
        searchMock.mockImplementation((filter) => {
            const hasSearch = filter?.some((entry) => entry.field === "descripcion");
            if (hasSearch) {
                return {
                    rows: [
                        { id: "t9", descripcion: "Remote Match" },
                        { id: "t1", descripcion: "Alpha" },
                    ],
                    total: 2,
                };
            }
            return {
                rows: [
                    { id: "t1", descripcion: "Alpha" },
                    { id: "t2", descripcion: "Beta" },
                ],
                total: 2,
            };
        });

        const { result } = renderHook(() => useClassificationTemplateSelect({ pageSize: 2 }), { wrapper });
        openPopover(result);
        await waitFor(() => expect(result.current.data).toHaveLength(2));

        act(() => {
            result.current.setSearchQuery({ input: "match", filter: "match" });
        });

        await waitFor(() => {
            const ids = result.current.data.map((row) => row.id);
            expect(ids).toContain("t9");
            expect(ids).toContain("t1");
            expect(new Set(ids).size).toBe(ids.length);
        });
    });

    it("clears remote search and returns to browse when filter is emptied", async () => {
        const { result } = renderHook(() => useClassificationTemplateSelect({ pageSize: 2 }), { wrapper });
        openPopover(result);
        await waitFor(() => expect(result.current.data).toHaveLength(2));

        act(() => {
            result.current.setSearchQuery({ input: "x", filter: "x" });
        });
        act(() => {
            result.current.setSearchQuery({ input: "", filter: "" });
        });

        await waitFor(() => {
            expect(result.current.data.map((row) => row.id)).toEqual(["t1", "t2"]);
        });
    });

    it("owns the popover open state and resets pagination and accumulated pages on close", async () => {
        const { result } = renderHook(() => useClassificationTemplateSelect({ pageSize: 2 }), { wrapper });

        await waitFor(() => expect(result.current.open).toBe(false));
        openPopover(result);
        expect(result.current.open).toBe(true);

        await waitFor(() => expect(result.current.data).toHaveLength(2));

        act(() => {
            result.current.setPage(2);
        });
        await waitFor(() => expect(result.current.data).toHaveLength(3));

        act(() => {
            result.current.onOpenChange(false);
        });

        expect(result.current.open).toBe(false);
        openPopover(result);
        await waitFor(() => {
            expect(result.current.data.map((row) => row.id)).toEqual(["t1", "t2"]);
        });
    });

    it("clears an active search filter when the popover closes", async () => {
        const { result } = renderHook(() => useClassificationTemplateSelect({ pageSize: 2 }), { wrapper });
        openPopover(result);
        await waitFor(() => expect(result.current.data).toHaveLength(2));

        act(() => {
            result.current.setSearchQuery({ input: "match", filter: "match" });
        });
        await waitFor(() => expect(result.current.searchQuery.filter).toBe("match"));

        act(() => {
            result.current.onOpenChange(false);
        });

        await waitFor(() => expect(result.current.searchQuery.filter).toBe(""));
    });

    it("does not report isLoading for a fetch once data is already present locally", async () => {
        fetchingState.current = true;
        const { result, rerender } = renderHook(() => useClassificationTemplateSelect({ pageSize: 2 }), { wrapper });

        openPopover(result);
        expect(result.current.isLoading).toBe(true);

        fetchingState.current = false;
        rerender();
        await waitFor(() => expect(result.current.data).toHaveLength(2));

        fetchingState.current = true;
        act(() => {
            result.current.setSearchQuery({ input: "match", filter: "match" });
        });

        expect(result.current.isLoading).toBe(false);
    });

    it("clamps a stale MultiSelect page jump to the next page after search resets to page 1", async () => {
        searchMock.mockImplementation((filter, pagination) => {
            const offset = pagination?.offset ?? 0;
            const hasSearch = filter?.some((entry) => entry.field === "descripcion");
            if (hasSearch) {
                if (offset === 0) {
                    return {
                        rows: [
                            { id: "s1", descripcion: "Match One" },
                            { id: "s2", descripcion: "Match Two" },
                        ],
                        total: 4,
                    };
                }
                if (offset === 2) {
                    return {
                        rows: [
                            { id: "s3", descripcion: "Match Three" },
                            { id: "s4", descripcion: "Match Four" },
                        ],
                        total: 4,
                    };
                }
                return { rows: [{ id: "s-skip", descripcion: "Skipped" }], total: 4 };
            }
            if (offset === 0) {
                return {
                    rows: [
                        { id: "t1", descripcion: "Alpha" },
                        { id: "t2", descripcion: "Beta" },
                    ],
                    total: 3,
                };
            }
            return {
                rows: [{ id: "t3", descripcion: "Gamma" }],
                total: 3,
            };
        });

        const { result } = renderHook(() => useClassificationTemplateSelect({ pageSize: 2 }), { wrapper });
        openPopover(result);
        await waitFor(() => expect(result.current.data).toHaveLength(2));

        act(() => {
            result.current.setPage(2);
        });
        await waitFor(() => expect(result.current.data).toHaveLength(3));

        act(() => {
            result.current.setSearchQuery({ input: "match", filter: "match" });
        });
        await waitFor(() => {
            expect(result.current.data.map((row) => row.id)).toEqual(["t1", "t2", "t3", "s1", "s2"]);
        });

        searchMock.mockClear();
        act(() => {
            result.current.setPage(3);
        });

        await waitFor(() => {
            expect(result.current.data.map((row) => row.id)).toContain("s3");
        });
        expect(result.current.data.map((row) => row.id)).not.toContain("s-skip");
        expect(searchMock).toHaveBeenCalledWith(
            expect.arrayContaining([expect.objectContaining({ field: "descripcion" })]),
            expect.objectContaining({ limit: 2, offset: 2 }),
            true,
        );
    });

    it("select-all without filter replaces empty selection with all matches", async () => {
        const matching = [
            { id: "t1", label: "Alpha", value: "Alpha" },
            { id: "t2", label: "Beta", value: "Beta" },
        ];
        fetchAllMatchingTemplatesMock.mockResolvedValue(matching);
        const setListValues = vi.fn((updater) => {
            const next = typeof updater === "function" ? updater([]) : updater;
            setListValues.last = next;
        });

        const { result } = renderHook(() => useClassificationTemplateSelect({ pageSize: 2 }), { wrapper });
        openPopover(result);

        await act(async () => {
            await result.current.selectAllMatchingOrClear([], setListValues);
        });

        expect(fetchAllMatchingTemplatesMock).toHaveBeenCalledWith({ searchFilter: "" });
        expect(setListValues.last).toEqual(matching);
    });

    it("select-all with active filter preserves templates selected outside the filter", async () => {
        const matching = [{ id: "m1", label: "Match", value: "Match" }];
        fetchAllMatchingTemplatesMock.mockResolvedValue(matching);
        const previous = [{ id: "seed", label: "Seed", value: "Seed" }];
        const setListValues = vi.fn((updater) => {
            setListValues.last = typeof updater === "function" ? updater(previous) : updater;
        });

        const { result } = renderHook(() => useClassificationTemplateSelect({ pageSize: 2 }), { wrapper });
        openPopover(result);
        act(() => {
            result.current.setSearchQuery({ input: "match", filter: "match" });
        });

        await act(async () => {
            await result.current.selectAllMatchingOrClear(previous, setListValues);
        });

        expect(fetchAllMatchingTemplatesMock).toHaveBeenCalledWith({ searchFilter: "match" });
        expect(setListValues.last).toEqual([
            { id: "m1", label: "Match", value: "Match" },
            { id: "seed", label: "Seed", value: "Seed" },
        ]);
    });

    it("toggles clear only for matching templates when all matches are already selected", async () => {
        const matching = [{ id: "m1", label: "Match", value: "Match" }];
        fetchAllMatchingTemplatesMock.mockResolvedValue(matching);
        const previous = [
            { id: "seed", label: "Seed", value: "Seed" },
            { id: "m1", label: "Match", value: "Match" },
        ];
        const setListValues = vi.fn((updater) => {
            setListValues.last = typeof updater === "function" ? updater(previous) : updater;
        });

        const { result } = renderHook(() => useClassificationTemplateSelect({ pageSize: 2 }), { wrapper });
        openPopover(result);
        act(() => {
            result.current.setSearchQuery({ input: "match", filter: "match" });
        });

        await act(async () => {
            await result.current.selectAllMatchingOrClear(previous, setListValues);
        });

        expect(setListValues.last).toEqual([{ id: "seed", label: "Seed", value: "Seed" }]);
    });

    it("shows a toast and releases isSelectingAll when fetchAllMatchingTemplates rejects", async () => {
        fetchAllMatchingTemplatesMock.mockRejectedValue(new Error("network"));
        const setListValues = vi.fn();
        const { result } = renderHook(() => useClassificationTemplateSelect({ pageSize: 2 }), { wrapper });
        openPopover(result);

        await act(async () => {
            await result.current.selectAllMatchingOrClear([], setListValues);
        });

        expect(toastError).toHaveBeenCalledWith("app.alerts.error");
        expect(setListValues).not.toHaveBeenCalled();
        expect(result.current.isLoading).toBe(false);
    });
});
