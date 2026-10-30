import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import FileDropZone from "./FileDropZone";

describe("FileDropZone", () => {
    it("renders while attachment configuration is loading", () => {
        render(
            <FileDropZone
                onFilesSelected={vi.fn()}
                onDownload={vi.fn()}
                onDelete={vi.fn()}
                isUploading={false}
                clearInput={false}
                multipleFiles
                files={[]}
                disabled={false}
            />,
        );

        expect(screen.getByTestId("file_drop_download")).toBeInTheDocument();
    });

    it("treats a zero configured count as no attachment cap", () => {
        render(
            <FileDropZone
                onFilesSelected={vi.fn()}
                onDownload={vi.fn()}
                onDelete={vi.fn()}
                isUploading={false}
                clearInput={false}
                multipleFiles
                files={[{ id: "existing", path: "existing.pdf" }]}
                disabled={false}
                quantityFilesAllowed={0}
            />,
        );

        expect(screen.getByTestId("file_drop_download")).not.toBeDisabled();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("shows the configured count and disables selection at capacity", () => {
        render(
            <FileDropZone
                onFilesSelected={vi.fn()}
                onDownload={vi.fn()}
                onDelete={vi.fn()}
                isUploading={false}
                clearInput={false}
                multipleFiles
                files={[{ id: "existing", path: "existing.pdf" }]}
                disabled={false}
                allowedExtensions={[".pdf"]}
                maximunSizeAllowed={10}
                quantityFilesAllowed={1}
            />,
        );

        expect(screen.getByTestId("file_drop_download")).toBeDisabled();
        expect(screen.getByRole("alert")).toBeInTheDocument();
    });
});
