import { describe, expect, it } from "vitest";
import { buildChannelHubTableActions } from "./ChannelHubHandler";
import { createChannelHubTestI18n } from "./test/channelHubTestI18n";

const i18n = createChannelHubTestI18n("en");
const translate = i18n.t.bind(i18n);

describe("ChannelHubHandler action policy", () => {
    it("does not add Register for read-only Channel Hub users", () => {
        const readAction = {
            name: "View",
            permissionName: "ChannelHubRead",
            action: () => undefined,
        };

        expect(
            buildChannelHubTableActions({
                arrayAction: [readAction],
                translate,
                handleRegister: () => undefined,
            }),
        ).toEqual([readAction]);
    });

    it("adds a non-customizable Register action gated by ChannelHubUpdate", () => {
        const handleRegister = () => "registered";
        const updateAction = {
            name: "Edit",
            permissionName: "ChannelHubUpdate",
            action: () => undefined,
        };

        const actions = buildChannelHubTableActions({
            arrayAction: [updateAction],
            translate,
            handleRegister,
        });
        const registerAction = actions[1];

        expect(registerAction).toEqual(
            expect.objectContaining({
                name: "Register",
                permissionName: "ChannelHubUpdate",
                action: handleRegister,
                customizable: false,
            }),
        );
        expect(registerAction.show({ original: { channel_hub_connection_id: null } })).toBe(true);
        expect(registerAction.show({ original: { channel_hub_connection_id: "registered-id" } })).toBe(false);
    });
});
