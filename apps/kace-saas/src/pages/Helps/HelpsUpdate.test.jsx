import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HelpsUpdate from "./HelpsUpdate";

const mocks = vi.hoisted(() => ({
    mutate: vi.fn(),
    navigate: vi.fn(),
    toastError: vi.fn(),
    toastSuccess: vi.fn(),
    uploadPendingAttachments: vi.fn(),
    fetchDelete: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
    useNavigate: () => mocks.navigate,
    useParams: () => ({}),
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key) =>
            key === "app.errors.public.HELP_ATTACHMENT_FILENAME_REJECTED"
                ? "This attachment filename is not allowed. Remove the attachment, or rename the file and try again."
                : key,
    }),
}));

vi.mock("sonner", () => ({
    toast: {
        error: mocks.toastError,
        success: mocks.toastSuccess,
    },
}));

vi.mock("../../hooks/useGeneralMutation", () => ({
    default: () => ({ mutate: mocks.mutate, isPending: false }),
}));

vi.mock("../../hooks/useGenericViewQuery", () => ({
    default: () => ({ data: undefined, isLoading: false }),
}));

vi.mock("./hooks/useHelpAttachments", () => ({
    default: () => ({
        uploadPendingAttachments: mocks.uploadPendingAttachments,
    }),
}));

vi.mock("../../services/deleteService", () => ({
    fetchDelete: mocks.fetchDelete,
}));

vi.mock("../../components/core/Cards/DashboardSectionCard", () => ({
    // eslint-disable-next-line react/prop-types
    DashboardSectionCard: ({ children }) => <div>{children}</div>,
}));

vi.mock("../../components/ui-shared", () => ({
    GeneralLoader: () => <div>Loading</div>,
}));

vi.mock("./components/HelpsForm", () => ({
    default: ({ dataHandler, onPendingAttachmentsChange, pendingAttachments, persistedHelpId }) => (
        <div>
            <button
                type="button"
                onClick={() =>
                    onPendingAttachmentsChange([
                        {
                            id: "pending-attachment-id",
                            fileData: new File(["help"], "help.txt", {
                                type: "text/plain",
                            }),
                            status: "pending",
                        },
                    ])
                }
            >
                Select attachment
            </button>
            <button
                type="button"
                onClick={() =>
                    onPendingAttachmentsChange([
                        {
                            id: "pending-success-id",
                            fileData: new File(["success"], "success.txt", { type: "text/plain" }),
                            status: "pending",
                        },
                        {
                            id: "pending-failure-id",
                            fileData: new File(["failure"], "select report.pdf", { type: "application/pdf" }),
                            status: "pending",
                        },
                    ])
                }
            >
                Select mixed attachments
            </button>
            <button
                type="button"
                onClick={() =>
                    dataHandler(
                        {
                            titulo: "Help title",
                            descripcion: "Help description",
                            color: "#ffffff",
                        },
                        vi.fn(),
                        vi.fn(),
                    )
                }
            >
                Save Help
            </button>
            <span data-testid="pending-count">{pendingAttachments?.length ?? 0}</span>
            <span data-testid="persisted-help-id">{persistedHelpId ?? ""}</span>
        </div>
    ),
}));

