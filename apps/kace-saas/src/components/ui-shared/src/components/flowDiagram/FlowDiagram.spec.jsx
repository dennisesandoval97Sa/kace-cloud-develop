import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FlowDiagram } from "./FlowDiagram";

const reactFlowProps = vi.fn();
const controlsProps = vi.fn();

vi.mock("reactflow", () => ({
    default: (props) => {
        reactFlowProps(props);
        return (
            <div data-testid="react-flow">
                {props.nodes.map(({ id, type, data }) => {
                    const Node = props.nodeTypes[type];
                    return Node && <Node key={id} id={id} data={data} isConnectable />;
                })}
                {props.children}
            </div>
        );
    },
    Background: () => null,
    Controls: (props) => {
        controlsProps(props);
        return null;
    },
    MiniMap: () => null,
    Handle: () => null,
    Position: { Top: "top", Left: "left", Right: "right" },
    applyNodeChanges: vi.fn(),
    addEdge: vi.fn(),
    updateEdge: vi.fn(),
}));

vi.mock("formik", () => ({ useFormikContext: () => ({ setFieldValue: vi.fn() }) }));

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key) => key }) }));

const NO_NODES = [];
const NO_EDGES = [];

const diagram = (props = {}) => (
    <FlowDiagram availableNodes={NO_NODES} initialNodes={NO_NODES} initialEdges={NO_EDGES} {...props} />
);

const renderDiagram = (props = {}) => render(diagram(props));

const lastReactFlowProps = () => reactFlowProps.mock.lastCall[0];

const nodesOfType = (type) => [{ id: "node-1", type, position: { x: 0, y: 0 }, data: { label: "Estado" } }];

const dropOnDiagram = (payload) =>
    fireEvent.drop(screen.getByTestId("flows_form_diagram_container"), {
        dataTransfer: { getData: () => payload, dropEffect: "" },
        clientX: 10,
        clientY: 10,
    });

