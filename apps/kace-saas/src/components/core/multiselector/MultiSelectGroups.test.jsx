import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { genericSearchService } from "../../../services/genericSearchService";
import { MultiSelectGroups } from "./MultiSelectGroups";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key) => key,
    }),
}));

vi.mock("../../../services/genericSearchService", () => ({
    genericSearchService: vi.fn(),
}));

const groups = Array.from({ length: 120 }, (_, index) => {
    const position = String(index + 1).padStart(3, "0");
    return {
        id: `group-${position}`,
        nombre: `Group ${position}`,
        descripcion: `Description ${position}`,
        status: 1,
    };
});
const inactiveGroup = {
    id: "inactive-group",
    nombre: "Inactive historical group",
    descripcion: "Previously assigned",
    status: 2,
};

const renderSelector = ({ enableInfiniteScroll = true, values = [] } = {}) => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    });

    const Harness = () => {
        const [selectedGroups, setSelectedGroups] = useState([]);
        return (
            <MultiSelectGroups
                enableInfiniteScroll={enableInfiniteScroll}
                listValues={selectedGroups}
                setListValues={setSelectedGroups}
                values={values}
            />
        );
    };

    return render(
        <QueryClientProvider client={queryClient}>
            <Harness />
        </QueryClientProvider>,
    );
};

const scrollToEnd = () => {
    const list = document.querySelector("[cmdk-list]");
    Object.defineProperties(list, {
        clientHeight: { configurable: true, value: 100 },
        scrollHeight: { configurable: true, value: 500 },
        scrollTop: { configurable: true, value: 400, writable: true },
    });
    fireEvent.scroll(list);
};

