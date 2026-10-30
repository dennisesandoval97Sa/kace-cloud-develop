import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import InteractionsList from "./InteractionsList";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key) => {
            const translations = {
                "interactions.title.list": "Interactions list",
                "interactions.list.date": "Date",
                "interactions.list.subject": "Subject",
                "interactions.list.noResults": "No interactions",
                "interactions.list.selectWorkspace": "Select a workspace",
                "event_logs.loading": "Loading",
                "button.previous": "Previous",
                "button.next": "Next",
                "dataTable.pagination.jumpBackward": "-10",
                "dataTable.pagination.jumpForward": "+10",
                "dataTable.pagination.jumpBackwardAriaLabel": "Back 10 pages",
                "dataTable.pagination.jumpForwardAriaLabel": "Forward 10 pages",
            };

            return translations[key] ?? key;
        },
    }),
}));

vi.mock("@/components/ui-shared", () => ({
    Button: ({ children, ...props }) => <button {...props}>{children}</button>,
}));

describe("InteractionsList", () => {
    it("shows the no-results copy for All Workspaces empty results", () => {
        render(<InteractionsList workspaceId="all" interactions={[]} />);

        expect(screen.getByText("No interactions")).toBeInTheDocument();
        expect(screen.queryByText("Select a workspace")).not.toBeInTheDocument();
    });

    it("shows the select-workspace copy only when no workspace context exists", () => {
        render(<InteractionsList interactions={[]} />);

        expect(screen.getByText("Select a workspace")).toBeInTheDocument();
    });

    it("renders a single loading label", () => {
        render(<InteractionsList isLoading />);

        expect(screen.getByText("Loading")).toBeInTheDocument();
    });

    it("does not throw when a read-only list row is clicked without a selection handler", async () => {
        const user = userEvent.setup();

        render(
            <InteractionsList
                interactions={[
                    {
                        id: "interaction-1",
                        description: "Solicitud relacionada",
                        created_at: "2026-06-01T14:22:00.000Z",
                        in_review: false,
                    },
                ]}
            />,
        );

        await expect(user.click(screen.getByText("Solicitud relacionada"))).resolves.toBeUndefined();
    });

    const buildPagination = (overrides = {}) => ({
        page: 5,
        totalPages: 20,
        onPreviousPage: vi.fn(),
        canPreviousPage: true,
        onNextPage: vi.fn(),
        canNextPage: true,
        ...overrides,
    });

    it("does not render the ±10 jump buttons when jump handlers are not provided", () => {
        render(<InteractionsList workspaceId="all" interactions={[]} pagination={buildPagination()} />);

        expect(screen.queryByTestId("btn_interactions_jump_backward")).not.toBeInTheDocument();
        expect(screen.queryByTestId("btn_interactions_jump_forward")).not.toBeInTheDocument();
    });

    it("renders the ±10 jump buttons and routes clicks to the jump handlers", async () => {
        const user = userEvent.setup();
        const onJumpBackward = vi.fn();
        const onJumpForward = vi.fn();

        render(
            <InteractionsList
                workspaceId="all"
                interactions={[]}
                pagination={buildPagination({ onJumpBackward, onJumpForward })}
            />,
        );

        await user.click(screen.getByTestId("btn_interactions_jump_backward"));
        await user.click(screen.getByTestId("btn_interactions_jump_forward"));

        expect(onJumpBackward).toHaveBeenCalledTimes(1);
        expect(onJumpForward).toHaveBeenCalledTimes(1);
    });

    it("disables the backward jump on the first page and the forward jump on the last page", () => {
        const { rerender } = render(
            <InteractionsList
                workspaceId="all"
                interactions={[]}
                pagination={buildPagination({
                    page: 1,
                    canPreviousPage: false,
                    onJumpBackward: vi.fn(),
                    onJumpForward: vi.fn(),
                })}
            />,
        );

        expect(screen.getByTestId("btn_interactions_jump_backward")).toBeDisabled();
        expect(screen.getByTestId("btn_interactions_jump_forward")).toBeEnabled();

        rerender(
            <InteractionsList
                workspaceId="all"
                interactions={[]}
                pagination={buildPagination({
                    page: 20,
                    canNextPage: false,
                    onJumpBackward: vi.fn(),
                    onJumpForward: vi.fn(),
                })}
            />,
        );

        expect(screen.getByTestId("btn_interactions_jump_backward")).toBeEnabled();
        expect(screen.getByTestId("btn_interactions_jump_forward")).toBeDisabled();
    });
});
