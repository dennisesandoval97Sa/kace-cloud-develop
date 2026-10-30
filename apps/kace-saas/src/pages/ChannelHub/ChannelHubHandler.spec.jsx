import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ChannelHubHandler from "./ChannelHubHandler";

const mocks = vi.hoisted(() => ({
    handleDelete: vi.fn(),
    handleRegister: vi.fn(),
    handleSee: vi.fn(),
    handleUpdate: vi.fn(),
    latestArrayAction: [],
    permissionsAdmin: [],
}));

vi.mock("./hooks/useActionsChannelHub", () => ({
    default: () => ({
        handleDelete: mocks.handleDelete,
        handleRegister: mocks.handleRegister,
        handleSee: mocks.handleSee,
        handleUpdate: mocks.handleUpdate,
    }),
}));

vi.mock("@/hooks/useUserInformation", () => ({
    default: () => ({
        permissionsAdmin: mocks.permissionsAdmin,
    }),
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key) =>
            ({
                "app.forms.delete": "Eliminar",
                "app.forms.edit": "Editar",
                "app.forms.see": "Ver",
                "channelHub.register": "Register",
            })[key] ?? key,
        // usePermissionsUser reordena las acciones al cambiar de idioma y lee i18n.language.
        i18n: { language: "es" },
    }),
}));

vi.mock("@/components/core/DefaultIndexActions/DefaultIndexActions", () => ({
    default: () => <div data-testid="default-index-actions" />,
}));

vi.mock("@/config/routesDictionary", () => ({
    ROUTES: {
        CHANNEL_HUB_CREATE: {
            path: "/channel-hub/create",
        },
    },
}));

vi.mock("./components/channel-hub-table-container", () => ({
    ChannelHubTableContainer: ({ arrayAction }) => {
        mocks.latestArrayAction = arrayAction;
        return <div data-testid="channel-hub-table" />;
    },
}));

const setChannelHubPermissions = (...names) => {
    mocks.permissionsAdmin = names.map((name) => ({
        module_id: "channel-hub",
        name,
        granted: true,
    }));
};

describe("ChannelHubHandler", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.latestArrayAction = [];
        mocks.permissionsAdmin = [];
    });

    it("does not add Register as a row action for read-only Channel Hub users", async () => {
        setChannelHubPermissions("ChannelHubRead");

        render(<ChannelHubHandler />);

        await waitFor(() => {
            expect(mocks.latestArrayAction.map((action) => action.name)).toContain("Ver");
        });

        expect(mocks.latestArrayAction.map((action) => action.name)).not.toContain("Register");
    });

    it("adds Register as a ChannelHubUpdate-gated row action for update-capable users", async () => {
        setChannelHubPermissions("ChannelHubRead", "ChannelHubUpdate");

        render(<ChannelHubHandler />);

        await waitFor(() => {
            expect(mocks.latestArrayAction.map((action) => action.name)).toContain("Register");
        });

        const registerAction = mocks.latestArrayAction.find((action) => action.name === "Register");

        expect(registerAction.permissionName).toBe("ChannelHubUpdate");
        expect(registerAction.action).toBe(mocks.handleRegister);
        expect(registerAction.show({ original: { channel_hub_connection_id: null } })).toBe(true);
        expect(registerAction.show({ original: { channel_hub_connection_id: "registered-id" } })).toBe(false);
    });
});
