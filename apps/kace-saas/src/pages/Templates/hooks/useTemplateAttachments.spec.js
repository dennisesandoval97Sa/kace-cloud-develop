import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useTemplateAttachments from "./useTemplateAttachments";
import { sendInformation } from "../../../services/generic-send-information";

vi.mock("../../../services/generic-send-information", () => ({
    sendInformation: vi.fn(),
}));

const TEMPLATE_ID = "11111111-1111-4111-8111-111111111111";
const SERVER_ATTACHMENT_ID = "22222222-2222-4222-8222-222222222222";

const uploadedFile = (name = "manual.pdf", type = "application/pdf") => ({
    fileData: { name, type },
});

describe("useTemplateAttachments", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("does not send a client-generated attachment id (server generates it)", async () => {
        sendInformation.mockResolvedValue({ status: 201, data: { data: { id: SERVER_ATTACHMENT_ID } } });
        const { result } = renderHook(() => useTemplateAttachments());

        await result.current.saveAttachmentsTemplate(TEMPLATE_ID, [uploadedFile()]);

        expect(sendInformation).toHaveBeenCalledTimes(1);
        const { dataPost } = sendInformation.mock.calls[0][0];
        expect(dataPost).not.toHaveProperty("id");
        expect(dataPost.template_id).toBe(TEMPLATE_ID);
        expect(dataPost.path).toBe("manual.pdf");
    });

    it("adopts the server-created record so later actions use the server id", async () => {
        sendInformation.mockResolvedValue({
            status: 201,
            data: {
                data: {
                    id: SERVER_ATTACHMENT_ID,
                    template_id: TEMPLATE_ID,
                    path: "manual.pdf",
                    type: "application/pdf",
                },
            },
        });
        const { result } = renderHook(() => useTemplateAttachments());

        const saved = await result.current.saveAttachmentsTemplate(TEMPLATE_ID, [uploadedFile()]);

        expect(saved).toHaveLength(1);
        expect(saved[0].id).toBe(SERVER_ATTACHMENT_ID);
        expect(saved[0].path).toBe("manual.pdf");
        expect(saved[0].fileData).toEqual({ name: "manual.pdf", type: "application/pdf" });
    });

    it("propagates an attachment creation failure", async () => {
        const uploadError = new Error("attachment upload failed");
        sendInformation.mockRejectedValueOnce(uploadError);
        const { result } = renderHook(() => useTemplateAttachments());

        await expect(result.current.saveAttachmentsTemplate(TEMPLATE_ID, [uploadedFile()])).rejects.toBe(uploadError);
    });
});