describe("FlowDiagram", () => {
    beforeEach(() => {
        reactFlowProps.mockClear();
        controlsProps.mockClear();
    });

    it("blocks editing but keeps panning and zooming when read only", () => {
        renderDiagram({ readOnly: true });

        expect(lastReactFlowProps()).toMatchObject({
            nodesDraggable: false,
            nodesConnectable: false,
            elementsSelectable: false,
            edgesUpdatable: false,
            deleteKeyCode: null,
            zoomOnScroll: true,
        });
        expect(lastReactFlowProps().onNodeContextMenu).toBeUndefined();
        expect(lastReactFlowProps().onConnect).toBeUndefined();
        expect(screen.queryByText("app.flowDiagram.selectTransition")).not.toBeInTheDocument();
    });

    it("does not select or highlight edges when read only", () => {
        renderDiagram({ readOnly: true });

        expect(lastReactFlowProps().onEdgeClick).toBeUndefined();
        expect(lastReactFlowProps().onPaneClick).toBeUndefined();
    });

    it("hides the interactivity toggle of the controls when read only", () => {
        renderDiagram({ readOnly: true });

        expect(controlsProps.mock.lastCall[0].showInteractive).toBe(false);
    });

    it.each(["custom", "conditional"])("renders %s nodes without a delete button when read only", (type) => {
        renderDiagram({ readOnly: true, initialNodes: nodesOfType(type), externalUpdateNodes: vi.fn() });

        expect(screen.getByText("Estado")).toBeInTheDocument();
        expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("keeps the same node types when switching between read only and editing", () => {
        const props = { initialNodes: nodesOfType("custom"), externalUpdateNodes: vi.fn() };
        const { rerender } = renderDiagram(props);
        const editingNodeTypes = lastReactFlowProps().nodeTypes;
        expect(screen.getByRole("button")).toBeInTheDocument();

        rerender(diagram({ ...props, readOnly: true }));
        expect(lastReactFlowProps().nodeTypes).toBe(editingNodeTypes);
        expect(screen.queryByRole("button")).not.toBeInTheDocument();

        rerender(diagram(props));
        expect(lastReactFlowProps().nodeTypes).toBe(editingNodeTypes);
        expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("deletes a node through the node updater of the latest render", () => {
        const initialNodes = nodesOfType("custom");
        const firstUpdateNodes = vi.fn();
        const latestUpdateNodes = vi.fn();
        const externalUpdateEdges = vi.fn();
        const { rerender } = renderDiagram({
            initialNodes,
            externalUpdateNodes: firstUpdateNodes,
            externalUpdateEdges,
        });
        rerender(diagram({ initialNodes, externalUpdateNodes: latestUpdateNodes, externalUpdateEdges }));
        firstUpdateNodes.mockClear();
        latestUpdateNodes.mockClear();

        fireEvent.click(screen.getByRole("button"));

        expect(firstUpdateNodes).not.toHaveBeenCalled();
        const [removeNode] = latestUpdateNodes.mock.lastCall;
        expect(removeNode([{ id: "node-1" }, { id: "node-2" }])).toEqual([{ id: "node-2" }]);
    });

    it("ignores a node dropped on the diagram when read only", () => {
        const externalUpdateNodes = vi.fn();
        renderDiagram({ readOnly: true, externalUpdateNodes });
        externalUpdateNodes.mockClear();

        dropOnDiagram(JSON.stringify({ nodeName: "Abierto", nodeId: "state-1" }));

        expect(externalUpdateNodes).not.toHaveBeenCalled();
    });

    it.each([
        ["an empty", ""],
        ["a non JSON", "Abierto"],
    ])("ignores a drop with %s node payload instead of throwing", (_, payload) => {
        const externalUpdateNodes = vi.fn();
        renderDiagram({ externalUpdateNodes });
        externalUpdateNodes.mockClear();

        const uncaughtErrors = [];
        const captureError = (event) => {
            uncaughtErrors.push(event.error);
            event.preventDefault();
        };
        window.addEventListener("error", captureError);

        try {
            dropOnDiagram(payload);
        } finally {
            window.removeEventListener("error", captureError);
        }

        expect(uncaughtErrors).toEqual([]);
        expect(externalUpdateNodes).not.toHaveBeenCalled();
    });

    it("adds a node dropped on the diagram when editing", () => {
        const externalUpdateNodes = vi.fn();
        renderDiagram({ externalUpdateNodes });
        externalUpdateNodes.mockClear();

        dropOnDiagram(JSON.stringify({ nodeName: "Abierto", nodeId: "state-1" }));

        const [addNode] = externalUpdateNodes.mock.lastCall;
        expect(addNode([])).toEqual([expect.objectContaining({ id: "state-1", data: { label: "Abierto" } })]);
    });

    it("allows editing by default", () => {
        renderDiagram();

        expect(lastReactFlowProps()).toMatchObject({
            nodesDraggable: true,
            nodesConnectable: true,
            elementsSelectable: true,
            edgesUpdatable: true,
        });
        expect(lastReactFlowProps().onNodeContextMenu).toEqual(expect.any(Function));
        expect(lastReactFlowProps().onConnect).toEqual(expect.any(Function));
        expect(lastReactFlowProps().onEdgeClick).toEqual(expect.any(Function));
        expect(controlsProps.mock.lastCall[0].showInteractive).toBe(true);
    });

    it.each(["custom", "conditional"])("lets %s nodes be deleted when editing", (type) => {
        const externalUpdateNodes = vi.fn();
        renderDiagram({ initialNodes: nodesOfType(type), externalUpdateNodes, externalUpdateEdges: vi.fn() });
        externalUpdateNodes.mockClear();

        fireEvent.click(screen.getByRole("button"));

        const [removeNode] = externalUpdateNodes.mock.lastCall;
        expect(removeNode([{ id: "node-1" }, { id: "node-2" }])).toEqual([{ id: "node-2" }]);
    });
});
