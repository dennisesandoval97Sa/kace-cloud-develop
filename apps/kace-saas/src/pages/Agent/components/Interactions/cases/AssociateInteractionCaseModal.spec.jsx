import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AssociateInteractionCaseModal from "./AssociateInteractionCaseModal";

const mocks = vi.hoisted(() => ({
    searchResult: { data: { items: [], total: 0 }, isLoading: false, isFetching: false },
    associateInteractionCases: vi.fn(),
    isPending: false,
    onAssociated: vi.fn(),
    onCreateCase: vi.fn(),
    onOpenChange: vi.fn(),
}));

vi.mock("./hooks/useInteractionCaseSearch", () => ({
    useInteractionCaseSearch: vi.fn(() => mocks.searchResult),
}));

vi.mock("./hooks/useAssociateInteractionCases", () => ({
    useAssociateInteractionCases: vi.fn(() => ({
        associateInteractionCases: mocks.associateInteractionCases,
        isPending: mocks.isPending,
    })),
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key, options) =>
            ({
                "interactions.cases.associateCase": "Associate Case",
                "interactions.cases.associateCaseDescription": "Search open Cases for the selected Client.",
                "interactions.cases.searchPlaceholder": "Search by reference, classification, or responsible",
                "interactions.cases.searchCasesLabel": "Search Cases",
                "interactions.cases.searchResults": "Case search results",
                "interactions.cases.noOpenCases": "No open Cases found for this Client",
                "interactions.cases.createCase": "Create Case",
                "interactions.cases.confirmAssociate": "Associate selected Case",
                "interactions.cases.subcase": "Subcase",
                "button.cancel": "Cancel",
            })[key] ??
            options?.defaultValue ??
            key,
    }),
}));

const renderModal = (props = {}) =>
    render(
        <AssociateInteractionCaseModal
            open
            onOpenChange={mocks.onOpenChange}
            interactionId="interaction-1"
            clientId="client-1"
            linkedCaseIds={["linked-case"]}
            onAssociated={mocks.onAssociated}
            {...props}
        />,
    );

