import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useSelectByProviderQuery from "./useSelectByProviderQuery";

const useGenericSearchQueryMock = vi.fn();

vi.mock("./useGenericSearchQuery", () => ({
    default: (args) => useGenericSearchQueryMock(args),
}));

const listKey = "select-by-provider:flujo_id:/flows:nombre:asc";
const listKeyNoOrder = "select-by-provider:flujo_id:/flows::";

const pageOne = {
    data: [
        { id: "2", nombre: "Beta" },
        { id: "3", nombre: "Gamma" },
    ],
    total: 4,
    count: 2,
};

describe("useSelectByProviderQuery", () => {
    beforeEach(() => {
        useGenericSearchQueryMock.mockReset();
        useGenericSearchQueryMock.mockImplementation(({ keyQuery, enabled }) => {
            if (enabled === false) {
                return { data: undefined, isLoading: false, isFetching: false, isError: false };
            }
            if (String(keyQuery).includes("seed")) {
                return {
                    data: { data: [{ id: "99", nombre: "Seeded Flow" }], total: 1, count: 1 },
                    isLoading: false,
                    isFetching: false,
                    isError: false,
                };
            }
            return { data: pageOne, isLoading: false, isFetching: false, isError: false };
        });
    });

    it("maps remote page to options and requests alphabetical order when enabled", () => {
        const { result } = renderHook(() =>
            useSelectByProviderQuery({
                name: "flujo_id",
                url: "/flows",
                enableAlphabeticalOrder: true,
                enableInfiniteScroll: true,
                labelFrom: "nombre",
                queryLimit: 2,
            }),
        );

        const listCall = useGenericSearchQueryMock.mock.calls
            .map(([args]) => args)
            .find((args) => args.keyQuery === listKey);

        expect(listCall.order).toEqual({ field: "nombre", direction: "asc" });
        expect(listCall.pagination).toEqual({ limit: 2, offset: 0 });
        expect(result.current.options.map((o) => o.value)).toEqual(["2", "3"]);
    });

    it("appends next page on fetchNextPage when infinite scroll enabled", async () => {
        let page = 0;
        useGenericSearchQueryMock.mockImplementation(({ keyQuery, pagination }) => {
            if (String(keyQuery).includes("seed")) {
                return { data: undefined, isLoading: false, isFetching: false, isError: false };
            }
            page = pagination?.offset === 0 ? 0 : 1;
            const data = page === 0 ? pageOne : { data: [{ id: "4", nombre: "Delta" }], total: 4, count: 1 };
            return { data, isLoading: false, isFetching: false, isError: false };
        });

        const { result, rerender } = renderHook(() =>
            useSelectByProviderQuery({
                name: "flujo_id",
                url: "/flows",
                enableInfiniteScroll: true,
                queryLimit: 2,
            }),
        );

        expect(result.current.hasNextPage).toBe(true);

        act(() => {
            result.current.fetchNextPage();
        });
        rerender();

        await waitFor(() => {
            expect(result.current.options.map((o) => o.value)).toEqual(["2", "3", "4"]);
        });
    });

    it("adds ilike filter and resets accumulation when search term changes", () => {
        const { result, rerender } = renderHook(
            ({ term }) => {
                const api = useSelectByProviderQuery({
                    name: "flujo_id",
                    url: "/flows",
                    enableSearch: true,
                    enableInfiniteScroll: true,
                    searchField: "nombre",
                });
                // expose setter then apply term via effect-like act in test
                return api;
            },
            { initialProps: { term: "" } },
        );

        act(() => {
            result.current.setSearchTerm("nor");
        });
        rerender({ term: "nor" });

        const listCall = useGenericSearchQueryMock.mock.calls
            .map(([args]) => args)
            .filter((args) => args.keyQuery === listKeyNoOrder)
            .at(-1);

        expect(listCall.filter).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ field: "nombre", operator: "ilike", value: "nor", type: "AND" }),
            ]),
        );
        expect(listCall.pagination.offset).toBe(0);
    });

    it("keeps accumulated options when setSearchTerm is called with the unchanged term", () => {
        const { result, rerender } = renderHook(() =>
            useSelectByProviderQuery({
                name: "flujo_id",
                url: "/flows",
                enableSearch: true,
                enableInfiniteScroll: true,
                searchField: "nombre",
            }),
        );

        expect(result.current.options.map((o) => o.value)).toEqual(["2", "3"]);

        act(() => {
            result.current.setSearchTerm("");
        });
        rerender();

        expect(result.current.options.map((o) => o.value)).toEqual(["2", "3"]);
    });

    it("keeps setSearchTerm and fetchNextPage referentially stable across renders", () => {
        const { result, rerender } = renderHook(() =>
            useSelectByProviderQuery({
                name: "flujo_id",
                url: "/flows",
                enableSearch: true,
                enableInfiniteScroll: true,
                searchField: "nombre",
            }),
        );

        const firstSetSearchTerm = result.current.setSearchTerm;
        const firstFetchNextPage = result.current.fetchNextPage;
        rerender();

        expect(result.current.setSearchTerm).toBe(firstSetSearchTerm);
        expect(result.current.fetchNextPage).toBe(firstFetchNextPage);
    });

    it("merges seed-by-id option when selectedValue missing from first page", () => {
        const { result } = renderHook(() =>
            useSelectByProviderQuery({
                name: "flujo_id",
                url: "/flows",
                enableInfiniteScroll: true,
                selectedValue: "99",
                queryLimit: 2,
            }),
        );

        const seedCall = useGenericSearchQueryMock.mock.calls
            .map(([args]) => args)
            .find((args) => String(args.keyQuery).includes("seed"));

        expect(seedCall.enabled).toBe(true);
        expect(seedCall.filter).toEqual(
            expect.arrayContaining([expect.objectContaining({ field: "id", operator: "eq", value: "99" })]),
        );
        expect(result.current.options.some((o) => String(o.value) === "99" && o.label === "Seeded Flow")).toBe(true);
    });

    it("sorts and filters dataOptions locally when provided", () => {
        useGenericSearchQueryMock.mockImplementation(() => ({
            data: undefined,
            isLoading: false,
            isFetching: false,
            isError: false,
        }));

        const { result } = renderHook(() =>
            useSelectByProviderQuery({
                name: "local",
                url: "",
                dataOptions: [
                    { id: "2", nombre: "Zeta" },
                    { id: "1", nombre: "Alfa" },
                ],
                enableAlphabeticalOrder: true,
                enableSearch: true,
            }),
        );

        expect(result.current.options.map((o) => o.label)).toEqual(["Alfa", "Zeta"]);

        act(() => {
            result.current.setSearchTerm("al");
        });

        expect(result.current.options.map((o) => o.label)).toEqual(["Alfa"]);
    });

    it("uses initialValue as seed without remote seed fetch when label present", () => {
        const { result } = renderHook(() =>
            useSelectByProviderQuery({
                name: "flujo_id",
                url: "/flows",
                enableInfiniteScroll: true,
                selectedValue: "77",
                initialValue: { id: "77", nombre: "Preloaded" },
                queryLimit: 2,
            }),
        );

        const seedCall = useGenericSearchQueryMock.mock.calls
            .map(([args]) => args)
            .find((args) => String(args.keyQuery).includes("seed"));

        expect(seedCall?.enabled).toBe(false);
        expect(result.current.options.at(-1)).toEqual({ value: "77", label: "Preloaded" });
    });

    it("hides the selected seed from search results when it does not match the query", () => {
        const { result } = renderHook(() =>
            useSelectByProviderQuery({
                name: "flujo_id",
                url: "/flows",
                enableSearch: true,
                enableInfiniteScroll: true,
                selectedValue: "77",
                initialValue: { id: "77", nombre: "Preloaded" },
                queryLimit: 2,
            }),
        );

        expect(result.current.options.some((option) => String(option.value) === "77")).toBe(true);

        act(() => {
            result.current.setSearchTerm("zzz");
        });

        expect(result.current.options.some((option) => String(option.value) === "77")).toBe(false);
    });

    it("disables list and seed queries when no remote URL is available", () => {
        renderHook(() =>
            useSelectByProviderQuery({
                name: "flujo_id",
                url: "",
                selectedValue: "99",
            }),
        );

        const calls = useGenericSearchQueryMock.mock.calls.map(([args]) => args);
        const listCall = calls.find(
            (args) =>
                String(args.keyQuery).startsWith("select-by-provider:flujo_id:") &&
                !String(args.keyQuery).endsWith(":seed"),
        );
        const seedCall = calls.find((args) => String(args.keyQuery).endsWith(":seed"));

        expect(listCall).toBeDefined();
        expect(seedCall).toBeDefined();
        expect(listCall.enabled).toBe(false);
        expect(seedCall.enabled).toBe(false);
    });

    it("includes url and order in the list query key", () => {
        renderHook(() =>
            useSelectByProviderQuery({
                name: "flujo_id",
                url: "/flows",
                enableAlphabeticalOrder: true,
            }),
        );

        const listCall = useGenericSearchQueryMock.mock.calls
            .map(([args]) => args)
            .find((args) => !String(args.keyQuery).includes("seed"));

        expect(listCall.keyQuery).toBe(listKey);
    });
});
