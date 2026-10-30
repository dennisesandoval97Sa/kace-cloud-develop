import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { format } from "date-fns";
import { apiService } from "@kace/utils";
import useUserInformation from "@/hooks/useUserInformation";
import InteractionDetailModal from "./InteractionDetailModal";
import { downloadAttachmentsZip } from "../../Agent/components/Interactions/utils/downloadAttachmentsZip";
import { downloadEmailZip } from "../../Agent/components/Interactions/utils/downloadEmailZip";

vi.mock("@kace/utils", () => ({
    apiService: {
        get: vi.fn(),
        post: vi.fn(),
    },
}));

vi.mock("@/hooks/useUserInformation", () => ({
    default: vi.fn(),
}));

vi.mock("../../Agent/components/Interactions/utils/downloadAttachmentsZip", () => ({
    downloadAttachmentsZip: vi.fn(),
}));

vi.mock("../../Agent/components/Interactions/utils/downloadEmailZip", () => ({
    downloadEmailZip: vi.fn(),
}));

vi.mock("sonner", () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key, options) => {
            const translations = {
                "interactions.detail.modalTitle": "Detalle de interacción",
                "interactions.detail.modal.back": "Atrás",
                "interactions.detail.modal.manage": "Gestionar",
                "interactions.detail.modal.release": "Liberar",
                "interactions.detail.modal.channel": "Canal",
                "interactions.detail.modal.priority": "Prioridad",
                "interactions.detail.modal.received": "Recepción",
                "interactions.detail.modal.created": "Creación",
                "interactions.detail.modal.contentPreview": "Vista previa del contenido",
                "interactions.detail.modal.attachmentsCount": "Archivos adjuntos ({{count}})",
                "interactions.detail.modal.emailAttachmentsCount": "Adjuntos del correo ({{count}})",
                "interactions.detail.modal.open": "Abrir",
                "interactions.detail.modal.downloadAttachments": "Descargar adjuntos",
                "interactions.detail.modal.attachment": "Archivo adjunto",
                "interactions.detail.modal.fullContent": "Contenido completo del correo",
                "interactions.detail.modal.scrollHint": "Vista desplazable si el mensaje es más largo",
                "interactions.detail.actions.moreOptions": "Más opciones",
                "interactions.detail.actions.move": "Mover interacción",
                "interactions.detail.actions.close": "Cerrar interacción",
                "interactions.detail.actions.delete": "Eliminar interacción",
                "interactions.detail.actions.moveTitle": "Mover interacción",
                "interactions.detail.actions.moveDescription": "Selecciona a dónde quieres mover esta interacción.",
                "interactions.detail.actions.closeTitle": "Cerrar interacción",
                "interactions.detail.actions.closeDescription": "Confirma el cierre de esta interacción.",
                "interactions.detail.actions.deleteTitle": "Eliminar interacción",
                "interactions.detail.actions.deleteDescription": "Esta accion no se puede deshacer.",
                "interactions.detail.actions.selectedInteraction": "Interacción seleccionada",
                "interactions.detail.actions.workspaceDestination": "Espacio de trabajo destino",
                "interactions.detail.actions.closeMotive": "Motivo de cierre",
                "interactions.detail.actions.deleteMotive": "Motivo de eliminación",
                "interactions.detail.actions.workspacePlaceholder": "Selecciona un espacio de trabajo",
                "interactions.detail.actions.motivePlaceholder": "Selecciona un motivo",
                "interactions.detail.actions.closeNotice":
                    "La interacción quedará marcada como Cerrada y saldrá del flujo activo.",
                "interactions.detail.actions.deleteWarningTitle": "Se eliminará la interacción {{subject}}",
                "interactions.detail.actions.deleteWarningDescription":
                    "También se perderá el historial operativo asociado a esta vista.",
                "interactions.detail.actions.cancel": "Cancelar",
                "interactions.detail.content": "Contenido",
                "interactions.detail.underReview": "En revision",
                "interactions.detail.from": "De",
                "interactions.detail.to": "Para",
                "interactions.detail.print": "Imprimir",
                "interactions.detail.normal": "Normal",
                "interactions.detail.noSubject": "Sin asunto",
                "interactions.review.tooltipOther": "En revision por otro agente",
                "interactions.review.claimSuccess": "Interacción en revisión",
                "interactions.review.releaseSuccess": "Interacción liberada",
                "interactions.review.conflict": "La interacción ya está en revisión por otro agente.",
                "interactions.review.forbidden": "No tienes permiso para liberar esta interacción.",
                "interactions.review.manageForbidden": "No tienes permiso para gestionar esta interacción.",
                "interactions.review.tooltipNoPermission": "No tienes permiso para gestionar esta interacción.",
                "app.forms.close": "Cerrar",
            };
            const value = translations[key] ?? (typeof options?.defaultValue === "string" ? options.defaultValue : key);
            return value.replace("{{count}}", options?.count ?? "").replace("{{subject}}", options?.subject ?? "");
        },
    }),
}));