describe("HelpsUpdate create flow", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.mutate.mockResolvedValue({
            data: { data: { id: "server-help-id" } },
        });
        mocks.uploadPendingAttachments.mockResolvedValue([]);
        mocks.fetchDelete.mockResolvedValue(true);
    });

    it("creates the Help without a client ID, then uploads with the returned ID", async () => {
        const user = userEvent.setup();
        let resolveCreate;
        mocks.mutate.mockReturnValue(
            new Promise((resolve) => {
                resolveCreate = resolve;
            }),
        );
        render(<HelpsUpdate />);

        await user.click(screen.getByRole("button", { name: "Select attachment" }));
        await user.click(screen.getByRole("button", { name: "Save Help" }));

        await waitFor(() => expect(mocks.mutate).toHaveBeenCalledTimes(1));
        expect(mocks.uploadPendingAttachments).not.toHaveBeenCalled();
        resolveCreate({ data: { data: { id: "server-help-id" } } });
        const createPayload = mocks.mutate.mock.calls[0][0];
        expect(createPayload.dataPost).not.toHaveProperty("id");
        expect(createPayload.options).toMatchObject({
            isCreate: true,
            serverGeneratedId: true,
        });
        await waitFor(() =>
            expect(mocks.uploadPendingAttachments).toHaveBeenCalledWith("server-help-id", [
                expect.objectContaining({
                    id: "pending-attachment-id",
                    status: "pending",
                }),
            ]),
        );
        expect(screen.getByTestId("persisted-help-id")).toHaveTextContent("server-help-id");
        expect(mocks.navigate).toHaveBeenCalledWith("/helps", {
            replace: true,
        });
    });

    it("deletes a newly created Help when every attachment fails, then recreates it on retry", async () => {
        const user = userEvent.setup();
        mocks.uploadPendingAttachments
            .mockResolvedValueOnce([
                {
                    id: "pending-attachment-id",
                    fileData: new File(["help"], "help.txt", {
                        type: "text/plain",
                    }),
                    status: "failed",
                },
            ])
            .mockResolvedValueOnce([]);
        render(<HelpsUpdate />);

        await user.click(screen.getByRole("button", { name: "Select attachment" }));
        await user.click(screen.getByRole("button", { name: "Save Help" }));

        await waitFor(() => expect(mocks.toastError).toHaveBeenCalled());
        expect(mocks.navigate).not.toHaveBeenCalled();
        expect(mocks.mutate).toHaveBeenCalledTimes(1);
        expect(mocks.fetchDelete).toHaveBeenCalledWith("server-help-id", "/helps");
        expect(screen.getByTestId("pending-count")).toHaveTextContent("1");

        await user.click(screen.getByRole("button", { name: "Save Help" }));

        await waitFor(() => expect(mocks.navigate).toHaveBeenCalled());
        expect(mocks.mutate).toHaveBeenCalledTimes(2);
        expect(mocks.uploadPendingAttachments).toHaveBeenCalledTimes(2);
    });

    it("keeps the persisted Help id when compensating deletion fails", async () => {
        const user = userEvent.setup();
        // fetchDelete propaga los fallos HTTP; el call site los absorbe para no tapar el error de adjuntos.
        mocks.fetchDelete.mockRejectedValue(new Error("delete_failed"));
        mocks.uploadPendingAttachments
            .mockResolvedValueOnce([
                {
                    id: "pending-attachment-id",
                    fileData: new File(["help"], "help.txt", { type: "text/plain" }),
                    status: "failed",
                },
            ])
            .mockResolvedValueOnce([]);
        render(<HelpsUpdate />);

        await user.click(screen.getByRole("button", { name: "Select attachment" }));
        await user.click(screen.getByRole("button", { name: "Save Help" }));
        await waitFor(() => expect(mocks.fetchDelete).toHaveBeenCalledWith("server-help-id", "/helps"));

        await user.click(screen.getByRole("button", { name: "Save Help" }));

        await waitFor(() => expect(mocks.navigate).toHaveBeenCalled());
        expect(mocks.mutate).toHaveBeenCalledTimes(1);
        expect(mocks.uploadPendingAttachments).toHaveBeenCalledTimes(2);
    });

    it("retains mixed outcomes, shows filename guidance, and navigates only after failures clear", async () => {
        const user = userEvent.setup();
        const successfulOutcome = {
            id: "server-success-id",
            fileData: new File(["success"], "success.txt", { type: "text/plain" }),
            status: "success",
        };
        const failedOutcome = {
            id: "pending-failure-id",
            fileData: new File(["failure"], "select report.pdf", { type: "application/pdf" }),
            status: "failed",
            errorCode: "0x120001",
            errorReason: "filename_rejected",
        };
        mocks.uploadPendingAttachments.mockResolvedValueOnce([successfulOutcome, failedOutcome]).mockResolvedValueOnce([
            successfulOutcome,
            {
                ...failedOutcome,
                id: "server-retried-id",
                status: "success",
                errorCode: undefined,
                errorReason: undefined,
            },
        ]);
        render(<HelpsUpdate />);

        await user.click(screen.getByRole("button", { name: "Select mixed attachments" }));
        await user.click(screen.getByRole("button", { name: "Save Help" }));

        await waitFor(() =>
            expect(mocks.toastError).toHaveBeenCalledWith(
                "This attachment filename is not allowed. Remove the attachment, or rename the file and try again.",
            ),
        );
        expect(screen.getByTestId("pending-count")).toHaveTextContent("2");
        expect(mocks.navigate).not.toHaveBeenCalled();
        expect(mocks.mutate).toHaveBeenCalledTimes(1);

        await user.click(screen.getByRole("button", { name: "Save Help" }));

        await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith("/helps", { replace: true }));
        expect(mocks.mutate).toHaveBeenCalledTimes(1);
        expect(mocks.uploadPendingAttachments).toHaveBeenNthCalledWith(
            2,
            "server-help-id",
            expect.arrayContaining([
                expect.objectContaining({ id: "server-success-id", status: "success" }),
                expect.objectContaining({ id: "pending-failure-id", status: "failed" }),
            ]),
        );
    });

    it("does not upload files when Help creation fails", async () => {
        const user = userEvent.setup();
        mocks.mutate.mockRejectedValue(new Error("create_failed"));
        render(<HelpsUpdate />);

        await user.click(screen.getByRole("button", { name: "Select attachment" }));
        await user.click(screen.getByRole("button", { name: "Save Help" }));

        await waitFor(() => expect(mocks.mutate).toHaveBeenCalledTimes(1));
        expect(mocks.uploadPendingAttachments).not.toHaveBeenCalled();
        expect(mocks.navigate).not.toHaveBeenCalled();
    });
});
