import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useGenericSearchQuery from "@/hooks/useGenericSearchQuery";
import { MultiSelectGroupsWorkspace } from "./MultiSelectGroupsWorkspace";

const refetch = vi.fn();
const useGenericSearchQueryMock = vi.mocked(useGenericSearchQuery);
const lastSearchQueryArgs = () =>
    useGenericSearchQueryMock.mock.calls[useGenericSearchQueryMock.mock.calls.length - 1][0];

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key) =>
            ({
                "groups.form.textSearchGroups": "Search for groups...",
            })[key] ?? key,
    }),
}));

vi.mock("@/hooks/useGenericSearchQuery", () => ({
    default: vi.fn(),
}));

vi.mock("@/hooks/useDebounced", () => ({
    default: (callback) => callback,
}));

vi.mock("@kace/ui-shared", () => ({
    MultiSelect: ({
        data,
        nameTesting,
        onOpenChange,
        setSearchQuery,
        setPage,
        hideSelectAll = false,
        hideSearchButton,
        hasMore,
        isLoading,
        isLoadingMore,
        listValues = [],
        setListValues,
    }) => (
        <div data-testid={`multiselect-${nameTesting}`}>
            <button type="button" onClick={() => onOpenChange(true)}>
                Open
            </button>
            <button type="button" onClick={() => onOpenChange(false)}>
                Close
            </button>
            <button type="button" onClick={() => setPage(2)}>
                Next page
            </button>
            <button
                type="button"
                onClick={() =>
                    setListValues((prev) => [
                        ...prev,
                        { id: "functional-group", label: "Functional group", value: "Functional group" },
                    ])
                }
            >
                Select functional group
            </button>
            <input
                aria-label="Groups search"
                onChange={(event) =>
                    setSearchQuery({
                        input: event.target.value,
                        filter: event.target.value,
                    })
                }
            />
            <output data-testid={`props-${nameTesting}`}>
                {JSON.stringify({ hideSelectAll, hideSearchButton, hasMore, isLoading, isLoadingMore })}
            </output>
            <output data-testid={`selected-${nameTesting}`}>{listValues.map((item) => item.id).join(",")}</output>
            <ul data-testid={`data-${nameTesting}`}>
                {data.map((item) => (
                    <li key={item.id} data-testid={`option-${nameTesting}`}>
                        {item.label}
                    </li>
                ))}
            </ul>
        </div>
    ),
}));

