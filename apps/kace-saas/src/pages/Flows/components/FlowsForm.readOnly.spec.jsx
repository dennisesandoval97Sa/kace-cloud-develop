import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FlowsForm } from "./FlowsForm";

vi.mock("@/services/cognitoService", () => ({ handlerLogout: vi.fn() }));

const validateSchema = vi.hoisted(() => vi.fn());

vi.mock("@kace/utils", async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        joiFormikAdapter: (schema) => {
            const adapter = actual.joiFormikAdapter(schema);
            return {
                ...adapter,
                validate: (values) => {
                    validateSchema(values);
                    return adapter.validate(values);
                },
            };
        },
    };
});

const STATE_NODES = [{ id: "state-1", type: "custom", position: { x: 0, y: 0 }, data: { label: "Abierto" } }];

const flowActions = vi.hoisted(() => ({
    handleFlow: vi.fn(),
    flow: { id: "6f1c2a7e-3b4d-4e5f-8a9b-0c1d2e3f4a5b", nombre: "Pagos", status: 1 },
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

const renderFlowsForm = (url) =>
    render(
        <MemoryRouter initialEntries={[url]}>
            <Routes>
                <Route path="/flujos/update/:id" element={<FlowsForm />} />
            </Routes>
        </MemoryRouter>,
    );

const submitForm = (container) => {
    validateSchema.mockClear();
    fireEvent.submit(container.querySelector("form"));
};

describe("FlowsForm with the real flow diagram", () => {
    beforeEach(() => {
        flowActions.handleFlow.mockClear();
        flowActions.nodes = [];
    });

    it("keeps the zoom and fit view controls usable and hides the interactivity toggle when viewing", () => {
        const { container } = renderFlowsForm("/flujos/update/flow-1?action=see");

        const controls = container.querySelector(".react-flow__controls");
        expect(controls).toBeInTheDocument();
        ["zoomin", "zoomout", "fitview"].forEach((name) =>
            expect(controls.querySelector(`.react-flow__controls-${name}`)).toBeEnabled(),
        );
        expect(controls.querySelector(".react-flow__controls-interactive")).not.toBeInTheDocument();
    });

    it("does not start the submission, not even its validation, when the form is submitted while viewing", () => {
        const { container } = renderFlowsForm("/flujos/update/flow-1?action=see");

        submitForm(container);

        expect(validateSchema).not.toHaveBeenCalled();
        expect(flowActions.handleFlow).not.toHaveBeenCalled();
    });

    it("validates and sends the update when the form is submitted while editing", async () => {
        const { container } = renderFlowsForm("/flujos/update/flow-1");

        submitForm(container);

        expect(validateSchema).toHaveBeenCalledOnce();
        await waitFor(() => expect(flowActions.handleFlow).toHaveBeenCalledOnce());
    });

    it("lets the diagram be panned from a node while viewing", () => {
        flowActions.nodes = STATE_NODES;
        renderFlowsForm("/flujos/update/flow-1?action=see");

        expect(screen.getByTestId("flows_form_node_abierto").closest(".nopan")).toBeNull();
    });

    it("keeps nodes draggable instead of panning while editing", () => {
        flowActions.nodes = STATE_NODES;
        renderFlowsForm("/flujos/update/flow-1");

        expect(screen.getByTestId("flows_form_node_abierto").closest(".nopan")).not.toBeNull();
    });
});
