import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useGenericSearchQuery from "@/hooks/useGenericSearchQuery";
import { useInteractionCaseSearch } from "./useInteractionCaseSearch";

vi.mock("@/hooks/useGenericSearchQuery", () => ({
    default: vi.fn(() => ({
        data: { items: [], total: 0 },
        isLoading: false,
        isFetching: false,
        refetch: vi.fn(),
    })),
}));

const renderSearchHook = (props) => renderHook(() => useInteractionCaseSearch(props));

const getSearchQueryOptions = () => useGenericSearchQuery.mock.calls.at(-1)[0];

const getSearchGroup = (filter) => filter.find((item) => Array.isArray(item.filters));

describe("useInteractionCaseSearch", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("searches open cases for the selected client with pagination and linked id exclusion", () => {
        renderSearchHook({
            clientId: "client-1",
            searchTerm: "sftp",
            page: 2,
            pageSize: 20,
            excludedCaseIds: ["case-linked"],
        });

        expect(useGenericSearchQuery).toHaveBeenCalledWith(
            expect.objectContaining({
                url: "/interactions/interaction-cases/candidates/search",
                keyQuery: ["interaction-case-search", "client-1", "sftp", 2, 20, "case-linked"],
                pagination: { limit: 20, offset: 20 },
                enabled: true,
            }),
        );

        const call = getSearchQueryOptions();
        expect(call.filter).toEqual(
            expect.arrayContaining([
                { field: "cliente_id", operator: "eq", value: "client-1", type: "AND" },
                { field: "fecha_resolucion", operator: "null", value: "null", type: "AND" },
                { field: "id", operator: "notIn", value: "case-linked", type: "AND" },
                expect.objectContaining({ groupType: "AND" }),
            ]),
        );
    });

    it("AND-combines the OR search group with client, open-case, and exclusion filters", () => {
        renderSearchHook({
            clientId: "client-1",
            searchTerm: "sftp",
            excludedCaseIds: ["case-linked"],
        });

        const searchGroup = getSearchGroup(getSearchQueryOptions().filter);

        expect(searchGroup).toEqual(
            expect.objectContaining({
                groupType: "AND",
                filters: expect.arrayContaining([
                    { field: "nivel1", operator: "ilike", value: "sftp", type: "OR" },
                    { field: "login", operator: "ilike", value: "sftp", type: "OR" },
                ]),
            }),
        );
    });

    it("trims the search term for filters and keyQuery", () => {
        renderSearchHook({
            clientId: "client-1",
            searchTerm: "  sftp  ",
        });

        const call = getSearchQueryOptions();
        const searchGroup = getSearchGroup(call.filter);

        expect(call.keyQuery).toEqual(["interaction-case-search", "client-1", "sftp", 1, 20, ""]);
        expect(searchGroup.filters).toEqual(
            expect.arrayContaining([expect.objectContaining({ field: "nivel1", value: "sftp" })]),
        );
        expect(searchGroup.filters).not.toEqual(
            expect.arrayContaining([expect.objectContaining({ value: "  sftp  " })]),
        );
    });

    it("omits reference from text searches to avoid numeric ilike filters", () => {
        renderSearchHook({
            clientId: "client-1",
            searchTerm: "sftp",
        });

        const searchGroup = getSearchGroup(getSearchQueryOptions().filter);

        expect(searchGroup.filters).toEqual(
            expect.arrayContaining([
                { field: "nivel1", operator: "ilike", value: "sftp", type: "OR" },
                { field: "login", operator: "ilike", value: "sftp", type: "OR" },
            ]),
        );
        expect(searchGroup.filters).not.toEqual(
            expect.arrayContaining([expect.objectContaining({ field: "reference" })]),
        );
    });

    it("includes reference as an equality filter for numeric searches", () => {
        renderSearchHook({
            clientId: "client-1",
            searchTerm: "12345",
        });

        const searchGroup = getSearchGroup(getSearchQueryOptions().filter);

        expect(searchGroup.filters).toEqual(
            expect.arrayContaining([
                { field: "reference", operator: "eq", value: "12345", type: "OR" },
                { field: "nivel1", operator: "ilike", value: "12345", type: "OR" },
            ]),
        );
    });

    it("does not add exclusion or search-group filters when no ids or search term are provided", () => {
        renderSearchHook({
            clientId: "client-1",
            searchTerm: " ",
            excludedCaseIds: [],
        });

        const call = getSearchQueryOptions();

        expect(call.filter).toEqual([
            { field: "cliente_id", operator: "eq", value: "client-1", type: "AND" },
            { field: "fecha_resolucion", operator: "null", value: "null", type: "AND" },
        ]);
        expect(call.keyQuery).toEqual(["interaction-case-search", "client-1", "", 1, 20, ""]);
    });

    it("is disabled without a selected client", () => {
        renderSearchHook({
            clientId: null,
            searchTerm: "sftp",
        });

        expect(getSearchQueryOptions()).toEqual(expect.objectContaining({ enabled: false }));
    });

    it("honors an explicit disabled flag when a selected client exists", () => {
        renderSearchHook({
            clientId: "client-1",
            searchTerm: "sftp",
            enabled: false,
        });

        expect(getSearchQueryOptions()).toEqual(expect.objectContaining({ enabled: false }));
    });

    it("normalizes selected search results into items and total", () => {
        renderSearchHook({ clientId: "client-1" });

        const selected = getSearchQueryOptions().select({
            data: [{ id: "case-1" }],
            metadata: { count: "7" },
        });

        expect(selected).toEqual({
            items: [{ id: "case-1" }],
            total: 7,
        });
    });
});
