import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import FileList from "./FileList";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key) => {
            if (key === "app.errors.public.HELP_ATTACHMENT_FILENAME_REJECTED") {
                return "This attachment filename is not allowed. Remove the attachment, or rename the file and try again.";
            }
            if (key === "app.text.unnamedFile") return "Unnamed file";
            return key;
        },
    }),
}));

describe("FileList", () => {
    it("shows safe feedback and exposes only deletion for a rejected Help attachment filename", async () => {
        const user = userEvent.setup();
        const onDelete = vi.fn();
        const failedAttachment = {
            id: "failed-attachment",
            path: "select report.pdf",
            status: "failed",
            errorCode: "0x120001",
            errorReason: "raw backend detail must not render",
        };
        render(<FileList files={[failedAttachment]} onDownload={vi.fn()} onDelete={onDelete} isLoading={false} />);

        expect(screen.getByText("select report.pdf")).toBeInTheDocument();
        expect(
            screen.getByText(
                "This attachment filename is not allowed. Remove the attachment, or rename the file and try again.",
            ),
        ).toBeInTheDocument();
        expect(screen.queryByText("raw backend detail must not render")).not.toBeInTheDocument();
        expect(screen.queryByTestId("btn_file_list_download")).not.toBeInTheDocument();

        await user.click(screen.getByTestId("btn_file_list_delete"));

        expect(onDelete).toHaveBeenCalledWith("failed-attachment", failedAttachment);
    });

    it("translates the fallback label for an attachment without a filename", () => {
        render(
            <FileList
                files={[{ id: "unnamed-attachment" }]}
                onDownload={vi.fn()}
                onDelete={vi.fn()}
                isLoading={false}
            />,
        );

        expect(screen.getByText("Unnamed file")).toBeInTheDocument();
    });
});
