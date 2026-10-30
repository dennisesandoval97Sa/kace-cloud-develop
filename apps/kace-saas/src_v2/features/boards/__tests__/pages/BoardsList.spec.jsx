import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import BoardsList from "@kace_v2/features/boards/pages/BoardsList";
import usePermissionsUser from "@kace/hooks/usePermissionsUser";
import useBoardsListActions from "@kace_v2/features/boards/hooks/useBoardsListActions.hook";
import { MODULES } from "@kace_v2/shared/constants/modules.contants";

vi.mock("@kace/hooks/usePermissionsUser", () => ({ default: vi.fn() }));
vi.mock("@kace_v2/features/boards/hooks/useBoardsListActions.hook", () => ({
    default: vi.fn(),
}));
vi.mock("@kace_v2/features/boards/components/BoardsTableContainer", () => ({
    default: () => <div data-testid="boards-table" />,
}));
vi.mock("@/components/core/DefaultIndexActions/DefaultIndexActions", () => ({
    default: ({ createUrl }) => <div data-testid="default-index-actions" data-create-url={createUrl} />,
}));
vi.mock("@/components/core/Cards/DashboardSectionCard", () => ({
    DashboardSectionCard: ({ children }) => <div>{children}</div>,
}));
vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

const handlers = {
    handleSeeBoard: vi.fn(),
    handleUpdateBoard: vi.fn(),
    handleDeleteBoard: vi.fn(),
    handleDownloadBoard: vi.fn(),
};

describe("BoardsList", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useBoardsListActions.mockReturnValue(handlers);
        usePermissionsUser.mockReturnValue({ arrayAction: [], canBeCreate: false });
    });

    it("no muestra el alta si no hay permiso de creacion", () => {
        render(<BoardsList />);
        expect(screen.queryByTestId("default-index-actions")).toBeNull();
    });

    it("muestra el alta hacia /boards/create cuando hay permiso", () => {
        usePermissionsUser.mockReturnValue({ arrayAction: [], canBeCreate: true });
        render(<BoardsList />);
        expect(screen.getByTestId("default-index-actions")).toHaveAttribute(
            "data-create-url",
            MODULES.BOARDS.ROUTES.CREATE,
        );
    });

    it("pide a usePermissionsUser el modulo boards y las cuatro acciones de fila", () => {
        render(<BoardsList />);
        expect(usePermissionsUser).toHaveBeenCalledWith({
            moduleId: MODULES.BOARDS.ID,
            nameCreate: MODULES.BOARDS.PERMISSIONS.CREATE,
            actions: [
                expect.objectContaining({
                    name: MODULES.BOARDS.PERMISSIONS.READ,
                    handler: handlers.handleSeeBoard,
                }),
                expect.objectContaining({
                    name: MODULES.BOARDS.PERMISSIONS.UPDATE,
                    handler: handlers.handleUpdateBoard,
                }),
                expect.objectContaining({
                    name: MODULES.BOARDS.PERMISSIONS.EXPORT,
                    handler: handlers.handleDownloadBoard,
                }),
                expect.objectContaining({
                    name: MODULES.BOARDS.PERMISSIONS.DELETE,
                    handler: handlers.handleDeleteBoard,
                }),
            ],
        });
    });
});