const interaction = {
    id: "interaction-1",
    description: "Embebido",
    client_identifier: "sara07111@hotmail.com",
    channel: "Inbox",
    priority: "Validada",
    receipt_at: "2024-04-29T18:36:11.000Z",
    created_at: "2024-05-07T09:30:40.000Z",
    body: "No suele recibir correos electrónicos de sara07111@hotmail.com.",
    attachments: [
        { id: "attachment-1", filename: "logo-color-scaled.webp", url: "s3://logo-color-scaled.webp" },
        { id: "attachment-2", filename: "archivo-ajunto.png", url: "s3://archivo-ajunto.png" },
    ],
};

const rowOnlyInteraction = {
    id: "interaction-with-email",
    description: "Embebido",
    client_identifier: "sara07111@hotmail.com",
    email_id: "email-1",
    receipt_at: "2024-04-29T18:36:11.000Z",
    created_at: "2024-05-07T09:30:40.000Z",
};

const externalHtmlInteraction = {
    ...interaction,
    id: "interaction-external-html",
    body: {
        body: "External HTML preview",
        body_html: null,
        text: {
            mode: "inline",
            preview_truncated: false,
        },
        html: {
            mode: "external",
            bodyUrl: "/emails/email-1/body?part=html",
            content_type: "text/html; charset=utf-8",
            preview_truncated: true,
        },
    },
};

const defaultUserInformation = {
    user: { id: "current-user" },
    permissionsAdmin: [{ module_id: "interactions", name: "InteractionsUpdate", granted: true }],
    permissionsAgent: [],
};

const renderWithClient = (ui) => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
        },
    });

    return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

