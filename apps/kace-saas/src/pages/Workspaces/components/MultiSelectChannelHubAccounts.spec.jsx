import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useGenericSearchQuery from "@/hooks/useGenericSearchQuery";
import { MultiSelectChannelHubAccounts } from "./MultiSelectChannelHubAccounts";

const refetch = vi.fn();
const useGenericSearchQueryMock = vi.mocked(useGenericSearchQuery);
const lastSearchQueryArgs = () =>
    useGenericSearchQueryMock.mock.calls[useGenericSearchQueryMock.mock.calls.length - 1][0];

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key) =>
            ({
                "channelHub.textSearchAccounts": "Search for accounts...",
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
        listValues,
        setListValues,
        hideSelectAll,
        hideSearchButton,
        hasMore,
        isLoading,
        isLoadingMore,
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
                    setListValues([
                        { id: "first-account", label: "First account", value: "First account" },
                        { id: "second-account", label: "Second account", value: "Second account" },
                    ])
                }
            >
                Select two accounts
            </button>
            <input
                aria-label="Channel Hub account search"
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

describe("MultiSelectChannelHubAccounts", () => {
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
        render(<MultiSelectChannelHubAccounts listValues={[]} setListValues={vi.fn()} enableSearch={true} />);

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

    it("refetches channel hub accounts when typing a search term while the popover is open", async () => {
        render(<MultiSelectChannelHubAccounts listValues={[]} setListValues={vi.fn()} enableSearch={true} />);

        fireEvent.click(screen.getByRole("button", { name: "Open" }));

        await waitFor(() => {
            expect(refetch).toHaveBeenCalledTimes(1);
        });

        fireEvent.change(screen.getByLabelText("Channel Hub account search"), {
            target: { value: "support@example.com" },
        });

        await waitFor(() => {
            expect(refetch).toHaveBeenCalledTimes(2);
        });

        expect(useGenericSearchQueryMock).toHaveBeenLastCalledWith(
            expect.objectContaining({
                filter: [
                    {
                        field: "email",
                        operator: "ilike",
                        value: "support@example.com",
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
                    id: `account-${index}`,
                    email: `account-${index}@example.com`,
                })),
                total: 25,
            },
            isFetching: false,
            refetch,
            fetched: false,
        });

        render(<MultiSelectChannelHubAccounts listValues={[]} setListValues={vi.fn()} enableSearch={true} />);

        expect(JSON.parse(screen.getByTestId("props-channelHubAccounts").textContent)).toMatchObject({
            hideSelectAll: true,
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
                    id: `account-${index}`,
                    email: `account-${index}@example.com`,
                })),
                total: 25,
            },
            isFetching: false,
            refetch,
            fetched: false,
        });

        render(<MultiSelectChannelHubAccounts listValues={[]} setListValues={vi.fn()} enableSearch={true} />);

        fireEvent.click(screen.getByRole("button", { name: "Open" }));

        await waitFor(() => {
            expect(refetch).toHaveBeenCalledTimes(1);
        });

        fireEvent.change(screen.getByLabelText("Channel Hub account search"), {
            target: { value: "support@example.com" },
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
                        field: "email",
                        operator: "ilike",
                        value: "support@example.com",
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
                    id: `account-${index}`,
                    email: `account-${index}@example.com`,
                })),
                total: null,
            },
            isFetching: false,
            refetch,
            fetched: false,
        });

        const { rerender } = render(
            <MultiSelectChannelHubAccounts listValues={[]} setListValues={vi.fn()} enableSearch={true} />,
        );

        expect(JSON.parse(screen.getByTestId("props-channelHubAccounts").textContent)).toMatchObject({
            hasMore: true,
        });

        useGenericSearchQueryMock.mockReturnValue({
            data: {
                rows: Array.from({ length: 9 }, (_, index) => ({
                    id: `account-${index}`,
                    email: `account-${index}@example.com`,
                })),
                total: null,
            },
            isFetching: false,
            refetch,
            fetched: false,
        });

        rerender(<MultiSelectChannelHubAccounts listValues={[]} setListValues={vi.fn()} enableSearch={true} />);

        expect(JSON.parse(screen.getByTestId("props-channelHubAccounts").textContent)).toMatchObject({
            hasMore: false,
        });
    });

    it("keeps every selected channel hub account (ADR-017: multiple accounts per workspace)", async () => {
        const StatefulSelector = () => {
            const [selectedAccounts, setSelectedAccounts] = useState([]);

            return (
                <MultiSelectChannelHubAccounts
                    listValues={selectedAccounts}
                    setListValues={setSelectedAccounts}
                    enableSearch={true}
                />
            );
        };

        render(<StatefulSelector />);

        fireEvent.click(screen.getByRole("button", { name: "Select two accounts" }));

        await waitFor(() => {
            expect(screen.getByTestId("selected-channelHubAccounts")).toHaveTextContent("first-account,second-account");
        });
    });
});
