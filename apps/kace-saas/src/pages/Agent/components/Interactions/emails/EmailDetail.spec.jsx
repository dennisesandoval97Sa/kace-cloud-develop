import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DOMPurify from "dompurify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiService } from "@kace/utils";
import EmailDetail from "./EmailDetail";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key, options) => options?.defaultValue ?? key }),
}));

vi.mock("./emailPrint/HandleEmailPrint", () => ({
    HandleEmailPrint: () => vi.fn(),
}));

vi.mock("@/components/ui-shared", () => ({
    Button: ({ children, variant, size, ...props }) => <button {...props}>{children}</button>,
}));

vi.mock("@kace/utils", () => ({
    apiService: {
        get: vi.fn(),
    },
}));

const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({
    toast: { error: toastError },
}));

vi.mock("@/utils/getTranslatedError", () => ({
    getTranslatedError: vi.fn().mockReturnValue(""),
}));

const openAttachmentMock = vi.hoisted(() => vi.fn());
vi.mock("../utils/openAttachment", () => ({
    openAttachment: (...args) => openAttachmentMock(...args),
}));

const downloadAttachmentMock = vi.hoisted(() => vi.fn());
vi.mock("../utils/downloadAttachment", () => ({
    downloadAttachment: (...args) => downloadAttachmentMock(...args),
}));

const baseEmail = {
    id: "email-id",
    subject: "Support request",
    sender: "customer@example.com",
    to: ["support@example.com"],
    priority: "normal",
    attachment: [],
    received_at: "2026-05-14T10:00:00.000Z",
};

const externalHtmlEmail = {
    ...baseEmail,
    body: {
        body: "Large body preview",
        body_html: null,
        text: {
            mode: "inline",
            preview_truncated: false,
        },
        html: {
            mode: "external",
            bodyUrl: "/emails/email-id/body?part=html",
            content_type: "text/html; charset=utf-8",
            preview_truncated: true,
        },
    },
};

const emailWithAttachment = {
    id: "email-id",
    subject: "Support request",
    sender: "customer@example.com",
    to: ["support@example.com"],
    priority: "normal",
    received_at: "2026-05-14T10:00:00.000Z",
    body: { body: "Plain", body_html: null },
    attachments: [
        {
            id: "att-1",
            filename: "invoice.pdf",
            url: "https://bucket.s3.amazonaws.com/attachments/email-id/invoice.pdf",
        },
    ],
};