describe("MultiSelectGroupsWorkspace", () => {
    beforeEach(() => {
        refetch.mockClear();
        useGenericSearchQueryMock.mockReturnValue({
            data: { rows: [], total: 0 },
            isFetching: false,
            refetch,
            fetched: false,
        });
    });

    it("does not send a custom override body when reopening the popover", async () => {
        render(<MultiSelectGroupsWorkspace listValues={[]} setListValues={vi.fn()} enableSearch={true} />);

        fireEvent.click(screen.getByRole("button", { name: "Open" }));

        await waitFor(() => {
            expect(refetch).toHaveBeenCalledTimes(1);
        });

        fireEvent.click(screen.getByRole("button", { name: "Close" }));
        fireEvent.click(screen.getByRole("button", { name: "Open" }));

        await waitFor(() => {
            expect(refetch).toHaveBeenCalledTimes(2);
        });

        expect(lastSearchQueryArgs()).toEqual(
            expect.objectContaining({
                pagination: {
                    limit: 10,
                    offset: 0,
                },
            }),
        );
        expect(lastSearchQueryArgs()).not.toHaveProperty("body");
    });

    it("refetches groups when typing a search term while the popover is open", async () => {
        render(<MultiSelectGroupsWorkspace listValues={[]} setListValues={vi.fn()} enableSearch={true} />);

        fireEvent.click(screen.getByRole("button", { name: "Open" }));

        await waitFor(() => {
            expect(refetch).toHaveBeenCalledTimes(1);
        });

        fireEvent.change(screen.getByLabelText("Groups search"), {
            target: { value: "admin" },
        });

        await waitFor(() => {
            expect(refetch).toHaveBeenCalledTimes(2);
        });

        expect(useGenericSearchQueryMock).toHaveBeenLastCalledWith(
            expect.objectContaining({
                filter: [
                    {
                        field: "nombre",
                        operator: "ilike",
                        value: "admin",
                        type: "AND",
                    },
                ],
            }),
        );
    });

    it("uses the catalog select controls and requests the next page with an offset", async () => {
        useGenericSearchQueryMock.mockReturnValue({
            data: {
                rows: Array.from({ length: 10 }, (_, index) => ({
                    id: `group-${index}`,
                    nombre: `Group ${index}`,
                    descripcion: "",
                })),
                total: 25,
            },
            isFetching: false,
            refetch,
            fetched: false,
        });

        render(<MultiSelectGroupsWorkspace listValues={[]} setListValues={vi.fn()} enableSearch={true} />);

        expect(JSON.parse(screen.getByTestId("props-groups").textContent)).toMatchObject({
            hideSelectAll: false,
            hideSearchButton: true,
            hasMore: true,
            isLoading: false,
            isLoadingMore: false,
        });

        fireEvent.click(screen.getByRole("button", { name: "Open" }));

        await waitFor(() => {
            expect(refetch).toHaveBeenCalledTimes(1);
        });

        fireEvent.click(screen.getByRole("button", { name: "Next page" }));

        await waitFor(() => {
            expect(refetch).toHaveBeenCalledTimes(2);
        });

        expect(useGenericSearchQueryMock).toHaveBeenLastCalledWith(
            expect.objectContaining({
                pagination: {
                    limit: 10,
                    offset: 10,
                },
            }),
        );
    });

    it("keeps the active search filter when requesting the next page", async () => {
        useGenericSearchQueryMock.mockReturnValue({
            data: {
                rows: Array.from({ length: 10 }, (_, index) => ({
                    id: `group-${index}`,
                    nombre: `Group ${index}`,
                    descripcion: "",
                })),
                total: 25,
            },
            isFetching: false,
            refetch,
            fetched: false,
        });

        render(<MultiSelectGroupsWorkspace listValues={[]} setListValues={vi.fn()} enableSearch={true} />);

        fireEvent.click(screen.getByRole("button", { name: "Open" }));

        await waitFor(() => {
            expect(refetch).toHaveBeenCalledTimes(1);
        });

        fireEvent.change(screen.getByLabelText("Groups search"), {
            target: { value: "admin" },
        });

        await waitFor(() => {
            expect(refetch).toHaveBeenCalledTimes(2);
        });

        fireEvent.click(screen.getByRole("button", { name: "Next page" }));

        await waitFor(() => {
            expect(refetch).toHaveBeenCalledTimes(3);
        });

        expect(lastSearchQueryArgs()).toEqual(
            expect.objectContaining({
                filter: [
                    {
                        field: "nombre",
                        operator: "ilike",
                        value: "admin",
                        type: "AND",
                    },
                ],
                pagination: {
                    limit: 10,
                    offset: 10,
                },
            }),
        );
    });

    it("falls back to the current row count when the total count is unavailable", () => {
        useGenericSearchQueryMock.mockReturnValue({
            data: {
                rows: Array.from({ length: 10 }, (_, index) => ({
                    id: `group-${index}`,
                    nombre: `Group ${index}`,
                    descripcion: "",
                })),
                total: null,
            },
            isFetching: false,
            refetch,
            fetched: false,
        });

        const { rerender } = render(
            <MultiSelectGroupsWorkspace listValues={[]} setListValues={vi.fn()} enableSearch={true} />,
        );

        expect(JSON.parse(screen.getByTestId("props-groups").textContent)).toMatchObject({
            hasMore: true,
        });

        useGenericSearchQueryMock.mockReturnValue({
            data: {
                rows: Array.from({ length: 9 }, (_, index) => ({
                    id: `group-${index}`,
                    nombre: `Group ${index}`,
                    descripcion: "",
                })),
                total: null,
            },
            isFetching: false,
            refetch,
            fetched: false,
        });

        rerender(<MultiSelectGroupsWorkspace listValues={[]} setListValues={vi.fn()} enableSearch={true} />);

        expect(JSON.parse(screen.getByTestId("props-groups").textContent)).toMatchObject({
            hasMore: false,
        });
    });

    it("adapts functional selection updates before calling the parent setter", () => {
        const setListValues = vi.fn();

        render(<MultiSelectGroupsWorkspace listValues={[]} setListValues={setListValues} enableSearch={true} />);

        fireEvent.click(screen.getByRole("button", { name: "Select functional group" }));

        expect(setListValues).toHaveBeenCalledWith([
            { id: "functional-group", label: "Functional group", value: "Functional group" },
        ]);
        expect(setListValues).not.toHaveBeenCalledWith(expect.any(Function));
    });

    it("keeps selected groups visible before the rest of the search results", async () => {
        useGenericSearchQueryMock.mockReturnValue({
            data: {
                rows: [
                    { id: "other-group", nombre: "Other group", descripcion: "" },
                    { id: "selected-group", nombre: "Selected group", descripcion: "" },
                ],
                total: 2,
            },
            isFetching: false,
            refetch,
            fetched: false,
        });

        render(
            <MultiSelectGroupsWorkspace
                listValues={[{ id: "selected-group", label: "Selected group", value: "Selected group" }]}
                setListValues={vi.fn()}
                enableSearch={true}
            />,
        );

        await waitFor(() => {
            expect(screen.getAllByTestId("option-groups").map((item) => item.textContent)).toEqual([
                "Selected group",
                "Other group",
            ]);
        });
    });
});