describe("AssociateInteractionCaseModal", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.searchResult = { data: { items: [], total: 0 }, isLoading: false, isFetching: false };
        mocks.isPending = false;
    });

    it("renders open case results from the search hook", () => {
        mocks.searchResult = {
            data: {
                items: [
                    {
                        id: "case-1",
                        reference: 123,
                        nivel1: "Connectivity",
                        nivel2: "VPN",
                        estadoActual: "Open",
                        responsible_name: "Ada Lovelace",
                    },
                ],
                total: 1,
            },
            isLoading: false,
            isFetching: false,
        };

        renderModal();

        expect(screen.getByText("#123")).toBeInTheDocument();
        expect(screen.getByText("Connectivity / VPN")).toBeInTheDocument();
        expect(screen.getByText("Open")).toBeInTheDocument();
        expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    });

    it("configures the associate mutation without default success navigation", async () => {
        const { useAssociateInteractionCases } = await import("./hooks/useAssociateInteractionCases");

        renderModal();

        expect(useAssociateInteractionCases).toHaveBeenCalledWith("interaction-1", {
            onSuccessToast: false,
            path: null,
        });
    });

    it("selects one Case and confirms the association", async () => {
        const user = userEvent.setup();
        mocks.searchResult = {
            data: {
                items: [
                    { id: "case-1", reference: 123, nivel1: "Connectivity", estadoActual: "Open" },
                    { id: "case-2", reference: 456, nivel1: "Billing", estadoActual: "Open" },
                ],
                total: 2,
            },
            isLoading: false,
            isFetching: false,
        };

        renderModal();

        const confirmButton = screen.getByRole("button", { name: "Associate selected Case" });
        expect(confirmButton).toBeDisabled();

        await user.click(screen.getByRole("button", { name: /#456/i }));
        expect(confirmButton).toBeEnabled();

        await user.click(confirmButton);

        expect(mocks.associateInteractionCases).toHaveBeenCalledWith(
            { caso_id: "case-2" },
            { onSuccess: expect.any(Function) },
        );

        const success = mocks.associateInteractionCases.mock.calls[0][1].onSuccess;
        success();

        expect(mocks.onAssociated).toHaveBeenCalledWith("case-2");
    });

    it("searches with selected client, linked case exclusions, and clears selection when search changes", async () => {
        const user = userEvent.setup();
        const { useInteractionCaseSearch } = await import("./hooks/useInteractionCaseSearch");
        mocks.searchResult = {
            data: {
                items: [{ id: "case-1", reference: 123, nivel1: "Connectivity", estadoActual: "Open" }],
                total: 1,
            },
            isLoading: false,
            isFetching: false,
        };

        renderModal();

        await user.click(screen.getByRole("button", { name: /#123/i }));
        expect(screen.getByRole("button", { name: "Associate selected Case" })).toBeEnabled();

        await user.type(screen.getByRole("textbox", { name: "Search Cases" }), "vpn");

        expect(useInteractionCaseSearch).toHaveBeenLastCalledWith({
            clientId: "client-1",
            searchTerm: "vpn",
            page: 1,
            pageSize: 20,
            excludedCaseIds: ["linked-case"],
            enabled: true,
        });
        expect(screen.getByRole("button", { name: "Associate selected Case" })).toBeDisabled();
    });

    it("disables hidden searches while the modal is closed", async () => {
        const { useInteractionCaseSearch } = await import("./hooks/useInteractionCaseSearch");

        renderModal({ open: false });

        expect(useInteractionCaseSearch).toHaveBeenLastCalledWith({
            clientId: "client-1",
            searchTerm: "",
            page: 1,
            pageSize: 20,
            excludedCaseIds: ["linked-case"],
            enabled: false,
        });
    });

    it("provides an accessible search input label", () => {
        renderModal();

        expect(screen.getByRole("textbox", { name: "Search Cases" })).toBeInTheDocument();
    });

    it("resets search, pagination, and selected case when the modal closes and reopens", async () => {
        const user = userEvent.setup();
        const { useInteractionCaseSearch } = await import("./hooks/useInteractionCaseSearch");
        mocks.searchResult = {
            data: {
                items: [{ id: "case-1", reference: 123, nivel1: "Connectivity", estadoActual: "Open" }],
                total: 40,
            },
            isLoading: false,
            isFetching: false,
        };

        const { rerender } = renderModal();

        await user.type(screen.getByRole("textbox", { name: "Search Cases" }), "vpn");
        await user.click(screen.getByRole("button", { name: "Next" }));
        await user.click(screen.getByRole("button", { name: /#123/i }));
        expect(screen.getByRole("button", { name: "Associate selected Case" })).toBeEnabled();

        rerender(
            <AssociateInteractionCaseModal
                open={false}
                onOpenChange={mocks.onOpenChange}
                interactionId="interaction-1"
                clientId="client-1"
                linkedCaseIds={["linked-case"]}
                onAssociated={mocks.onAssociated}
            />,
        );

        rerender(
            <AssociateInteractionCaseModal
                open
                onOpenChange={mocks.onOpenChange}
                interactionId="interaction-1"
                clientId="client-1"
                linkedCaseIds={["linked-case"]}
                onAssociated={mocks.onAssociated}
            />,
        );

        await waitFor(() => {
            expect(screen.getByRole("textbox", { name: "Search Cases" })).toHaveValue("");
            expect(screen.getByRole("button", { name: "Associate selected Case" })).toBeDisabled();
            expect(useInteractionCaseSearch).toHaveBeenLastCalledWith({
                clientId: "client-1",
                searchTerm: "",
                page: 1,
                pageSize: 20,
                excludedCaseIds: ["linked-case"],
                enabled: true,
            });
        });
    });

    it("resets stale modal state when the selected client changes", async () => {
        const user = userEvent.setup();
        const { useInteractionCaseSearch } = await import("./hooks/useInteractionCaseSearch");
        mocks.searchResult = {
            data: {
                items: [{ id: "case-1", reference: 123, nivel1: "Connectivity", estadoActual: "Open" }],
                total: 40,
            },
            isLoading: false,
            isFetching: false,
        };

        const { rerender } = renderModal();

        await user.type(screen.getByRole("textbox", { name: "Search Cases" }), "vpn");
        await user.click(screen.getByRole("button", { name: "Next" }));
        await user.click(screen.getByRole("button", { name: /#123/i }));

        rerender(
            <AssociateInteractionCaseModal
                open
                onOpenChange={mocks.onOpenChange}
                interactionId="interaction-1"
                clientId="client-2"
                linkedCaseIds={["linked-case"]}
                onAssociated={mocks.onAssociated}
            />,
        );

        await waitFor(() => {
            expect(screen.getByRole("textbox", { name: "Search Cases" })).toHaveValue("");
            expect(screen.getByRole("button", { name: "Associate selected Case" })).toBeDisabled();
            expect(useInteractionCaseSearch).toHaveBeenLastCalledWith({
                clientId: "client-2",
                searchTerm: "",
                page: 1,
                pageSize: 20,
                excludedCaseIds: ["linked-case"],
                enabled: true,
            });
        });
    });

    it("does not allow confirming a stale selected Case that is no longer in current results", async () => {
        const user = userEvent.setup();
        mocks.searchResult = {
            data: {
                items: [{ id: "case-1", reference: 123, nivel1: "Connectivity", estadoActual: "Open" }],
                total: 1,
            },
            isLoading: false,
            isFetching: false,
        };

        const { rerender } = renderModal();

        await user.click(screen.getByRole("button", { name: /#123/i }));
        expect(screen.getByRole("button", { name: "Associate selected Case" })).toBeEnabled();

        mocks.searchResult = {
            data: {
                items: [{ id: "case-2", reference: 456, nivel1: "Billing", estadoActual: "Open" }],
                total: 1,
            },
            isLoading: false,
            isFetching: false,
        };

        rerender(
            <AssociateInteractionCaseModal
                open
                onOpenChange={mocks.onOpenChange}
                interactionId="interaction-1"
                clientId="client-1"
                linkedCaseIds={["linked-case"]}
                onAssociated={mocks.onAssociated}
            />,
        );

        expect(screen.getByRole("button", { name: "Associate selected Case" })).toBeDisabled();
        expect(mocks.associateInteractionCases).not.toHaveBeenCalled();
    });

    it("constrains the case results list so footer actions stay visible", () => {
        mocks.searchResult = {
            data: {
                items: [{ id: "case-1", reference: 123, nivel1: "Connectivity", estadoActual: "Open" }],
                total: 1,
            },
            isLoading: false,
            isFetching: false,
        };

        renderModal();

        expect(screen.getByRole("list", { name: "Case search results" })).toHaveClass(
            "max-h-[min(28rem,60vh)]",
            "overflow-y-auto",
        );
    });

    it("shows an empty state when there are no open Cases for the selected Client", () => {
        renderModal();

        expect(screen.getByText("No open Cases found for this Client")).toBeInTheDocument();
    });

    it("shows the Create Case shortcut only when allowed and calls onCreateCase", async () => {
        const user = userEvent.setup();

        const { rerender } = renderModal({
            canCreateCase: false,
            onCreateCase: mocks.onCreateCase,
        });

        expect(screen.queryByRole("button", { name: "Create Case" })).not.toBeInTheDocument();

        rerender(
            <AssociateInteractionCaseModal
                open
                onOpenChange={mocks.onOpenChange}
                interactionId="interaction-1"
                clientId="client-1"
                linkedCaseIds={[]}
                canCreateCase
                onCreateCase={mocks.onCreateCase}
            />,
        );

        await user.click(screen.getByRole("button", { name: "Create Case" }));

        expect(mocks.onCreateCase).toHaveBeenCalledTimes(1);
    });

    it("labels subcases when parent_id exists", () => {
        mocks.searchResult = {
            data: {
                items: [
                    {
                        id: "case-1",
                        reference: 123,
                        parent_id: "parent-case",
                        nivel1: "Connectivity",
                    },
                ],
                total: 1,
            },
            isLoading: false,
            isFetching: false,
        };

        renderModal();

        expect(screen.getByText("Subcase")).toBeInTheDocument();
    });

    it("disables confirm while the association is pending", async () => {
        const user = userEvent.setup();
        mocks.isPending = true;
        mocks.searchResult = {
            data: {
                items: [{ id: "case-1", reference: 123, nivel1: "Connectivity" }],
                total: 1,
            },
            isLoading: false,
            isFetching: false,
        };

        renderModal();

        await user.click(screen.getByRole("button", { name: /#123/i }));

        expect(screen.getByRole("button", { name: "Associate selected Case" })).toBeDisabled();
    });
});