describe("MultiSelectGroups", () => {
    beforeAll(() => {
        Element.prototype.scrollIntoView = vi.fn();
    });

    beforeEach(() => {
        vi.clearAllMocks();
        genericSearchService.mockImplementation(async (_url, filters, pagination) => {
            const idFilter = filters.find((filter) => filter.field === "id" && filter.operator === "in");
            const nameFilter = filters.find((filter) => filter.field === "nombre" && filter.operator === "ilike");
            const statusFilter = filters.find((filter) => filter.field === "status" && filter.operator === "eq");
            const requestedIds = idFilter?.value.split(",").map((id) => id.trim());
            const filteredGroups = [...groups, inactiveGroup]
                .filter((group) => !requestedIds || requestedIds.includes(group.id))
                .filter((group) => !statusFilter || group.status === statusFilter.value)
                .filter(
                    (group) =>
                        !nameFilter || group.nombre.toLowerCase().includes(String(nameFilter.value).toLowerCase()),
                );
            const offset = pagination?.offset ?? 0;
            const limit = pagination?.limit ?? 50;
            return {
                data: filteredGroups.slice(offset, offset + limit),
                count: limit,
                total: filteredGroups.length,
                metadata: {
                    count: filteredGroups.length,
                },
            };
        });
    });

    it("loads the next active-group page when the user reaches the end of the list", async () => {
        renderSelector();

        await waitFor(() => {
            expect(screen.getByTestId("trigger_multiselect_groups")).not.toBeDisabled();
        });
        fireEvent.click(screen.getByTestId("trigger_multiselect_groups"));

        expect(await screen.findByText("Group 050")).toBeInTheDocument();
        expect(screen.queryByText("Group 051")).not.toBeInTheDocument();

        scrollToEnd();

        expect(await screen.findByText("Group 051")).toBeInTheDocument();
    });

    it("keeps the existing eager-loading behavior when infinite scroll is not enabled", async () => {
        renderSelector({ enableInfiniteScroll: false });

        await waitFor(() => {
            expect(screen.getByTestId("trigger_multiselect_groups")).not.toBeDisabled();
        });
        fireEvent.click(screen.getByTestId("trigger_multiselect_groups"));

        expect(await screen.findByText("Group 120")).toBeInTheDocument();
        expect(
            genericSearchService.mock.calls.some(
                ([, , pagination]) => pagination?.limit === 1000 && pagination?.offset === 0,
            ),
        ).toBe(true);
    });

    it("hides the explicit search action in the paginated Agenda selector", async () => {
        renderSelector();

        await waitFor(() => {
            expect(screen.getByTestId("trigger_multiselect_groups")).not.toBeDisabled();
        });
        fireEvent.click(screen.getByTestId("trigger_multiselect_groups"));

        expect(screen.queryByTestId("btn_search")).not.toBeInTheDocument();
    });

    it("hides the explicit search action in the eager selector, where it had no wired search", async () => {
        renderSelector({ enableInfiniteScroll: false });

        await waitFor(() => {
            expect(screen.getByTestId("trigger_multiselect_groups")).not.toBeDisabled();
        });
        fireEvent.click(screen.getByTestId("trigger_multiselect_groups"));

        expect(await screen.findByText("Group 120")).toBeInTheDocument();
        expect(screen.queryByTestId("btn_search")).not.toBeInTheDocument();
    });

    it("keeps the current group selection while another page is appended", async () => {
        renderSelector();

        await waitFor(() => {
            expect(screen.getByTestId("trigger_multiselect_groups")).not.toBeDisabled();
        });
        fireEvent.click(screen.getByTestId("trigger_multiselect_groups"));
        fireEvent.click(await screen.findByTestId("item_multiselect_groups_group-001"));

        expect(screen.getByTestId("chip_multiselect_groups_group-001")).toBeInTheDocument();

        scrollToEnd();
        expect(await screen.findByText("Group 051")).toBeInTheDocument();

        expect(screen.getByTestId("chip_multiselect_groups_group-001")).toBeInTheDocument();
    });

    it("shows selected groups before unselected groups in the edit list", async () => {
        renderSelector({
            values: [
                { id: "group-040", label: "Group 040" },
                { id: "group-002", label: "Group 002" },
            ],
        });

        expect(await screen.findByTestId("chip_multiselect_groups_group-040")).toBeInTheDocument();
        fireEvent.click(screen.getByTestId("trigger_multiselect_groups"));

        const visibleOptions = await screen.findAllByTestId(/^item_multiselect_groups_/);
        expect(visibleOptions.slice(0, 3).map((option) => option.textContent)).toEqual([
            "Group 040",
            "Group 002",
            "Group 001",
        ]);
    });

    it("keeps option order and scroll position stable while the picker is open", async () => {
        renderSelector();

        await waitFor(() => {
            expect(screen.getByTestId("trigger_multiselect_groups")).not.toBeDisabled();
        });
        fireEvent.click(screen.getByTestId("trigger_multiselect_groups"));

        const list = document.querySelector("[cmdk-list]");
        Object.defineProperty(list, "scrollTop", {
            configurable: true,
            value: 160,
            writable: true,
        });

        fireEvent.click(await screen.findByTestId("item_multiselect_groups_group-040"));

        const visibleOptions = await screen.findAllByTestId(/^item_multiselect_groups_/);
        expect(visibleOptions.slice(0, 3).map((option) => option.textContent)).toEqual([
            "Group 001",
            "Group 002",
            "Group 003",
        ]);
        expect(list.scrollTop).toBe(160);
    });

    it("debounces server search across the complete active-group catalog", async () => {
        renderSelector();

        await waitFor(() => {
            expect(screen.getByTestId("trigger_multiselect_groups")).not.toBeDisabled();
        });
        fireEvent.click(screen.getByTestId("trigger_multiselect_groups"));

        fireEvent.change(screen.getByTestId("input_search"), {
            target: { value: "Group 1" },
        });
        fireEvent.change(screen.getByTestId("input_search"), {
            target: { value: "Group 119" },
        });

        const searchCalls = () =>
            genericSearchService.mock.calls.filter(([, filters]) =>
                filters.some((filter) => filter.field === "nombre" && filter.operator === "ilike"),
            );

        expect(searchCalls()).toHaveLength(0);
        await waitFor(() => {
            expect(searchCalls()).toHaveLength(1);
        });
        expect(searchCalls()[0][1]).toContainEqual({
            field: "nombre",
            operator: "ilike",
            value: "Group 119",
            type: "AND",
        });

        expect(await screen.findByText("Group 119")).toBeInTheDocument();
    });

    it("does not match group descriptions while the name search is debouncing", async () => {
        renderSelector();

        await waitFor(() => {
            expect(screen.getByTestId("trigger_multiselect_groups")).not.toBeDisabled();
        });
        fireEvent.click(screen.getByTestId("trigger_multiselect_groups"));

        fireEvent.change(screen.getByTestId("input_search"), {
            target: { value: "Description 001" },
        });

        expect(screen.queryByText("Group 001")).not.toBeInTheDocument();
    });

    it("restores the unfiltered first page immediately when search is cleared", async () => {
        renderSelector();

        await waitFor(() => {
            expect(screen.getByTestId("trigger_multiselect_groups")).not.toBeDisabled();
        });
        fireEvent.click(screen.getByTestId("trigger_multiselect_groups"));
        fireEvent.change(screen.getByTestId("input_search"), {
            target: { value: "Group 119" },
        });

        expect(await screen.findByText("Group 119")).toBeInTheDocument();

        fireEvent.change(screen.getByTestId("input_search"), {
            target: { value: "" },
        });

        expect(screen.getByText("Group 001")).toBeInTheDocument();
    });

    it("allows removing an assigned inactive group without offering it for selection again", async () => {
        renderSelector({
            values: [{ id: inactiveGroup.id, label: inactiveGroup.nombre }],
        });

        expect(await screen.findByTestId(`chip_multiselect_groups_${inactiveGroup.id}`)).toBeInTheDocument();

        fireEvent.click(screen.getByTestId("trigger_multiselect_groups"));
        expect(await screen.findByText("Group 001")).toBeInTheDocument();
        fireEvent.click(screen.getByTestId(`item_multiselect_groups_${inactiveGroup.id}`));

        expect(screen.queryByTestId(`chip_multiselect_groups_${inactiveGroup.id}`)).not.toBeInTheDocument();
        expect(screen.queryByTestId(`item_multiselect_groups_${inactiveGroup.id}`)).not.toBeInTheDocument();
    });
});