describe("EmailDetail", () => {
    afterEach(() => {
        apiService.get.mockReset();
        toastError.mockReset();
        openAttachmentMock.mockReset();
        downloadAttachmentMock.mockReset();
        vi.restoreAllMocks();
    });

    it("renders the recipient from the flattened string `to` returned by the API", () => {
        render(
            <EmailDetail
                email={{ ...baseEmail, to: ["lmurena@konecta.com", "soporte@konecta.com"], body: { body: "x" } }}
                onBack={vi.fn()}
            />,
        );

        expect(screen.getByText("lmurena@konecta.com, soporte@konecta.com")).toBeInTheDocument();
        expect(screen.queryByText("interactions.detail.notAvailable")).not.toBeInTheDocument();
    });

    it("prefers sanitized HTML body when body_html is present", () => {
        const sanitizeSpy = vi.spyOn(DOMPurify, "sanitize");

        render(
            <EmailDetail
                email={{
                    ...baseEmail,
                    body: {
                        body: "Plain fallback",
                        body_html: '<p><strong>Hello</strong></p><script>alert("x")</script>',
                    },
                }}
                onBack={vi.fn()}
            />,
        );

        expect(sanitizeSpy).toHaveBeenCalledWith('<p><strong>Hello</strong></p><script>alert("x")</script>');
        expect(screen.getByText("Hello")).toBeInTheDocument();
        expect(document.querySelector(".email-body script")).toBeNull();
        expect(apiService.get).not.toHaveBeenCalled();
    });

    it("falls back to plain text as text content when HTML is absent", () => {
        render(
            <EmailDetail
                email={{
                    ...baseEmail,
                    body: {
                        body: '<script>alert("plain")</script> Plain body',
                        body_html: null,
                    },
                }}
                onBack={vi.fn()}
            />,
        );

        expect(screen.getByText('<script>alert("plain")</script> Plain body')).toBeInTheDocument();
        expect(document.querySelector(".email-body script")).toBeNull();
    });

    it("displays attachment filename from the Email detail API", () => {
        render(
            <EmailDetail
                email={{
                    ...baseEmail,
                    body: { body: "Plain", body_html: null },
                    attachments: [
                        {
                            id: "att-1",
                            filename: "invoice.pdf",
                            url: "https://kace.example/invoice.pdf",
                            size: 12,
                        },
                    ],
                }}
                onBack={vi.fn()}
            />,
        );

        expect(screen.getByText("invoice.pdf")).toBeInTheDocument();
    });

    it("uses localized empty fallbacks for missing sender, subject, and received date", () => {
        render(
            <EmailDetail
                email={{
                    ...baseEmail,
                    subject: "",
                    sender: "",
                    to: [],
                    received_at: "",
                    body: { body: "", body_html: null },
                }}
                onBack={vi.fn()}
            />,
        );

        expect(screen.getByText("interactions.detail.noSubject")).toBeInTheDocument();
        expect(screen.getAllByText("interactions.detail.notAvailable")).toHaveLength(3);
        expect(screen.queryByText("cliente@example.com")).not.toBeInTheDocument();
        expect(screen.queryByText("soporte@example.com")).not.toBeInTheDocument();
    });

    it("renders an external body preview and does not fetch the full body until requested", () => {
        render(<EmailDetail email={externalHtmlEmail} onBack={vi.fn()} />);

        expect(screen.getByText("Large body preview")).toBeInTheDocument();
        expect(screen.getByText("This message body is large. The preview is shown above.")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Load full body" })).toBeEnabled();
        expect(apiService.get).not.toHaveBeenCalled();
    });

    it("loads an external HTML body and renders the sanitized full content", async () => {
        const user = userEvent.setup();
        const sanitizeSpy = vi.spyOn(DOMPurify, "sanitize");
        const fullHtml = '<p>Full external body</p><script>alert("x")</script>';
        apiService.get.mockResolvedValue({
            data: {
                data: {
                    content: fullHtml,
                    content_type: "text/html; charset=utf-8",
                    part: "html",
                    mode: "external",
                },
            },
        });

        render(<EmailDetail email={externalHtmlEmail} onBack={vi.fn()} />);

        await user.click(screen.getByRole("button", { name: "Load full body" }));

        expect(apiService.get).toHaveBeenCalledWith("/emails/email-id/body?part=html");
        expect(await screen.findByText("Full external body")).toBeInTheDocument();
        expect(sanitizeSpy).toHaveBeenLastCalledWith(fullHtml);
        expect(document.querySelector(".email-body script")).toBeNull();
        expect(screen.queryByText("Large body preview")).not.toBeInTheDocument();
    });

    it("keeps the external preview visible and shows an error when full body loading fails", async () => {
        const user = userEvent.setup();
        apiService.get.mockRejectedValue(new Error("network error"));

        render(<EmailDetail email={externalHtmlEmail} onBack={vi.fn()} />);

        await user.click(screen.getByRole("button", { name: "Load full body" }));

        await waitFor(() => {
            expect(screen.getByRole("alert")).toHaveTextContent("Unable to load full body. Preview is still shown.");
        });
        expect(screen.getByText("Large body preview")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Load full body" })).toBeEnabled();
    });

    it("shows a toast error and logs to console when openAttachment fails", async () => {
        const user = userEvent.setup();
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        openAttachmentMock.mockRejectedValue(new Error("missing_attachment_download_url"));

        render(<EmailDetail email={emailWithAttachment} onBack={vi.fn()} />);

        await user.click(screen.getByTitle("interactions.detail.viewAttachment"));

        await waitFor(() => {
            expect(toastError).toHaveBeenCalledTimes(1);
        });
        expect(consoleSpy).toHaveBeenCalledWith("[EmailDetail] openAttachment failed", expect.any(Error));
        expect(toastError).toHaveBeenCalledWith("interactions.detail.openAttachmentError");
    });

    it("shows a toast error and logs to console when downloadAttachment fails", async () => {
        const user = userEvent.setup();
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        downloadAttachmentMock.mockRejectedValue(new Error("missing_attachment_download_url"));

        render(<EmailDetail email={emailWithAttachment} onBack={vi.fn()} />);

        await user.click(screen.getByTitle("common.download"));

        await waitFor(() => {
            expect(toastError).toHaveBeenCalledTimes(1);
        });
        expect(consoleSpy).toHaveBeenCalledWith("[EmailDetail] downloadAttachment failed", expect.any(Error));
        expect(toastError).toHaveBeenCalledWith("interactions.detail.downloadAttachmentError");
    });

    it("does not show a toast when openAttachment succeeds", async () => {
        const user = userEvent.setup();
        openAttachmentMock.mockResolvedValue(undefined);

        render(<EmailDetail email={emailWithAttachment} onBack={vi.fn()} />);

        await user.click(screen.getByTitle("interactions.detail.viewAttachment"));

        await waitFor(() => {
            expect(openAttachmentMock).toHaveBeenCalledTimes(1);
        });
        expect(toastError).not.toHaveBeenCalled();
    });

    it("does not show a toast when downloadAttachment succeeds", async () => {
        const user = userEvent.setup();
        downloadAttachmentMock.mockResolvedValue(undefined);

        render(<EmailDetail email={emailWithAttachment} onBack={vi.fn()} />);

        await user.click(screen.getByTitle("common.download"));

        await waitFor(() => {
            expect(downloadAttachmentMock).toHaveBeenCalledTimes(1);
        });
        expect(toastError).not.toHaveBeenCalled();
    });
});
