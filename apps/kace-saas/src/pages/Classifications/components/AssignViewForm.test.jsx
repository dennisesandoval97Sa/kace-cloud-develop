/* eslint-disable react/prop-types */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import AssignViewForm from "./AssignViewForm";
import useRelationshipTable from "../hooks/useRelationshipTable";

let formSelectProps;

const GROUPS = [
    { id: "group-1", label: "Grupo 1", value: "group-1" },
    { id: "group-2", label: "Grupo 2", value: "group-2" },
];

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

vi.mock("sonner", () => ({ toast: { warning: vi.fn() } }));

vi.mock("@kace/utils", () => ({ joiFormikAdapter: () => undefined }));

vi.mock("../../../schemas/ClassificationRelationsSchema", () => ({ ClassificationRelationsForm: {} }));

vi.mock("../../../components/core/Cards/FormCard", () => ({ default: ({ children }) => <div>{children}</div> }));

vi.mock("../../../components/core/Cards/InputCard", () => ({ default: ({ children }) => <div>{children}</div> }));

vi.mock("../../../components/core/Cards/section-form", () => ({ default: ({ children }) => <div>{children}</div> }));

vi.mock("../../../components/core/FormOneScript/FormOneScript", () => ({ FormOneScript: () => null }));

vi.mock("../../../services/genericView", () => ({ genericView: vi.fn() }));

vi.mock("@/components/ui-shared", () => ({
    Button: ({ children, ...props }) => <button {...props}>{children}</button>,
    ScrollArea: ({ children }) => <div>{children}</div>,
    SelectByProvider: (props) => {
        formSelectProps = props;
        return null;
    },
    Dialog: ({ open, onOpenChange, children }) =>
        open ? (
            <div role="dialog">
                <button type="button" onClick={() => onOpenChange(false)}>
                    close-dialog
                </button>
                {children}
            </div>
        ) : null,
    DialogContent: ({ children }) => <div>{children}</div>,
    DialogHeader: ({ children }) => <div>{children}</div>,
    DialogTitle: ({ children }) => <div>{children}</div>,
    DialogDescription: ({ children }) => <div>{children}</div>,
    DialogFooter: ({ children }) => <div>{children}</div>,
}));

vi.mock("./ViewsTableContainer", () => ({
    ViewsTableContainer: ({ pendingData, onRemovePending }) => (
        <ul data-testid="pending-groups">
            {pendingData.map((row) => (
                <li key={row.id} data-form-name={row.one_script.nombre}>
                    {row.group.nombre}
                    <button type="button" onClick={() => onRemovePending(row.group_id)}>
                        {`remove-${row.group_id}`}
                    </button>
                </li>
            ))}
        </ul>
    ),
}));

vi.mock("@/componentsV2/core/MultiSelect", () => ({
    default: ({ options, selectedData, onSelectOption, onInputChange }) => (
        <div>
            <input data-testid="groups-search" onChange={(event) => onInputChange(event.target.value)} />
            {options.map((option) => (
                <button key={option.id} type="button" onClick={() => onSelectOption(option.id)}>
                    {`option-${option.id}`}
                </button>
            ))}
            <span data-testid="selected-groups">{selectedData.map((group) => group.id).join(",")}</span>
        </div>
    ),
}));

let savedRelationships = [];

vi.mock("../hooks/useRelationshipTable", () => ({
    default: vi.fn(() => ({ dataTable: { data: savedRelationships } })),
}));

const groupsQueryFilters = [];
const groupsQuerySelects = [];

vi.mock("@/hooks/useGenericSearchInfiniteQuery", () => ({
    default: ({ filter, select }) => {
        groupsQueryFilters.push(filter);
        groupsQuerySelects.push(select);
        return {
            data: GROUPS,
            isLoading: false,
            isFetchingNextPage: false,
            hasNextPage: false,
            fetchNextPage: vi.fn(),
        };
    },
}));

vi.mock("@kace_v2/shared/hooks/useOneScriptIframeHandshake", () => ({ useOneScriptIframeHandshake: vi.fn() }));

vi.mock("@kace_v2/shared/hooks/useOneScriptHandshakeConfig", () => ({
    useOneScriptHandshakeConfig: () => ({ baseParams: {}, handshakeTokens: {} }),
}));

