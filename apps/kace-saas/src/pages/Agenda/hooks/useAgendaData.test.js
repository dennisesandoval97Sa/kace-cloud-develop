import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { genericSearch } from "../../../services/genericSearch";
import { genericView } from "../../../services/genericView";
import { useAgendaData } from "./useAgendaData";

vi.mock("@kace/urls", () => ({
    AGENDA_SERVICE: "/agendas",
    AGENDA_GROUP_SERVICE: "/agendas-groups",
    GROUP_SERVICE: "/groups",
}));

vi.mock("../../../services/genericSearch", () => ({
    genericSearch: vi.fn(),
}));

vi.mock("../../../services/genericView", () => ({
    genericView: vi.fn(),
}));

const catalog = Array.from({ length: 202 }, (_, index) => {
    const position = String(index + 1).padStart(3, "0");
    return {
        id: `group-${position}`,
        nombre: `Group ${position}`,
        status: index === 201 ? 2 : 1,
    };
});

const savedGroupIds = ["group-001", "group-002", "group-003", "group-199", "group-200", "group-201", "group-202"];

const expectedOptions = savedGroupIds.map((id) => {
    const group = catalog.find((item) => item.id === id);
    return {
        id,
        label: group.nombre,
    };
});

const renderUseAgendaData = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    });
    const wrapper = ({ children }) => createElement(QueryClientProvider, { client: queryClient }, children);

    return {
        queryClient,
        ...renderHook(() => useAgendaData("agenda-1"), { wrapper }),
    };
};

describe("useAgendaData", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        genericView.mockResolvedValue({
            id: "agenda-1",
            description: "Agenda with groups across the catalog",
        });
        genericSearch.mockImplementation(async (url, filters = [], pagination = {}) => {
            if (url === "/agendas-groups/search") {
                return {
                    data: savedGroupIds.map((groupId) => ({
                        agenda_id: "agenda-1",
                        group_id: groupId,
                    })),
                };
            }

            if (url === "/groups/search") {
                let filteredCatalog = catalog;
                const idFilter = filters.find((filter) => filter.field === "id" && filter.operator === "in");
                if (idFilter) {
                    const requestedIds = idFilter.value.split(",").map((id) => id.trim());
                    filteredCatalog = filteredCatalog.filter((group) => requestedIds.includes(group.id));
                }
                const statusFilter = filters.find((filter) => filter.field === "status" && filter.operator === "eq");
                if (statusFilter) {
                    filteredCatalog = filteredCatalog.filter((group) => group.status === statusFilter.value);
                }

                const offset = pagination.offset ?? 0;
                const limit = pagination.limit ?? 100;
                return {
                    data: filteredCatalog.slice(offset, offset + limit),
                };
            }

            return { data: [] };
        });
    });

    it("hydrates every saved Agenda-Group Relationship regardless of Group position or active status", async () => {
        const { result } = renderUseAgendaData();

        await waitFor(() => {
            expect(result.current.dataAgendaToGroup).toEqual(expectedOptions);
        });

        const groupSearchCall = genericSearch.mock.calls.find(([url]) => url === "/groups/search");
        expect(groupSearchCall).toEqual([
            "/groups/search",
            [
                {
                    field: "id",
                    operator: "in",
                    value: savedGroupIds.join(", "),
                    type: "AND",
                },
            ],
            {
                limit: savedGroupIds.length,
                offset: 0,
            },
        ]);
    });
});
