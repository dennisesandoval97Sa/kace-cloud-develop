import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import TemplatesUpdateHandler from "./TemplatesUpdateHandler";
import { registerPendingBlobFile } from "../../components/core/Editor/pendingBlobFileRegistry";

const mocks = vi.hoisted(() => ({
    formProps: undefined,
    getUrlS3File: vi.fn(),
    saveAttachmentsTemplate: vi.fn(),
    mutateAsync: vi.fn(),
    navigate: vi.fn(),
    genericHandleSendInformation: vi.fn(),
    sendInformation: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
    useNavigate: () => mocks.navigate,
    useParams: () => ({}),
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

vi.mock("sonner", () => ({
    toast: { error: vi.fn() },
}));

vi.mock("@tanstack/react-query", () => ({
    useQuery: () => ({ data: undefined, isLoading: false }),
}));

vi.mock("../../hooks/useGeneralMutation", () => ({
    default: () => ({ mutateAsync: mocks.mutateAsync, isPending: false }),
}));

vi.mock("../../components/core/Attachment/hooks/useAttachmentsS3", () => ({
    default: () => ({ getUrlS3File: mocks.getUrlS3File }),
}));

vi.mock("./hooks/useTemplateAttachments", () => ({
    default: () => ({ saveAttachmentsTemplate: mocks.saveAttachmentsTemplate }),
}));

vi.mock("../../services/genericHandleSendInformation", () => ({
    genericHandleSendInformation: mocks.genericHandleSendInformation,
}));

vi.mock("../../services/generic-send-information", () => ({
    sendInformation: mocks.sendInformation,
}));

vi.mock("../../services/genericView", () => ({
    genericView: vi.fn(),
}));

vi.mock("./components/TemplatesForm", () => ({
    default: (props) => {
        mocks.formProps = props;
        return null;
    },
}));

const TEMPLATE_ID = "11111111-1111-4111-8111-111111111111";
const fileData = new File(["manual"], "manual.pdf", { type: "application/pdf" });
const formValues = {
    nombre: "Welcome",
    incluye_adjuntos: true,
    adjuntos: [],
    campo: "",
    campo_destino: "",
    ruta: "",
};

describe("TemplatesUpdateHandler create flow", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.formProps = undefined;
        mocks.genericHandleSendInformation.mockReturnValue({ url: "/templates", dataPost: { nombre: "Welcome" } });
        mocks.getUrlS3File.mockResolvedValue([{ fileData }]);
        mocks.saveAttachmentsTemplate.mockResolvedValue([]);
        mocks.sendInformation.mockResolvedValue({ status: 200 });
    });

    it("uploads queued attachments using the server-created template id", async () => {
        mocks.mutateAsync.mockImplementation(async () => {
            expect(mocks.getUrlS3File).not.toHaveBeenCalled();
            return { data: { data: { id: TEMPLATE_ID } } };
        });
        render(<TemplatesUpdateHandler />);

        act(() => {
            mocks.formProps.onPendingFilesChange([{ id: "local-file", pending: true, fileData }]);
        });

        await act(async () => {
            await mocks.formProps.dataHandler(formValues, vi.fn(), vi.fn());
        });

        expect(mocks.getUrlS3File).toHaveBeenCalledWith(TEMPLATE_ID, [fileData], "template");
        expect(mocks.saveAttachmentsTemplate).toHaveBeenCalledWith(TEMPLATE_ID, [{ fileData }]);
        expect(mocks.navigate).toHaveBeenCalledWith("/templates", { replace: true });
    });

    it("keeps the created template and opens edit mode when attachment creation fails", async () => {
        mocks.mutateAsync.mockResolvedValue({ data: { data: { id: TEMPLATE_ID } } });
        mocks.saveAttachmentsTemplate.mockRejectedValue(new Error("attachment creation failed"));
        render(<TemplatesUpdateHandler />);

        act(() => {
            mocks.formProps.onPendingFilesChange([{ id: "local-file", pending: true, fileData }]);
        });

        await act(async () => {
            await mocks.formProps.dataHandler(formValues, vi.fn(), vi.fn());
        });

        expect(mocks.mutateAsync).toHaveBeenCalledTimes(1);
        expect(toast.error).toHaveBeenCalledWith("app.alerts.upload_error");
        expect(mocks.navigate).toHaveBeenCalledWith(`/templates/update/${TEMPLATE_ID}`, { replace: true });
        expect(mocks.navigate).not.toHaveBeenCalledWith("/templates", { replace: true });
    });

    it("uploads a pending inline image (local blob preview) and patches cuerpo with the real template-attachment reference", async () => {
        mocks.mutateAsync.mockResolvedValue({ data: { data: { id: TEMPLATE_ID } } });
        mocks.getUrlS3File.mockResolvedValue([
            {
                id: "att-1",
                fileData: new File(["img"], "abc123-logo.png", { type: "image/png" }),
                s3Path: "template/x",
            },
        ]);
        vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(), revokeObjectURL: vi.fn() });
        registerPendingBlobFile("blob:mock-1", new File(["img"], "abc123-logo.png", { type: "image/png" }));
        render(<TemplatesUpdateHandler />);

        const cuerpo = '<p>Hola</p><img src="blob:mock-1" data-filename="abc123-logo.png" data-mime="image/png">';

        await act(async () => {
            await mocks.formProps.dataHandler({ ...formValues, incluye_adjuntos: false, cuerpo }, vi.fn(), vi.fn());
        });

        expect(mocks.getUrlS3File).toHaveBeenCalledWith(
            TEMPLATE_ID,
            [expect.objectContaining({ name: "abc123-logo.png" })],
            "template",
        );
        expect(mocks.saveAttachmentsTemplate).toHaveBeenCalledWith(TEMPLATE_ID, [
            expect.objectContaining({ id: "att-1", usageType: "inline" }),
        ]);
        expect(mocks.sendInformation).toHaveBeenCalledWith({
            url: `/templates/${TEMPLATE_ID}`,
            dataPost: { cuerpo: expect.stringContaining(`template-attachment://${TEMPLATE_ID}`) },
        });
        expect(mocks.navigate).toHaveBeenCalledWith("/templates", { replace: true });
        vi.unstubAllGlobals();
    });

    it("leaves cuerpo untouched and skips the patch call when the body has no pending inline images", async () => {
        mocks.mutateAsync.mockResolvedValue({ data: { data: { id: TEMPLATE_ID } } });
        render(<TemplatesUpdateHandler />);

        await act(async () => {
            await mocks.formProps.dataHandler(
                { ...formValues, incluye_adjuntos: false, cuerpo: "<p>Sin imagenes</p>" },
                vi.fn(),
                vi.fn(),
            );
        });

        expect(mocks.getUrlS3File).not.toHaveBeenCalled();
        expect(mocks.sendInformation).not.toHaveBeenCalled();
        expect(mocks.navigate).toHaveBeenCalledWith("/templates", { replace: true });
    });

    it("blocks template creation while deferred attachments are still being validated", async () => {
        render(<TemplatesUpdateHandler />);

        act(() => {
            mocks.formProps.onPendingFilesProcessingChange(true);
        });

        expect(mocks.formProps.isSending).toBe(true);

        await act(async () => {
            await mocks.formProps.dataHandler(formValues, vi.fn(), vi.fn());
        });

        expect(mocks.mutateAsync).not.toHaveBeenCalled();

        act(() => {
            mocks.formProps.onPendingFilesProcessingChange(false);
        });

        expect(mocks.formProps.isSending).toBe(false);
    });
});