const openModal = () => fireEvent.click(screen.getByText("classification.form.button.addGroup"));
const clickOption = (id) => fireEvent.click(screen.getByText(`option-${id}`));
const selectedGroupIds = () => screen.getByTestId("selected-groups").textContent;
const pendingGroupNames = () =>
    [...screen.getByTestId("pending-groups").querySelectorAll("li")].map((li) => li.firstChild.textContent).join(",");
const searchGroups = (text) => fireEvent.change(screen.getByTestId("groups-search"), { target: { value: text } });
const currentGroupsFilter = () => groupsQueryFilters.at(-1);
const DEBOUNCE_MS = 600;

describe("AssignViewForm - modal Agregar grupo a la clasificación", () => {
    beforeEach(() => {
        render(<AssignViewForm dataHandler={vi.fn()} />);
        openModal();
    });

    it("quita un grupo ya seleccionado al volver a elegirlo", () => {
        clickOption("group-1");
        clickOption("group-2");
        clickOption("group-1");

        expect(selectedGroupIds()).toBe("group-2");
    });

    it("descarta la selección al cancelar sin guardar", () => {
        clickOption("group-1");
        fireEvent.click(screen.getByText("button.cancel"));
        openModal();

        expect(selectedGroupIds()).toBe("");
        expect(pendingGroupNames()).toBe("");
    });

    it("descarta la selección al cerrar el modal sin guardar", () => {
        clickOption("group-1");
        fireEvent.click(screen.getByText("close-dialog"));
        openModal();

        expect(selectedGroupIds()).toBe("");
    });

    it("al reabrir tras cancelar conserva solo los grupos guardados", () => {
        clickOption("group-1");
        fireEvent.click(screen.getByText("button.save"));
        openModal();
        clickOption("group-2");
        fireEvent.click(screen.getByText("button.cancel"));
        openModal();

        expect(selectedGroupIds()).toBe("group-1");
        expect(pendingGroupNames()).toBe("Grupo 1");
    });

    it("guarda la selección sin los grupos removidos", () => {
        clickOption("group-1");
        clickOption("group-2");
        clickOption("group-1");
        fireEvent.click(screen.getByText("button.save"));

        expect(pendingGroupNames()).toBe("Grupo 2");
    });

    it("retirar un grupo pendiente lo quita de la tabla y de la selección del modal", () => {
        clickOption("group-1");
        clickOption("group-2");
        fireEvent.click(screen.getByText("button.save"));
        fireEvent.click(screen.getByText("remove-group-1"));
        openModal();

        expect(pendingGroupNames()).toBe("Grupo 2");
        expect(selectedGroupIds()).toBe("group-2");
    });
});

describe("AssignViewForm - grupos ya relacionados con la clasificación", () => {
    const dataHandler = vi.fn();

    beforeEach(() => {
        dataHandler.mockClear();
        savedRelationships = [{ group_id: "group-2" }];
        render(<AssignViewForm dataHandler={dataHandler} idClassification="classification-1" />);
        openModal();
    });

    afterEach(() => {
        savedRelationships = [];
    });

    it("consulta las relaciones guardadas de la clasificación editada", () => {
        expect(useRelationshipTable).toHaveBeenCalledWith("classification-1");
    });

    it("un grupo ya relacionado no se agrega como pendiente ni se envía al guardar", async () => {
        clickOption("group-1");
        clickOption("group-2");
        fireEvent.click(screen.getByText("button.save"));

        expect(pendingGroupNames()).toBe("Grupo 1");

        fireEvent.submit(screen.getByTestId("formClassification"));

        await waitFor(() => expect(dataHandler).toHaveBeenCalledTimes(1));
        expect(dataHandler.mock.calls[0][1].map((group) => group.id)).toEqual(["group-1"]);
    });

    it("si solo se eligieron grupos ya relacionados, avisa y no envía", async () => {
        clickOption("group-2");
        fireEvent.click(screen.getByText("button.save"));
        fireEvent.submit(screen.getByTestId("formClassification"));

        await waitFor(() => expect(toast.warning).toHaveBeenCalledWith("app.alerts.selectGroup"));
        expect(dataHandler).not.toHaveBeenCalled();
    });
});

