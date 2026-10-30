import { afterEach, describe, expect, it, vi } from "vitest";
import { apiService } from "@kace/utils";

vi.mock("@kace/utils", () => ({
    apiService: {
        get: vi.fn(),
    },
}));

describe("downloadEmailZip", () => {
    afterEach(() => {
        vi.clearAllMocks();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it("opens the Email download ZIP URL returned by the API", async () => {
        const open = vi.spyOn(window, "open").mockImplementation(() => null);
        apiService.get.mockResolvedValue({
            data: {
                data: {
                    download_url: "https://signed.example/email.zip",
                },
            },
        });

        const { downloadEmailZip } = await import("./downloadEmailZip");

        await expect(downloadEmailZip("email-id")).resolves.toBe("https://signed.example/email.zip");

        expect(apiService.get).toHaveBeenCalledWith("/emails/email-id/download");
        expect(open).toHaveBeenCalledWith("https://signed.example/email.zip", "_blank", "noopener,noreferrer");
    });

    it("fails when the API does not return a download URL", async () => {
        const open = vi.spyOn(window, "open").mockImplementation(() => null);
        apiService.get.mockResolvedValue({ data: { data: {} } });

        const { downloadEmailZip } = await import("./downloadEmailZip");

        await expect(downloadEmailZip("email-id")).rejects.toThrow("missing_email_download_url");
        expect(open).not.toHaveBeenCalled();
    });
});