describe("InteractionDetailModal", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useUserInformation.mockReturnValue(defaultUserInformation);
        apiService.post.mockResolvedValue({ data: { updated: 1 } });
    });

    it("renders the selected interaction inside the shared dialog", () => {
        renderWithClient(<InteractionDetailModal open onOpenChange={vi.fn()} interaction={interaction} />);

        const dialog = screen.getByRole("dialog");

        expect(dialog).toHaveTextContent("Embebido");
        expect(dialog).toHaveTextContent("sara07111@hotmail.com");
    });

    it("shows the matched workspace label instead of the legacy channel value", () => {
        renderWithClient(
            <InteractionDetailModal
                open
                onOpenChange={vi.fn()}
                interaction={{
                    ...interaction,
                    workspace_id: "workspace-juanfers",
                    channel: "Inbox",
                }}
                workspaceOptions={[{ label: "workspaceJuanfers", value: "workspace-juanfers" }]}
            />,
        );

        const dialog = screen.getByRole("dialog");

        expect(dialog).toHaveTextContent("workspaceJuanfers");
        expect(dialog).not.toHaveTextContent("Inbox");
    });

    it("preserves explicit backend channels but uses an em dash when no channel identity exists", () => {
        const { unmount } = renderWithClient(
            <InteractionDetailModal
                open
                onOpenChange={vi.fn()}
                interaction={{ ...interaction, channel: "Mailbox A" }}
            />,
        );

        expect(screen.getByRole("dialog")).toHaveTextContent("Mailbox A");

        unmount();
        renderWithClient(
            <InteractionDetailModal open onOpenChange={vi.fn()} interaction={{ ...interaction, channel: undefined }} />,
        );

        const dialog = screen.getByRole("dialog");
        expect(dialog).toHaveTextContent("—");
        expect(dialog).not.toHaveTextContent("Inbox");
    });

    it("loads email content and attachments when the row only has email_id", async () => {
        const user = userEvent.setup();
        const emailAttachment = {
            id: "attachment-from-email",
            filename: "detalle-correo.pdf",
            url: "https://bucket.s3.amazonaws.com/attachments/email-1/detalle-correo.pdf",
        };

        apiService.get.mockResolvedValueOnce({
            status: 200,
            data: {
                data: {
                    id: "email-1",
                    sender: "sara07111@hotmail.com",
                    body: {
                        body: "This is the real email body from the detail endpoint.",
                        body_html: null,
                    },
                    attachments: [emailAttachment],
                },
            },
        });

        renderWithClient(<InteractionDetailModal open onOpenChange={vi.fn()} interaction={rowOnlyInteraction} />);

        await waitFor(() => {
            expect(apiService.get).toHaveBeenCalledWith("/emails/email-1");
        });

        expect(await screen.findByText("This is the real email body from the detail endpoint.")).toBeInTheDocument();
        expect(screen.getByText("detalle-correo.pdf")).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Descargar adjuntos" }));

        expect(downloadEmailZip).toHaveBeenCalledWith("email-1");
        expect(downloadAttachmentsZip).not.toHaveBeenCalled();
    });

    it("downloads the email from the grey download button when the email has no attachments", async () => {
        const user = userEvent.setup();

        apiService.get.mockResolvedValueOnce({
            status: 200,
            data: {
                data: {
                    id: "email-1",
                    sender: "sara07111@hotmail.com",
                    body: {
                        body: "This is the real email body without attachments.",
                        body_html: null,
                    },
                    attachments: [],
                },
            },
        });

        renderWithClient(<InteractionDetailModal open onOpenChange={vi.fn()} interaction={rowOnlyInteraction} />);

        await waitFor(() => {
            expect(apiService.get).toHaveBeenCalledWith("/emails/email-1");
        });

        const downloadButton = screen.getByRole("button", { name: "Descargar adjuntos" });

        expect(downloadButton).toBeEnabled();

        await user.click(downloadButton);

        expect(downloadEmailZip).toHaveBeenCalledWith("email-1");
        expect(downloadAttachmentsZip).not.toHaveBeenCalled();
    });

    it("opens the full email modal over the compact modal from the blue Abrir button", async () => {
        const user = userEvent.setup();

        renderWithClient(<InteractionDetailModal open onOpenChange={vi.fn()} interaction={interaction} />);

        const openButton = screen.getByRole("button", { name: "Abrir" });

        expect(openButton.querySelector("svg")).toBeInTheDocument();
        expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);

        await user.click(openButton);

        const dialogs = document.querySelectorAll('[role="dialog"]');
        expect(dialogs).toHaveLength(2);
        expect(screen.getByText("Vista previa del contenido")).toBeInTheDocument();
        expect(screen.getByText("Contenido completo del correo")).toBeInTheDocument();
        expect(screen.getByText("Adjuntos del correo (2)")).toBeInTheDocument();
        expect(screen.getByText("Re: Embebido")).toBeInTheDocument();
        expect(within(dialogs[1]).queryByRole("button", { name: "Cerrar" })).not.toBeInTheDocument();

        await user.click(within(dialogs[1]).getByRole("button", { name: "Atrás" }));

        expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
        expect(screen.getByText("Vista previa del contenido")).toBeInTheDocument();
    });

    it("loads external HTML body content when the full email modal opens", async () => {
        const user = userEvent.setup();
        apiService.get.mockResolvedValueOnce({
            headers: { "content-type": "text/html; charset=utf-8" },
            data: '<p><strong>Full S3 body</strong></p><script>alert("x")</script>',
        });

        renderWithClient(<InteractionDetailModal open onOpenChange={vi.fn()} interaction={externalHtmlInteraction} />);

        await user.click(screen.getByRole("button", { name: "Abrir" }));

        const dialogs = document.querySelectorAll('[role="dialog"]');

        expect(apiService.get).toHaveBeenCalledWith("/emails/email-1/body?part=html");
        expect(await within(dialogs[1]).findByText("Full S3 body")).toBeInTheDocument();
        expect(dialogs[1].querySelector(".email-body script")).toBeNull();
        expect(within(dialogs[1]).queryByText("External HTML preview")).not.toBeInTheDocument();
    });

    it("downloads all attachments as a zip from the grey download button", async () => {
        const user = userEvent.setup();

        renderWithClient(<InteractionDetailModal open onOpenChange={vi.fn()} interaction={interaction} />);

        await user.click(screen.getByRole("button", { name: "Descargar adjuntos" }));

        expect(downloadAttachmentsZip).toHaveBeenCalledWith(interaction.attachments, "interaction-1-attachments.zip");
    });

    it("matches the compact Pencil modal structure", () => {
        renderWithClient(<InteractionDetailModal open onOpenChange={vi.fn()} interaction={interaction} />);

        const dialog = screen.getByRole("dialog");

        expect(dialog).toHaveTextContent("Gestionar");
        expect(dialog).toHaveTextContent("Canal");
        expect(dialog).toHaveTextContent("Inbox");
        expect(dialog).toHaveTextContent("Prioridad");
        expect(dialog).toHaveTextContent("Validada");
        expect(dialog).toHaveTextContent("Recepción");
        // The modal converts the backend's UTC timestamps to the local timezone.
        // Compute the expectation with the same formatter so the assertion holds in
        // any machine/CI timezone (matches how other date tests stay TZ-agnostic).
        expect(dialog).toHaveTextContent(format(new Date("2024-04-29T18:36:11.000Z"), "yyyy-MM-dd HH:mm:ss"));
        expect(dialog).toHaveTextContent("Creación");
        expect(dialog).toHaveTextContent(format(new Date("2024-05-07T09:30:40.000Z"), "yyyy-MM-dd HH:mm:ss"));
        expect(dialog).toHaveTextContent("Vista previa del contenido");
        expect(dialog).toHaveTextContent("Archivos adjuntos (2)");
        expect(dialog).toHaveTextContent("logo-color-scaled.webp");
        expect(dialog).toHaveTextContent("archivo-ajunto.png");
        expect(dialog).not.toHaveTextContent("Inicio de revisión");
        expect(dialog).not.toHaveTextContent("Cerrar");
    });

    it("claims review from the Gestionar button", async () => {
        const user = userEvent.setup();
        const onReviewChange = vi.fn();

        renderWithClient(
            <InteractionDetailModal
                open
                onOpenChange={vi.fn()}
                interaction={{ ...interaction, in_review: false }}
                onReviewChange={onReviewChange}
            />,
        );

        await user.click(screen.getByRole("button", { name: "Gestionar" }));

        await waitFor(() => {
            expect(apiService.post).toHaveBeenCalledWith("/interactions/interaction-1/review/claim", {});
        });
        await waitFor(() => {
            expect(onReviewChange).toHaveBeenCalled();
        });
    });

    it("renders Liberar when current user owns review", () => {
        renderWithClient(
            <InteractionDetailModal
                open
                onOpenChange={vi.fn()}
                interaction={{ ...interaction, in_review: true, start_review_by: "current-user" }}
            />,
        );

        expect(screen.getByRole("button", { name: "Liberar" })).toBeEnabled();
    });

    it("renders disabled En revision for another reviewer without permission", () => {
        useUserInformation.mockReturnValue({
            user: { id: "current-user" },
            permissionsAdmin: [],
            permissionsAgent: [],
        });

        renderWithClient(
            <InteractionDetailModal
                open
                onOpenChange={vi.fn()}
                interaction={{ ...interaction, in_review: true, start_review_by: "other-user" }}
            />,
        );

        const reviewButton = screen.getByRole("button", { name: "En revision" });

        expect(reviewButton).toBeDisabled();
        expect(reviewButton).toHaveAttribute("title", "En revision por otro agente");
    });

    it("notifies when the shared dialog close button is clicked", async () => {
        const user = userEvent.setup();
        const onOpenChange = vi.fn();

        renderWithClient(<InteractionDetailModal open onOpenChange={onOpenChange} interaction={interaction} />);

        await user.click(screen.getByTestId("btn_dialog_content_close"));

        expect(onOpenChange).toHaveBeenCalledWith(false);
    });
});
