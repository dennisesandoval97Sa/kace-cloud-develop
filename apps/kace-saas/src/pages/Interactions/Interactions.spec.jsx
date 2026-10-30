import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import usePermissionsUser from "@/hooks/usePermissionsUser";
import Interactions from "./Interactions";

const mocks = vi.hoisted(() => ({
    handlerActions: [],
}));

vi.mock("@/hooks/usePermissionsUser", () => ({
    default: vi.fn(),
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key) => key,
    }),
}));

vi.mock("./hooks/useInteractionActions", () => ({
    default: vi.fn(() => ({
        handleUpdateInteraction: vi.fn(),
        handleDeleteInteraction: vi.fn(),
        handleSeeInteraction: vi.fn(),
    })),
}));

vi.mock("../../components/core/Cards/DashboardSectionCard", () => ({
    DashboardSectionCard: vi.fn(({ title, children }) => (
        <section data-testid="dashboard-section-card" data-title={title}>
            {children}
        </section>
    )),
}));

vi.mock("./InteractionsHandler", () => ({
    default: vi.fn(({ actions }) => {
        mocks.handlerActions = actions;
        return <div data-testid="interactions-handler">Interactions table</div>;
    }),
}));

describe("Interactions", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.handlerActions = [];
    });

    it("renders the interactions table area for users with InteractionsRead", () => {
        const arrayAction = [
            { name: "Editar", action: vi.fn() },
            { name: "app.forms.delete", action: vi.fn() },
            { name: "app.forms.see", action: vi.fn() },
        ];
        usePermissionsUser.mockReturnValue({
            arrayAction,
        });

        render(<Interactions />);

        expect(screen.getByTestId("interactions-handler")).toBeInTheDocument();
        expect(mocks.handlerActions.map((action) => action.name)).toEqual([
            "Editar",
            "app.forms.delete",
            "app.forms.see",
        ]);
    });

    it("does not render the interactions table area without InteractionsRead", () => {
        usePermissionsUser.mockReturnValue({
            arrayAction: [{ name: "Editar", action: vi.fn() }],
        });

        render(<Interactions />);

        expect(screen.queryByTestId("interactions-handler")).not.toBeInTheDocument();
    });
});