describe("AssignViewForm - búsqueda del modal Agregar grupo", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        groupsQueryFilters.length = 0;
        render(<AssignViewForm dataHandler={vi.fn()} />);
        openModal();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("filtra los grupos por el texto buscado", () => {
        searchGroups("soporte");
        act(() => vi.advanceTimersByTime(DEBOUNCE_MS));

        expect(currentGroupsFilter()).toEqual([{ field: "nombre", operator: "ilike", type: "AND", value: "soporte" }]);
    });

    it("al reabrir tras cerrar descarta la búsqueda anterior", () => {
        searchGroups("soporte");
        act(() => vi.advanceTimersByTime(DEBOUNCE_MS));
        fireEvent.click(screen.getByText("close-dialog"));
        openModal();

        expect(currentGroupsFilter()).toEqual([]);
    });

    it("una búsqueda pendiente al cerrar no filtra el modal reabierto", () => {
        searchGroups("soporte");
        fireEvent.click(screen.getByText("button.cancel"));
        openModal();
        act(() => vi.advanceTimersByTime(DEBOUNCE_MS));

        expect(currentGroupsFilter()).toEqual([]);
    });

    it.each(["button.cancel", "close-dialog", "button.save"])(
        "al cerrar con %s descarta la búsqueda pendiente sin esperar a reabrir",
        (closeControl) => {
            searchGroups("soporte");
            fireEvent.click(screen.getByText(closeControl));
            act(() => vi.advanceTimersByTime(DEBOUNCE_MS));

            expect(currentGroupsFilter()).toEqual([]);
        },
    );

    it.each(["button.cancel", "close-dialog", "button.save"])(
        "al cerrar con %s limpia la búsqueda ya aplicada",
        (closeControl) => {
            searchGroups("soporte");
            act(() => vi.advanceTimersByTime(DEBOUNCE_MS));
            fireEvent.click(screen.getByText(closeControl));

            expect(currentGroupsFilter()).toEqual([]);
        },
    );
});

describe("AssignViewForm - selector de la consulta de grupos", () => {
    beforeEach(() => {
        groupsQuerySelects.length = 0;
        render(<AssignViewForm dataHandler={vi.fn()} />);
    });

    it("pasa el mismo selector en todos los renders", () => {
        openModal();
        clickOption("group-1");

        expect(groupsQuerySelects.length).toBeGreaterThan(1);
        expect(new Set(groupsQuerySelects).size).toBe(1);
    });

    it("convierte las páginas en opciones y descarta registros incompletos", () => {
        const select = groupsQuerySelects.at(-1);
        const pages = [
            { data: [{ id: "g1", nombre: "Soporte" }, { id: "g2" }] },
            { data: [null, { id: "g3", nombre: "Ventas" }] },
        ];

        expect(select({ pages })).toEqual([
            { id: "g1", label: "Soporte", value: "g1" },
            { id: "g3", label: "Ventas", value: "g3" },
        ]);
        expect(select(undefined)).toEqual([]);
    });
});

describe("AssignViewForm - selector de Formulario", () => {
    beforeEach(() => {
        formSelectProps = undefined;
        render(<AssignViewForm dataHandler={vi.fn()} />);
    });

    it("habilita la búsqueda por texto", () => {
        expect(formSelectProps.enableSearch).toBe(true);
    });

    // Select re-emits the same value once the closed dropdown has reloaded the unfiltered list.
    it("conserva el nombre del formulario elegido aunque la lista se recargue sin él", () => {
        act(() => {
            formSelectProps.processData({ data: [{ id: "form-1", name: "Formulario buscado" }] });
            formSelectProps.onChange("form-1");
        });
        act(() => {
            formSelectProps.processData({ data: [{ id: "form-2", name: "Otro formulario" }] });
            formSelectProps.onChange("form-1");
        });
        openModal();
        clickOption("group-1");
        fireEvent.click(screen.getByText("button.save"));

        expect(screen.getByText("Grupo 1").dataset.formName).toBe("Formulario buscado");
    });

    it("actualiza el nombre al cambiar a otro formulario", () => {
        act(() => {
            formSelectProps.processData({
                data: [
                    { id: "form-1", name: "Formulario buscado" },
                    { id: "form-2", name: "Otro formulario" },
                ],
            });
            formSelectProps.onChange("form-1");
        });
        act(() => formSelectProps.onChange("form-2"));
        openModal();
        clickOption("group-1");
        fireEvent.click(screen.getByText("button.save"));

        expect(screen.getByText("Grupo 1").dataset.formName).toBe("Otro formulario");
    });
});
