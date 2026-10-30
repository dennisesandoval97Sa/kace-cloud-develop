import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import WorkspacesHandler from "./WorkspacesHandler";

const mocks = vi.hoisted(() => ({
    handleDeleteWorkspace: vi.fn(),
    handleRegisterTags: vi.fn(),
    handleSeeWorkspace: vi.fn(),
    handleUpdateWorkspace: vi.fn(),
    latestArrayAction: [],
    permissionsAdmin: [
        { module_id: "workspaces", name: "WorkspacesUpdate", granted: true },
        { module_id: "workspaces", name: "WorkspacesRead", granted: true },
        { module_id: "workspaces", name: "WorkspacesDelete", granted: true },
        { module_id: "workspaces", name: "WorkspacesCreate", granted: true },
    ],
}));

vi.mock("./hooks/useActionsWorkspace", () => ({
    default: () => ({
        handleDeleteWorkspace: mocks.handleDeleteWorkspace,
        handleRegisterTags: mocks.handleRegisterTags,
        handleSeeWorkspace: mocks.handleSeeWorkspace,
        handleUpdateWorkspace: mocks.handleUpdateWorkspace,
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
                "app.forms.update": "Editar",
                "app.forms.delete": "Eliminar",
                "app.forms.see": "Ver",
                "workspace.actions.registerTags": "Register Tags",
            })[key] ?? key,
        // usePermissionsUser reordena las acciones al cambiar de idioma y lee i18n.language.
        i18n: { language: "es" },
    }),
}));

vi.mock("@/components/core/DefaultIndexActions/DefaultIndexActions", () => ({
    default: () => <div data-testid="default-index-actions" />,
}));

vi.mock("./components/WorkspaceTableContainer", () => ({
    WorkspaceTableContainer: ({ arrayAction }) => {
        mocks.latestArrayAction = arrayAction;
        return <div data-testid="workspace-table" />;
    },
}));

describe("WorkspacesHandler", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.latestArrayAction = [];
        mocks.permissionsAdmin = [
            { module_id: "workspaces", name: "WorkspacesUpdate", granted: true },
            { module_id: "workspaces", name: "WorkspacesRead", granted: true },
            { module_id: "workspaces", name: "WorkspacesDelete", granted: true },
            { module_id: "workspaces", name: "WorkspacesCreate", granted: true },
        ];
    });

    it("adds Register Tags as a Workspaces row action when the user can update workspaces", async () => {
        render(<WorkspacesHandler />);

        await waitFor(() => {
            expect(mocks.latestArrayAction.map((action) => action.name)).toContain("Register Tags");
        });

        const registerTagsAction = mocks.latestArrayAction.find((action) => action.name === "Register Tags");

        expect(registerTagsAction.action).toBe(mocks.handleRegisterTags);
        expect(registerTagsAction.show({ original: { tag_creation_flow_id: "flow-id", rules: {} } })).toBe(true);
        expect(registerTagsAction.show({ original: { tag_creation_flow_id: null, rules: {} } })).toBe(false);
        expect(
            registerTagsAction.show({
                original: {
                    tag_creation_flow_id: "flow-id",
                    rules: { ruleId: "3EJTuLucMyGCOmCcJehd6yT9Ywk" },
                },
            }),
        ).toBe(false);
        expect(
            registerTagsAction.show({
                original: {
                    tag_creation_flow_id: "flow-id",
                    rules: { ruleId: "   " },
                },
            }),
        ).toBe(true);
        expect(
            registerTagsAction.show({
                original: {
                    tag_creation_flow_id: "flow-id",
                    rules: { ruleId: 123 },
                },
            }),
        ).toBe(false);
    });

    it("does not add Register Tags when WorkspacesUpdate is missing", async () => {
        mocks.permissionsAdmin = [
            { module_id: "workspaces", name: "WorkspacesRead", granted: true },
            { module_id: "workspaces", name: "WorkspacesDelete", granted: true },
            { module_id: "workspaces", name: "WorkspacesCreate", granted: true },
        ];

        render(<WorkspacesHandler />);

        await waitFor(() => {
            expect(mocks.latestArrayAction.map((action) => action.name)).toContain("Ver");
        });

        expect(mocks.latestArrayAction.map((action) => action.name)).not.toContain("Register Tags");
    });
});
