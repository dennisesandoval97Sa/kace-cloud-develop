import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FlowsForm } from "./FlowsForm";

vi.mock("@/services/cognitoService", () => ({ handlerLogout: vi.fn() }));

const flowActions = vi.hoisted(() => ({
    handleFlow: vi.fn(),
    flow: {
        id: "6f1c2a7e-3b4d-4e5f-8a9b-0c1d2e3f4a5b",
        nombre: "Pagos",
        status: 1,
        json_flujo: { nodes: [], edges: [] },
    },
    nodes: [],
    edges: [],
    ansList: [],
    rulesList: null,
    availableNodes: [],
    isUpdatePending: false,
    setNodes: () => {},
    setEdges: () => {},
}));

vi.mock("../hooks/useFlowActions", () => ({ default: () => flowActions }));

const formik = vi.hoisted(() => ({ current: null }));

vi.mock("@/components/ui-shared/src/components/flowDiagram/FlowDiagram", async () => {
    const { useFormikContext } = await import("formik");
    return {
        // eslint-disable-next-line react/prop-types
        FlowDiagram: ({ readOnly }) => {
            formik.current = useFormikContext();
            return (
                <div data-testid="flow-diagram" data-read-only={String(readOnly)}>
                    <button type="button">Zoom in</button>
                </div>
            );
        },
    };
});

const renderFlowsForm = (url) =>
    render(
        <MemoryRouter initialEntries={[url]}>
            <Routes>
                <Route path="/flujos/update/:id" element={<FlowsForm />} />
            </Routes>
        </MemoryRouter>,
    );

describe("FlowsForm", () => {
    beforeEach(() => flowActions.handleFlow.mockClear());

    it("keeps the diagram navigable but read only when viewing a flow", () => {
        renderFlowsForm("/flujos/update/flow-1?action=see");

        expect(screen.getByTestId("flow-diagram")).toHaveAttribute("data-read-only", "true");
        expect(screen.getByRole("button", { name: "Zoom in" })).toBeEnabled();
        expect(screen.getByTestId("flows_form_information_fields")).toBeDisabled();
        expect(screen.getByTestId("btn_form_card_update")).toBeDisabled();
    });

    it("keeps the diagram and fields editable when editing a flow", () => {
        renderFlowsForm("/flujos/update/flow-1");

        expect(screen.getByTestId("flow-diagram")).toHaveAttribute("data-read-only", "false");
        expect(screen.getByTestId("flows_form_information_fields")).toBeEnabled();
        expect(screen.getByTestId("btn_form_card_update")).toBeEnabled();
    });

    it("does not send the update when the form is submitted programmatically while viewing", async () => {
        renderFlowsForm("/flujos/update/flow-1?action=see");

        await act(() => formik.current.submitForm());

        expect(flowActions.handleFlow).not.toHaveBeenCalled();
    });

    it("sends the update when the form is submitted programmatically while editing", async () => {
        renderFlowsForm("/flujos/update/flow-1");

        await act(() => formik.current.submitForm());

        expect(flowActions.handleFlow).toHaveBeenCalledOnce();
    });
});
