import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SuggestedInteractionClientModal from "./SuggestedInteractionClientModal";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key, options) =>
            ({
                "button.cancel": "Cancel",
                "interactions.client.confirmSuggestedClient": "Use selected Client",
                "interactions.client.keepCurrentClient": "Keep current Client",
                "interactions.client.switchToSuggestedClient": "Switch to suggested Client",
            })[key] ??
            options?.defaultValue ??
            key,
    }),
}));

vi.mock("@/components/ui-shared", () => ({
    Button: ({ children, variant: _variant, ...props }) => <button {...props}>{children}</button>,
    Dialog: ({ children, open }) => (open ? <div>{children}</div> : null),
    DialogContent: ({ children }) => <div>{children}</div>,
    DialogDescription: ({ children }) => <p>{children}</p>,
    DialogFooter: ({ children }) => <div>{children}</div>,
    DialogHeader: ({ children }) => <div>{children}</div>,
    DialogTitle: ({ children }) => <h2>{children}</h2>,
}));

const suggestedClient = {
    id: "client-1",
    nombres: "Maria Contreras",
    tipo_documento: "CC",
    documento: "123456998",
    email: "brayan16j@gmail.com",
};

const renderModal = (hasCurrentClient = false) =>
    render(
        <SuggestedInteractionClientModal
            open
            onOpenChange={vi.fn()}
            senderEmail="brayan16j@gmail.com"
            clients={[suggestedClient]}
            onConfirm={vi.fn()}
            hasCurrentClient={hasCurrentClient}
        />,
    );

describe("SuggestedInteractionClientModal", () => {
    it("uses the standard suggestion actions when no Client is currently selected", () => {
        renderModal();

        expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Use selected Client" })).toBeInTheDocument();
    });

    it("uses explicit keep-or-switch actions when another Client is currently selected", () => {
        renderModal(true);

        expect(screen.getByRole("button", { name: "Keep current Client" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Switch to suggested Client" })).toBeInTheDocument();
    });
});
