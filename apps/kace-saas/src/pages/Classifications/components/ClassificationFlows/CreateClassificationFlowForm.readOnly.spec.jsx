import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CreateClassificationFlowForm from "./CreateClassificationFlowForm";

vi.mock("@/services/cognitoService", () => ({ handlerLogout: vi.fn() }));

vi.stubGlobal(
    "IntersectionObserver",
    class {
        observe() {}
        unobserve() {}
        disconnect() {}
    },
);
vi.mock("@/hooks/useGenericSearchInfiniteQuery", () => ({
    default: () => ({ data: [], isLoading: false, isFetchingNextPage: false, fetchNextPage: vi.fn() }),
}));

const flowDiagram = vi.hoisted(() => ({ props: vi.fn(), formik: null }));

vi.mock("@/components/ui-shared/src/components/flowDiagram/FlowDiagram", async () => {
    const { useFormikContext } = await import("formik");
    return {
        FlowDiagram: (props) => {
            flowDiagram.props(props);
            flowDiagram.formik = useFormikContext();
            return <div data-testid="flow-diagram" />;
        },
    };
});

const CLASSIFICATION_ID = "classification-1";

const DATA = {
    id: CLASSIFICATION_ID,
    description: "Reclamos",
    json_flujo: {
        nodes: [
            { id: "0", type: "input", position: { x: 0, y: 0 }, data: { label: "inicio" } },
            {
                id: CLASSIFICATION_ID,
                position: { x: 0, y: 100 },
                data: { id: CLASSIFICATION_ID, label: "Reclamos", type: "primary" },
            },
        ],
        edges: [{ id: "edge-0-primary", source: "0", target: CLASSIFICATION_ID }],
    },
};

const renderClassificationFlowForm = async (url, dataHandler = vi.fn()) => {
    render(
        <MemoryRouter initialEntries={[url]}>
            <Routes>
                <Route
                    path="/clasificaciones/flujo/update/:id"
                    element={<CreateClassificationFlowForm dataHandler={dataHandler} data={DATA} />}
                />
            </Routes>
        </MemoryRouter>,
    );
    await screen.findByTestId("flow-diagram");
};

const diagramIsReadOnly = () => flowDiagram.props.mock.lastCall[0].readOnly;

const subclassificationTrigger = () => screen.getByRole("button", { expanded: false });

describe("CreateClassificationFlowForm view mode", () => {
    beforeEach(() => flowDiagram.props.mockClear());

    it("leaves the diagram reachable but read only, and locks the node toolbar", async () => {
        await renderClassificationFlowForm(`/clasificaciones/flujo/update/${CLASSIFICATION_ID}?action=see`);

        expect(diagramIsReadOnly()).toBe(true);
        expect(screen.queryByTestId("form_card_see_mode_overlay")).not.toBeInTheDocument();
        expect(screen.getByTestId("classification_flow_form_node_toolbar")).toBeDisabled();

        const trigger = subclassificationTrigger();
        expect(trigger).toBeDisabled();
        await userEvent.click(trigger);
        expect(trigger).toHaveAttribute("aria-expanded", "false");
    });

    it("keeps the diagram and the node toolbar editable when editing", async () => {
        await renderClassificationFlowForm(`/clasificaciones/flujo/update/${CLASSIFICATION_ID}`);

        expect(diagramIsReadOnly()).toBe(false);
        const trigger = subclassificationTrigger();
        expect(trigger).toBeEnabled();
        await userEvent.click(trigger);
        expect(trigger).toHaveAttribute("aria-expanded", "true");
    });

    it("does not send the flow when it is submitted programmatically while viewing", async () => {
        const dataHandler = vi.fn();
        await renderClassificationFlowForm(
            `/clasificaciones/flujo/update/${CLASSIFICATION_ID}?action=see`,
            dataHandler,
        );

        await act(() => flowDiagram.formik.submitForm());

        expect(dataHandler).not.toHaveBeenCalled();
    });

    it("sends the flow when it is submitted programmatically while editing", async () => {
        const dataHandler = vi.fn();
        await renderClassificationFlowForm(`/clasificaciones/flujo/update/${CLASSIFICATION_ID}`, dataHandler);

        await act(() => flowDiagram.formik.submitForm());

        expect(dataHandler).toHaveBeenCalledOnce();
    });
});
