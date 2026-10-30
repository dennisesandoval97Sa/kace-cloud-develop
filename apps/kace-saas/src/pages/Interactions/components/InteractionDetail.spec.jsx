import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { apiService } from "@kace/utils";
import InteractionDetail from "./InteractionDetail";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key, options) => options?.defaultValue ?? key }),
}));

vi.mock("@kace/utils", () => ({
    apiService: {
        get: vi.fn(),
    },
}));

const baseInteraction = {
    id: "interaction-id",
    description: "Support email",
    client_identifier: "customer@example.com",
    priority: "normal",
    receipt_at: "2026-05-21T16:27:00.000Z",
    in_review: false,
    is_closed: false,
};

describe("InteractionDetail", () => {
    it("does not render placeholder attachments when the interaction has none", () => {
        render(<InteractionDetail interaction={baseInteraction} />);

        expect(screen.queryByText("documento.pdf")).not.toBeInTheDocument();
        expect(screen.queryByText("imagen.jpg")).not.toBeInTheDocument();
        expect(screen.queryByText("interactions.detail.attachments")).not.toBeInTheDocument();
    });

    it("renders actual interaction attachments when present", () => {
        const url = "https://bucket.s3.amazonaws.com/attachments/email-id/invoice.pdf";
        render(
            <InteractionDetail
                interaction={{
                    ...baseInteraction,
                    attachments: [
                        {
                            id: "att-1",
                            filename: "invoice.pdf",
                            url,
                            size: "245 KB",
                        },
                    ],
                }}
            />,
        );

        expect(screen.getByText("interactions.detail.attachments")).toBeInTheDocument();
        expect(screen.getByText("invoice.pdf")).toBeInTheDocument();
        expect(screen.getByText("(245 KB)")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /invoice\.pdf/ })).toHaveAttribute("title", "invoice.pdf");
    });

    it("renders the plain email body in the content area instead of the subject", () => {
        render(
            <InteractionDetail
                interaction={{
                    ...baseInteraction,
                    body: {
                        body: "This is the real body received from the email.",
                        body_html: null,
                    },
                }}
            />,
        );

        const contentBlock = screen.getByText("interactions.detail.content").nextElementSibling;

        expect(contentBlock).toHaveTextContent("This is the real body received from the email.");
        expect(contentBlock).not.toHaveTextContent("Support email");
    });

    it("prefers sanitized HTML email body when available", () => {
        render(
            <InteractionDetail
                interaction={{
                    ...baseInteraction,
                    body: {
                        body: "Plain fallback",
                        body_html: '<p><strong>Hello from HTML</strong></p><script>alert("x")</script>',
                    },
                }}
            />,
        );

        const contentBlock = screen.getByText("interactions.detail.content").nextElementSibling;

        expect(contentBlock).toHaveTextContent("Hello from HTML");
        expect(contentBlock.querySelector("strong")).not.toBeNull();
        expect(contentBlock.querySelector("script")).toBeNull();
        expect(contentBlock).not.toHaveTextContent("Plain fallback");
    });

    it("renders and loads external HTML bodies in the administrator detail view", async () => {
        const user = userEvent.setup();
        apiService.get.mockResolvedValue({
            data: {
                data: {
                    content: '<p>Full administrator HTML body</p><script>alert("x")</script>',
                    content_type: "text/html; charset=utf-8",
                    part: "html",
                    mode: "external",
                },
            },
        });

        render(
            <InteractionDetail
                interaction={{
                    ...baseInteraction,
                    body: {
                        body: "Large administrator preview",
                        body_html: null,
                        text: { mode: "inline", preview_truncated: false },
                        html: {
                            mode: "external",
                            bodyUrl: "/emails/email-id/body?part=html",
                            content_type: "text/html; charset=utf-8",
                            preview_truncated: true,
                        },
                    },
                }}
            />,
        );

        expect(screen.getByText("Large administrator preview")).toBeInTheDocument();
        expect(screen.getByText("This message body is large. The preview is shown above.")).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Load full body" }));

        expect(apiService.get).toHaveBeenCalledWith("/emails/email-id/body?part=html");
        expect(await screen.findByText("Full administrator HTML body")).toBeInTheDocument();
        expect(document.querySelector(".email-body script")).toBeNull();
        expect(screen.queryByText("Large administrator preview")).not.toBeInTheDocument();
    });

    it("keeps the administrator external preview visible when loading full body fails", async () => {
        const user = userEvent.setup();
        apiService.get.mockRejectedValue(new Error("network error"));

        render(
            <InteractionDetail
                interaction={{
                    ...baseInteraction,
                    body: {
                        body: "Large administrator preview",
                        body_html: null,
                        html: {
                            mode: "external",
                            bodyUrl: "/emails/email-id/body?part=html",
                            preview_truncated: true,
                        },
                    },
                }}
            />,
        );

        await user.click(screen.getByRole("button", { name: "Load full body" }));

        await waitFor(() => {
            expect(screen.getByRole("alert")).toHaveTextContent("Unable to load full body. Preview is still shown.");
        });
        expect(screen.getByText("Large administrator preview")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Load full body" })).toBeEnabled();
    });

    it("renders the no-content fallback when the email body is empty", () => {
        render(
            <InteractionDetail
                interaction={{
                    ...baseInteraction,
                    body: {
                        body: "",
                        body_html: null,
                    },
                }}
            />,
        );

        expect(screen.getByText("genericTexts.noContent")).toBeInTheDocument();
    });

    it("opens attachments through the provided click handler instead of the raw S3 URL", async () => {
        const user = userEvent.setup();
        const onOpenAttachment = vi.fn();
        const attachment = {
            id: "att-1",
            filename: "invoice.pdf",
            url: "https://bucket.s3.amazonaws.com/attachments/email-id/invoice.pdf",
        };

        render(
            <InteractionDetail
                interaction={{
                    ...baseInteraction,
                    attachments: [attachment],
                }}
                onOpenAttachment={onOpenAttachment}
            />,
        );

        await user.click(screen.getByRole("button", { name: /invoice\.pdf/ }));

        expect(onOpenAttachment).toHaveBeenCalledWith(attachment);
    });

    it("shortens long attachment names while keeping the attachment clickable", () => {
        const filename = "very-long-channel-hub-attachment-name-1234567890.png";
        const url =
            "https://bucket.s3.amazonaws.com/attachments/email-id/very-long-channel-hub-attachment-name-1234567890.png";

        render(
            <InteractionDetail
                interaction={{
                    ...baseInteraction,
                    attachments: [
                        {
                            id: "att-1",
                            filename,
                            url,
                        },
                    ],
                }}
            />,
        );

        const button = screen.getByRole("button", { name: "very-long-channel-hub-att....png" });

        expect(button).toHaveAttribute("title", filename);
        expect(screen.queryByText(filename)).not.toBeInTheDocument();
    });
});
