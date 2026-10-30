import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RestFlowsForm from "./RestFlowsForm";

vi.mock("@/services/cognitoService", () => ({ handlerLogout: vi.fn() }));

vi.stubGlobal(
    "IntersectionObserver",
    class {
        observe() {}
        unobserve() {}
        disconnect() {}
    },
);
vi.mock("@kace/hooks/useGenericSearchQuery", () => ({ default: () => ({ data: undefined }) }));
vi.mock("@/hooks/useGenericSearchInfiniteQuery", () => ({
    default: () => ({ data: [], isLoading: false, isFetchingNextPage: false, fetchNextPage: vi.fn() }),
}));
vi.mock("./EndpointDetailsModal", () => ({ default: () => null }));

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

const DATA = {
    id: "8a7b6c5d-4e3f-4a2b-9c1d-0e9f8a7b6c5d",
    description: "Consulta de pagos",
    external_code: "PAY",
    is_active: true,
};

const renderRestFlowsForm = (url, dataHandler = vi.fn()) =>
    render(
        <MemoryRouter initialEntries={[url]}>
            <Routes>
                <Route
                    path="/rest-flows/update/:id"
                    element={<RestFlowsForm dataHandler={dataHandler} data={DATA} />}
                />
            </Routes>
        </MemoryRouter>,
    );

const diagramIsReadOnly = () => flowDiagram.props.mock.lastCall[0].readOnly;

const descriptionField = (container) => container.querySelector('textarea[name="description"]');

const toolbarButtons = () => within(screen.getByTestId("restflow_form_node_toolbar")).getAllByRole("button");

const nodeSelectTriggers = () => toolbarButtons().filter((button) => button.hasAttribute("aria-expanded"));

describe("RestFlowsForm view mode", () => {
    beforeEach(() => flowDiagram.props.mockClear());

    it("leaves the diagram reachable but read only, and locks the fields and the node toolbar", async () => {
        const { container } = renderRestFlowsForm("/rest-flows/update/rest-flow-1?action=see");

        expect(screen.queryByTestId("form_card_see_mode_overlay")).not.toBeInTheDocument();
        expect(diagramIsReadOnly()).toBe(true);
        expect(descriptionField(container)).toBeDisabled();
        expect(screen.getByRole("switch")).toBeDisabled();
        expect(nodeSelectTriggers()).toHaveLength(2);
        toolbarButtons().forEach((button) => expect.soft(button).toBeDisabled());

        await userEvent.click(nodeSelectTriggers()[0]);
        expect(nodeSelectTriggers()[0]).toHaveAttribute("aria-expanded", "false");
    });

    it("keeps the diagram, the fields and the node toolbar editable when editing", async () => {
        const { container } = renderRestFlowsForm("/rest-flows/update/rest-flow-1");

        expect(diagramIsReadOnly()).toBe(false);
        expect(descriptionField(container)).toBeEnabled();
        expect(screen.getByRole("switch")).toBeEnabled();
        toolbarButtons().forEach((button) => expect.soft(button).toBeEnabled());

        await userEvent.click(nodeSelectTriggers()[0]);
        expect(nodeSelectTriggers()[0]).toHaveAttribute("aria-expanded", "true");
    });

    it("does not send the flow when it is submitted programmatically while viewing", async () => {
        const dataHandler = vi.fn();
        renderRestFlowsForm("/rest-flows/update/rest-flow-1?action=see", dataHandler);

        await act(() => flowDiagram.formik.submitForm());

        expect(dataHandler).not.toHaveBeenCalled();
    });
});
