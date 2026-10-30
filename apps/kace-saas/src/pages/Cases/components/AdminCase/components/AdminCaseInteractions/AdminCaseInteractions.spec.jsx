import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminCaseInteractions from "./AdminCaseInteractions";
import useAdminInteractions from "./hooks/useAdminInteractions";

vi.mock("../../hooks/useAdminCaseParams", () => ({
    default: () => ({
        caseId: "case-1",
    }),
}));

vi.mock("./hooks/useAdminInteractions", () => ({
    default: vi.fn(() => ({
        interactions: [{ id: "interaction-1", description: "Solicitud relacionada" }],
        loadingInteractions: false,
    })),
}));

vi.mock("@/pages/Agent/components/Interactions/InteractionsList", () => ({
    default: ({ interactions, isLoading }) => (
        <div data-testid="interactions-list">
            {isLoading ? "loading" : interactions.map((interaction) => interaction.description).join(", ")}
        </div>
    ),
}));

describe("AdminCaseInteractions", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("searches related interactions using the current case id filter", () => {
        render(<AdminCaseInteractions isActive />);

        expect(useAdminInteractions).toHaveBeenCalledWith({
            caseId: "case-1",
            filter: [
                {
                    field: "caso_id",
                    operator: "eq",
                    value: "case-1",
                    type: "AND",
                },
            ],
            isActive: true,
        });
        expect(screen.getByTestId("interactions-list")).toHaveTextContent("Solicitud relacionada");
    });
});
