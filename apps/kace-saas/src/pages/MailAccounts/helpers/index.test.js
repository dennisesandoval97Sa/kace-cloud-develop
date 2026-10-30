import { describe, expect, it, vi } from "vitest";
import { formatDataBeforePost, formatMailAccountFormData, initialValues } from "./index";

vi.mock("@kace/plugins", () => ({
    Uuid: () => "generated-mail-account-id",
}));

describe("Mail Account form data", () => {
    it("does not initialize the retired Channel Hub registration field", () => {
        expect(initialValues).not.toHaveProperty("register_in_channel_hub");
    });

    it("removes the retired Channel Hub registration field from edit data", () => {
        expect(
            formatMailAccountFormData({
                id: "mail-account-id",
                description: "Support mailbox",
                register_in_channel_hub: true,
            }),
        ).toEqual({
            id: "mail-account-id",
            description: "Support mailbox",
        });
    });

    it.each([
        ["create", undefined],
        ["update", "mail-account-id"],
    ])("does not submit the retired Channel Hub registration field on %s", (_mode, id) => {
        const payload = formatDataBeforePost(
            {
                id: "mail-account-id",
                description: "Support mailbox",
                register_in_channel_hub: true,
            },
            id,
        );

        expect(payload).not.toHaveProperty("register_in_channel_hub");
    });
});
