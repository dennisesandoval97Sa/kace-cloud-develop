import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ViewsTableContainer } from "./ViewsTableContainer";

const handleDeleteGroup = vi.fn();
const relationshipTable = { headers: [], dataTable: { data: [{ group_id: "saved-group" }] } };
let deleteAction;
let tableProps;

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

vi.mock("@kace/ui-shared", () => ({
    createColumns: (headers, n, links, actions) => {
        deleteAction = actions[0].action;
        return [];
    },
}));

vi.mock("../hooks/useRelationshipTable", () => ({
    default: () => relationshipTable,
}));

vi.mock("../hooks/useRelationshipAction", () => ({
    default: () => ({ handleDeleteGroup, deleteGroupLoading: false }),
}));

vi.mock("../../../components/ui-shared/src/components/table-component/DataTableContainer", () => ({
    DataTableContainer: (props) => {
        tableProps = props;
        return null;
    },
}));

const renderTable = (props = {}) =>
    render(
        <ViewsTableContainer
            id="classification-1"
            pendingData={[{ group_id: "pending-group" }]}
            onRemovePending={vi.fn()}
            {...props}
        />,
    );

describe("ViewsTableContainer - eliminar relación", () => {
    const onRemovePending = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        renderTable({ onRemovePending });
    });

    it("un grupo pendiente se retira localmente sin llamar al backend", () => {
        deleteAction("pending-group");

        expect(onRemovePending).toHaveBeenCalledWith("pending-group");
        expect(handleDeleteGroup).not.toHaveBeenCalled();
    });

    it("un grupo guardado se elimina en el backend", () => {
        deleteAction("saved-group");

        expect(handleDeleteGroup).toHaveBeenCalledWith("saved-group");
        expect(onRemovePending).not.toHaveBeenCalled();
    });
});

describe("ViewsTableContainer - guardado en curso", () => {
    it("muestra la tabla en carga mientras se guarda, sin acciones disponibles", () => {
        renderTable({ isSaving: true });

        expect(tableProps.isLoadingTable).toBe(true);
    });

    it("muestra las filas cuando no hay guardado en curso", () => {
        renderTable({ isSaving: false });

        expect(tableProps.isLoadingTable).toBeFalsy();
        expect(tableProps.dataTable.map((row) => row.group_id)).toEqual(["pending-group", "saved-group"]);
    });
});
