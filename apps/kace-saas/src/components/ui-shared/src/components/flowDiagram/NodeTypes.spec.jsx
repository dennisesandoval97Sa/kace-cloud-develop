import { render } from "@testing-library/react";
import { ReactFlowProvider } from "reactflow";
import { describe, expect, it, vi } from "vitest";
import { ConditionalNode, CustomNode } from "./NodeTypes";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key) => key }) }));

const renderHandles = (Node, isConnectable) => {
    const { container } = render(
        <ReactFlowProvider>
            <Node id="1" data={{ label: "Estado" }} isConnectable={isConnectable} />
        </ReactFlowProvider>,
    );
    return [...container.querySelectorAll(".react-flow__handle")];
};

describe.each([
    ["CustomNode", CustomNode],
    ["ConditionalNode", ConditionalNode],
])("%s", (_, Node) => {
    it("does not accept connections when the diagram is not connectable", () => {
        const handles = renderHandles(Node, false);

        expect(handles.length).toBeGreaterThan(0);
        handles.forEach((handle) => expect(handle).not.toHaveClass("connectable"));
    });

    it("accepts connections when the diagram is connectable", () => {
        renderHandles(Node, true).forEach((handle) => expect(handle).toHaveClass("connectable"));
    });
});
