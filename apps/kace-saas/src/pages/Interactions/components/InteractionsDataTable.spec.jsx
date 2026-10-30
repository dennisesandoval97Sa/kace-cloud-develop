import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiService } from "@kace/utils";
import useUserInformation from "@/hooks/useUserInformation";
import useDataTable from "@/hooks/useDataTable";
import useGenericSearchQuery from "@/hooks/useGenericSearchQuery";
import { toast } from "sonner";
import { SYSTEM_INBOX_WORKSPACE_ID } from "@/utils/systemInboxWorkspace";
import InteractionsDataTable, { appendSystemInboxInteractionFilter } from "./InteractionsDataTable";

vi.mock("@/hooks/useUserInformation", () => ({
    default: vi.fn(),
}));

vi.mock("@/hooks/useDataTable", () => ({
    default: vi.fn(),
}));

vi.mock("@/hooks/useGenericSearchQuery", () => ({
    default: vi.fn(),
}));

vi.mock("@kace/utils", () => ({
    apiService: {
        post: vi.fn(),
    },
}));

vi.mock("sonner", () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

describe("appendSystemInboxInteractionFilter", () => {
    it("appends the aggregate workspace exclusion after specific and transformed filters", () => {
        const result = appendSystemInboxInteractionFilter([
            { field: "workspace_id", operator: "eq", value: "workspace-1", type: "AND" },
            { field: "status", operator: "eq", value: "Open", type: "AND" },
        ]);

        expect(result.at(-1)).toEqual({
            groupType: "AND",
            filters: [
                {
                    field: "workspace_id",
                    operator: "neq",
                    value: SYSTEM_INBOX_WORKSPACE_ID,
                    type: "AND",
                },
                {
                    field: "workspace_id",
                    operator: "null",
                    value: "null",
                    type: "OR",
                },
            ],
        });
        expect(result[0]).toMatchObject({ field: "workspace_id", value: "workspace-1" });
        expect(result[1]).not.toMatchObject({ field: "status" });
    });
});

vi.mock("@kace_v2/shared/ui/molecules/SelectField", async () => {
    const React = await import("react");

    return {
        default: ({ label, placeholder, options = [], value = "", onValueChange, disabled, error }) => (
            <label>
                <span>{label}</span>
                <select
                    aria-label={label}
                    value={value}
                    disabled={disabled}
                    aria-invalid={Boolean(error)}
                    onChange={(event) => onValueChange(event.target.value)}
                >
                    <option value="">{placeholder}</option>
                    {options.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
                {error ? <span role="alert">{error}</span> : null}
            </label>
        ),
    };
});

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key, defaultValue) => {
            const value =
                {
                    "navbar.actions": "Acciones",
                    "app.forms.delete": "Delete",
                    "app.forms.see": "View",
                    "app.forms.edit": "Edit",
                    "button.clearSelection": "Limpiar seleccion",
                    "interactions.rowActions.title": "Row actions",
                    "interactions.rowActions.close": "Close",
                    "interactions.bulk.move": "Mover interacciones",
                    "interactions.bulk.close": "Cerrar interacciones",
                    "interactions.bulk.delete": "Eliminar interacciones",
                    "interactions.title.searchPlaceholder": "Buscar interacciones",
                    "interactions.bulk.moveModal.title": "Mover interacciones seleccionadas",
                    "interactions.bulk.moveModal.selectedCount": "{{count}} interacciones seleccionadas",
                    "interactions.bulk.moveModal.workspace": "Espacio de trabajo",
                    "interactions.bulk.moveModal.workspacePlaceholder": "Selecciona un espacio de trabajo",
                    "interactions.bulk.moveModal.cancel": "Cancelar",
                    "interactions.bulk.moveModal.confirm": "Mover",
                    "interactions.bulk.motiveModal.closeTitle": "Cerrar interacciones seleccionadas",
                    "interactions.bulk.motiveModal.deleteTitle": "Eliminar interacciones seleccionadas",
                    "interactions.bulk.motiveModal.motive": "Motivo",
                    "interactions.bulk.motiveModal.motivePlaceholder": "Selecciona un motivo",
                    "interactions.bulk.motiveModal.cancel": "Cancelar",
                    "interactions.bulk.motiveModal.closeConfirm": "Cerrar",
                    "interactions.bulk.motiveModal.deleteConfirm": "Eliminar",
                    "interactions.bulk.messages.moveSuccess": "Interacciones movidas",
                    "interactions.bulk.messages.closeSuccess": "Interacciones cerradas",
                    "interactions.bulk.messages.deleteSuccess": "Interacciones eliminadas",
                    "interactions.bulk.messages.error": "No fue posible completar la accion",
                    "interactions.bulk.validation.workspaceRequired": "Selecciona un espacio de trabajo",
                    "interactions.bulk.validation.motiveRequired": "Selecciona un motivo",
                    "interactions.detail.modalTitle": "Detalle de interacción",
                    "interactions.detail.closed": "Cerrada",
                    "interactions.detail.underReview": "En revisión",
                    "interactions.detail.release": "Abierto",
                    "interactions.status.open": "Abierta",
                    "interactions.status.closed": "Cerrada",
                    "interactions.status.inReview": "En revisión",
                    "interactions.detail.noSubject": "Sin asunto",
                    "interactions.detail.selectInteraction": "Seleccione una interacción",
                    "interactions.detail.received": "Recibido",
                    "interactions.detail.reviewed": "Revisado",
                    "interactions.detail.from": "De",
                    "interactions.detail.priority": "Prioridad",
                    "interactions.detail.normal": "Normal",
                    "interactions.detail.content": "Contenido",
                    "interactions.detail.attachments": "Adjuntos",
                    "interactions.detail.modal.manage": "Gestionar",
                    "interactions.detail.modal.release": "Liberar",
                    "interactions.detail.modal.channel": "Canal",
                    "interactions.detail.modal.priority": "Prioridad",
                    "interactions.detail.modal.received": "Recepción",
                    "interactions.detail.modal.created": "Creación",
                    "interactions.detail.modal.contentPreview": "Vista previa del contenido",
                    "interactions.detail.modal.attachmentsCount": "Archivos adjuntos ({{count}})",
                    "interactions.detail.modal.open": "Abrir",
                    "interactions.detail.modal.downloadAttachments": "Descargar adjuntos",
                    "interactions.detail.modal.attachment": "Archivo adjunto",
                    "interactions.detail.actions.moreOptions": "Más opciones",
                    "interactions.detail.actions.move": "Mover interacción",
                    "interactions.detail.actions.close": "Cerrar interacción",
                    "interactions.detail.actions.delete": "Eliminar interacción",
                    "interactions.detail.actions.moveTitle": "Mover interacción",
                    "interactions.detail.actions.moveDescription": "Selecciona a dónde quieres mover esta interacción.",
                    "interactions.detail.actions.closeTitle": "Cerrar interacción",
                    "interactions.detail.actions.closeDescription": "Confirma el cierre de esta interacción.",
                    "interactions.detail.actions.deleteTitle": "Eliminar interacción",
                    "interactions.detail.actions.deleteDescription": "Esta accion no se puede deshacer.",
                    "interactions.detail.actions.selectedInteraction": "Interacción seleccionada",
                    "interactions.detail.actions.workspaceDestination": "Espacio de trabajo destino",
                    "interactions.detail.actions.closeMotive": "Motivo de cierre",
                    "interactions.detail.actions.deleteMotive": "Motivo de eliminación",
                    "interactions.detail.actions.workspacePlaceholder": "Selecciona un espacio de trabajo",
                    "interactions.detail.actions.motivePlaceholder": "Selecciona un motivo",
                    "interactions.detail.actions.closeNotice":
                        "La interacción quedará marcada como Cerrada y saldrá del flujo activo.",
                    "interactions.detail.actions.deleteWarningTitle": "Se eliminará la interacción {{subject}}",
                    "interactions.detail.actions.deleteWarningDescription":
                        "También se perderá el historial operativo asociado a esta vista.",
                    "interactions.detail.actions.cancel": "Cancelar",
                    "interactions.review.claimSuccess": "Interacción en revisión",
                    "interactions.review.releaseSuccess": "Interacción liberada",
                    "interactions.review.conflict": "La interacción ya está en revisión por otro agente.",
                    "interactions.review.forbidden": "No tienes permiso para liberar esta interacción.",
                    "interactions.review.manageForbidden": "No tienes permiso para gestionar esta interacción.",
                    "interactions.review.tooltipOther": "En revision por otro agente",
                    "interactions.review.tooltipNoPermission": "No tienes permiso para gestionar esta interacción.",
                    "genericTexts.noContent": "Sin contenido",
                }[key] ??
                (typeof defaultValue === "string" ? defaultValue : defaultValue?.defaultValue) ??
                key;

            return String(value)
                .replace("{{count}}", defaultValue?.count ?? "")
                .replace("{{subject}}", defaultValue?.subject ?? "");
        },
    }),
}));

vi.mock("@/componentsV2/core/DataTable", async () => {
    const React = await import("react");
    const { default: DataTableBulkActions } =
        await import("@/componentsV2/core/DataTable/components/DataTableBulkActions");

    return {
        default: vi.fn(({ renderData, bulkActions }) => (
            <div data-testid="interactions-data-table">
                <div>
                    {renderData.processedHeader.map((header) => (
                        <div key={header.id}>{header.content}</div>
                    ))}
                </div>
                <div>
                    {renderData.rows.map((row) => (
                        <div key={row.id} role="row">
                            {row.mainRow.cells.map((cell) => (
                                <div key={cell.id}>{cell.content}</div>
                            ))}
                        </div>
                    ))}
                </div>
                <DataTableBulkActions bulkActions={bulkActions} />
            </div>
        )),
    };
});

const interactions = [
    {
        id: "interaction-1",
        description: "Solicitud de actualizacion",
        client_identifier: "cliente.demo@kace.com",
        receipt_at: "2026-05-25T09:42:00.000Z",
        in_review: false,
        is_closed: false,
    },
    {
        id: "interaction-2",
        description: "Cliente reporta pago",
        client_identifier: "pagos@cliente.com",
        receipt_at: "2026-05-25T08:15:00.000Z",
        in_review: true,
        is_closed: false,
    },
];

const defaultUserInformation = {
    user: { id: "current-user" },
    permissionsAdmin: [{ module_id: "interactions", name: "InteractionsUpdate", granted: true }],
    permissionsAgent: [],
};

const createRow = (interaction, dataTableConfig = {}) => {
    const row = {
        id: interaction.id,
        original: interaction,
        mainRow: {
            id: interaction.id,
            cells: [],
        },
    };
    const cells = [];

    if (dataTableConfig.actions?.length > 0) {
        const actionColumn = dataTableConfig
            .includeColumns?.({ availableColumns: [{ id: "actions" }], actions: dataTableConfig.actions })
            ?.find((column) => column.id === "actions");

        if (actionColumn?.cell) {
            cells.push({
                id: `${interaction.id}-actions`,
                content: actionColumn.cell({ row }),
            });
        }
    }

    cells.push({
        id: `${interaction.id}-description`,
        content: <span>{interaction.description}</span>,
    });
    row.mainRow.cells = cells;

    return row;
};

let queryRefetchMock;
let queryHandleRefreshMock;
let renderedInteractions;

const createInteractionRowActions = () => [
    { name: "Delete", permissionName: "InteractionsDelete", action: vi.fn(), customizable: false },
    { name: "View", permissionName: "InteractionsRead", action: vi.fn(), customizable: false },
    { name: "Editar", permissionName: "InteractionsUpdate", action: vi.fn(), customizable: false },
];

const bulkPermissionActions = {
    move: { name: "Mover interacciones", permissionName: "InteractionsBulkMove", action: vi.fn(), customizable: false },
    close: {
        name: "Cerrar interacciones",
        permissionName: "InteractionsBulkClose",
        action: vi.fn(),
        customizable: false,
    },
    delete: { name: "Delete", permissionName: "InteractionsDelete", action: vi.fn(), customizable: false },
};

const createBulkPermissionActions = (permissionKeys = ["move", "close", "delete"]) =>
    permissionKeys.map((permissionKey) => ({
        ...bulkPermissionActions[permissionKey],
        action: vi.fn(),
    }));

const renderWithClient = (ui) => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
        },
    });
    vi.spyOn(queryClient, "invalidateQueries");

    const renderResult = render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);

    return {
        queryClient,
        ...renderResult,
        rerender: (nextUi) =>
            renderResult.rerender(<QueryClientProvider client={queryClient}>{nextUi}</QueryClientProvider>),
    };
};

const setupSearchQueries = () => {
    useGenericSearchQuery.mockImplementation(({ url, filter = [], enabled = true, select }) => {
        if (!enabled) {
            return { data: undefined, isLoading: false, isFetching: false, isError: false };
        }

        const hasFilter = (field, value) =>
            filter.some((item) => item.field === field && String(item.value) === String(value));

        let items = [];
        if (url === "/workspaces/search") {
            items = [{ id: "workspace-1", description: "Soporte" }];
        } else if (url === "/literals/search" && hasFilter("nombre", "interactions")) {
            items = [{ id: "model-1", nombre: "interactions" }];
        } else if (url === "/literals/search" && hasFilter("nombre", "closed_observation")) {
            items = [{ id: "field-1", nombre: "closed_observation" }];
        } else if (url === "/literals/search" && hasFilter("tipo_literal", "field-1")) {
            items = [
                { id: "motive-1", nombre: "resolved", descripcion: "Resuelto" },
                { id: "motive-2", nombre: "duplicate", descripcion: "Duplicado" },
            ];
        }

        const data = { data: items, count: items.length };
        return {
            data: select ? select(data) : data,
            isLoading: false,
            isFetching: false,
            isError: false,
        };
    });
};

const mockUseDataTable = () => {
    useDataTable.mockImplementation((dataTableConfig = {}) => ({
        renderData: {
            processedHeader: [{ id: "description", colSpan: 1, content: "Subject" }],
            rows: renderedInteractions.map((interaction) => createRow(interaction, dataTableConfig)),
            emptyState: null,
        },
        query: {
            isLoading: false,
            isError: false,
            isFetching: false,
            refetch: queryRefetchMock,
            handleRefresh: queryHandleRefreshMock,
        },
        filters: {
            onApply: vi.fn(),
            onClear: vi.fn(),
            schema: [],
            savedFilterList: [],
            openNewFilterModal: false,
            setOpenNewFilterModal: vi.fn(),
            handleSaveFilter: vi.fn(),
            onFilterSelect: vi.fn(),
            currentFiltersValues: {},
            selectedFilter: "",
        },
        pagination: {
            onPreviousPage: vi.fn(),
            canPreviousPage: false,
            onNextPage: vi.fn(),
            canNextPage: true,
        },
        columnSelector: {
            columns: [],
            onToggleVisibility: vi.fn(),
        },
        schema: [],
    }));
};

describe("InteractionsDataTable", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        queryRefetchMock = vi.fn();
        queryHandleRefreshMock = vi.fn();
        renderedInteractions = interactions;
        useUserInformation.mockReturnValue(defaultUserInformation);
        apiService.post.mockResolvedValue({ data: { updated: 1 } });
        setupSearchQueries();
        mockUseDataTable();
    });

    it("passes the selected workspace filter into useDataTable", () => {
        renderWithClient(<InteractionsDataTable actions={[]} selectedWorkspace="workspace-1" />);

        expect(useDataTable).toHaveBeenLastCalledWith(
            expect.objectContaining({
                tableFilters: [
                    {
                        field: "workspace_id",
                        operator: "eq",
                        value: "workspace-1",
                        type: "AND",
                    },
                ],
            }),
        );
    });

    it("adds a search filter for description and sender", async () => {
        const user = userEvent.setup();
        renderWithClient(<InteractionsDataTable actions={[]} selectedWorkspace={null} />);

        await user.type(screen.getByPlaceholderText("Buscar interacciones"), "demo");

        expect(useDataTable).toHaveBeenLastCalledWith(
            expect.objectContaining({
                tableFilters: [
                    {
                        groupType: "AND",
                        filters: [
                            {
                                field: "description",
                                operator: "ilike",
                                value: "demo",
                                type: "OR",
                            },
                            {
                                field: "client_identifier",
                                operator: "ilike",
                                value: "demo",
                                type: "OR",
                            },
                        ],
                    },
                ],
            }),
        );
    });

    it("ANDs the search group with the selected workspace filter", async () => {
        const user = userEvent.setup();
        renderWithClient(<InteractionsDataTable actions={[]} selectedWorkspace="workspace-1" />);

        await user.type(screen.getByPlaceholderText("Buscar interacciones"), "demo");

        // The workspace filter must come first (type AND) and the search group must
        // use groupType "AND" so the backend joins it with AND instead of OR;
        // otherwise selecting a workspace leaks results from other workspaces.
        expect(useDataTable).toHaveBeenLastCalledWith(
            expect.objectContaining({
                tableFilters: [
                    {
                        field: "workspace_id",
                        operator: "eq",
                        value: "workspace-1",
                        type: "AND",
                    },
                    {
                        groupType: "AND",
                        filters: [
                            {
                                field: "description",
                                operator: "ilike",
                                value: "demo",
                                type: "OR",
                            },
                            {
                                field: "client_identifier",
                                operator: "ilike",
                                value: "demo",
                                type: "OR",
                            },
                        ],
                    },
                ],
            }),
        );
    });

    it("configures status as a list filter in the interactions table", () => {
        renderWithClient(<InteractionsDataTable actions={[]} selectedWorkspace={null} />);

        const dataTableConfig = useDataTable.mock.calls.at(-1)[0];
        const statusColumn = dataTableConfig.processColumns({}).status({ column_name: "status" });

        expect(dataTableConfig.processFilters([])).toEqual([
            {
                column_name: "status",
                field: "list",
            },
        ]);
        expect(statusColumn).toEqual(
            expect.objectContaining({
                label: "Status",
                data_type: "derived",
                options: [
                    { value: "Open", name: "Abierta" },
                    { value: "Closed", name: "Cerrada" },
                    { value: "In review", name: "En revisión" },
                ],
                filterData: {
                    field: "status",
                    operator: "eq",
                    type: "AND",
                    value: "",
                },
            }),
        );
    });

    it.each([
        [
            "Open",
            {
                groupType: "AND",
                filters: [
                    { field: "is_closed", operator: "eq", value: false, type: "AND" },
                    { field: "in_review", operator: "eq", value: false, type: "AND" },
                ],
            },
        ],
        [
            "Closed",
            {
                field: "is_closed",
                operator: "eq",
                value: true,
                type: "AND",
            },
        ],
        [
            "In review",
            {
                groupType: "AND",
                filters: [
                    { field: "is_closed", operator: "eq", value: false, type: "AND" },
                    { field: "in_review", operator: "eq", value: true, type: "AND" },
                ],
            },
        ],
    ])("translates the %s status filter into interaction state criteria", (status, expectedFilter) => {
        renderWithClient(<InteractionsDataTable actions={[]} selectedWorkspace="workspace-1" />);

        const dataTableConfig = useDataTable.mock.calls.at(-1)[0];

        expect(
            dataTableConfig.transformFiltersBeforeQuery([
                { field: "workspace_id", operator: "eq", value: "workspace-1", type: "AND" },
                { field: "status", operator: "eq", value: status, type: "AND" },
            ]),
        ).toEqual([
            { field: "workspace_id", operator: "eq", value: "workspace-1", type: "AND" },
            expectedFilter,
            {
                groupType: "AND",
                filters: [
                    {
                        field: "workspace_id",
                        operator: "neq",
                        value: SYSTEM_INBOX_WORKSPACE_ID,
                        type: "AND",
                    },
                    {
                        field: "workspace_id",
                        operator: "null",
                        value: "null",
                        type: "OR",
                    },
                ],
            },
        ]);
    });

    it("shows permitted bulk actions after selecting a row", async () => {
        const user = userEvent.setup();
        renderWithClient(<InteractionsDataTable actions={createBulkPermissionActions()} selectedWorkspace={null} />);

        expect(screen.queryByRole("button", { name: /Acciones/i })).not.toBeInTheDocument();

        const [, firstRowCheckbox] = screen.getAllByRole("checkbox");
        await user.click(firstRowCheckbox);

        await user.click(screen.getByRole("button", { name: "Acciones (1)" }));

        expect(screen.getByRole("menuitem", { name: "Mover interacciones" })).toBeInTheDocument();
        expect(screen.getByRole("menuitem", { name: "Cerrar interacciones" })).toBeInTheDocument();
        expect(screen.getByRole("menuitem", { name: "Eliminar interacciones" })).toBeInTheDocument();
    });

    it("hides bulk move, close, and delete actions when the user lacks those permissions", async () => {
        const user = userEvent.setup();
        renderWithClient(<InteractionsDataTable actions={[]} selectedWorkspace={null} />);

        const [, firstRowCheckbox] = screen.getAllByRole("checkbox");
        await user.click(firstRowCheckbox);

        await user.click(screen.getByRole("button", { name: "Acciones (1)" }));

        expect(screen.queryByRole("menuitem", { name: "Mover interacciones" })).not.toBeInTheDocument();
        expect(screen.queryByRole("menuitem", { name: "Cerrar interacciones" })).not.toBeInTheDocument();
        expect(screen.queryByRole("menuitem", { name: "Eliminar interacciones" })).not.toBeInTheDocument();
        expect(screen.getByRole("menuitem", { name: "Limpiar seleccion" })).toBeInTheDocument();
    });

    it("shows only the bulk actions backed by individual permissions", async () => {
        const user = userEvent.setup();
        renderWithClient(
            <InteractionsDataTable
                actions={createBulkPermissionActions(["move", "delete"])}
                selectedWorkspace={null}
            />,
        );

        const [, firstRowCheckbox] = screen.getAllByRole("checkbox");
        await user.click(firstRowCheckbox);

        await user.click(screen.getByRole("button", { name: "Acciones (1)" }));

        expect(screen.getByRole("menuitem", { name: "Mover interacciones" })).toBeInTheDocument();
        expect(screen.queryByRole("menuitem", { name: "Cerrar interacciones" })).not.toBeInTheDocument();
        expect(screen.getByRole("menuitem", { name: "Eliminar interacciones" })).toBeInTheDocument();
    });

    it("renders the interaction-only row action menu without the edit action", async () => {
        const user = userEvent.setup();
        renderWithClient(<InteractionsDataTable actions={createInteractionRowActions()} selectedWorkspace={null} />);

        await user.click(screen.getByTestId("btn_interaction_row_actions_interaction-1"));

        expect(screen.getByRole("menuitem", { name: "Gestionar" })).toBeInTheDocument();
        expect(screen.getByRole("menuitem", { name: "Close" })).toBeInTheDocument();
        expect(screen.getByRole("menuitem", { name: "Delete" })).toBeInTheDocument();
        expect(screen.getByRole("menuitem", { name: "View" })).toBeInTheDocument();
        expect(screen.queryByRole("menuitem", { name: "Editar" })).not.toBeInTheDocument();
    });

    it("shows release instead of manage for an open interaction under review by a releaser", async () => {
        const user = userEvent.setup();
        renderWithClient(<InteractionsDataTable actions={createInteractionRowActions()} selectedWorkspace={null} />);

        await user.click(screen.getByTestId("btn_interaction_row_actions_interaction-2"));

        expect(screen.getByRole("menuitem", { name: "Liberar" })).toBeInTheDocument();
        expect(screen.queryByRole("menuitem", { name: "Gestionar" })).not.toBeInTheDocument();
    });

    it("omits manage and release when another reviewer owns the interaction and the user cannot release it", async () => {
        const user = userEvent.setup();
        renderedInteractions = [
            {
                ...interactions[1],
                start_review_by: "other-agent",
            },
        ];
        useUserInformation.mockReturnValue({
            user: { id: "current-user" },
            permissionsAdmin: [],
            permissionsAgent: [{ module_id: "interactions", name: "InteractionsCreate", granted: true }],
        });

        renderWithClient(
            <InteractionsDataTable
                actions={[{ name: "View", action: vi.fn(), customizable: false }]}
                selectedWorkspace={null}
            />,
        );

        await user.click(screen.getByTestId("btn_interaction_row_actions_interaction-2"));

        expect(screen.queryByRole("menuitem", { name: "Gestionar" })).not.toBeInTheDocument();
        expect(screen.queryByRole("menuitem", { name: "Liberar" })).not.toBeInTheDocument();
        expect(screen.getByRole("menuitem", { name: "View" })).toBeInTheDocument();
    });

    it("claims an open interaction from the row action menu", async () => {
        const user = userEvent.setup();
        const claimedInteraction = {
            ...interactions[0],
            in_review: true,
            start_review_by: "current-user",
        };
        apiService.post.mockImplementation((url) => {
            if (url === "/interactions/interaction-1/review/claim") {
                return Promise.resolve({ data: { data: claimedInteraction } });
            }

            return Promise.resolve({ data: { updated: 1 } });
        });

        renderWithClient(<InteractionsDataTable actions={createInteractionRowActions()} selectedWorkspace={null} />);

        await user.click(screen.getByTestId("btn_interaction_row_actions_interaction-1"));
        await user.click(screen.getByRole("menuitem", { name: "Gestionar" }));

        await waitFor(() => {
            expect(apiService.post).toHaveBeenCalledWith("/interactions/interaction-1/review/claim", {});
        });
    });

    it("opens the close dialog from the row action menu and sends the single ID", async () => {
        const user = userEvent.setup();
        renderWithClient(<InteractionsDataTable actions={createInteractionRowActions()} selectedWorkspace={null} />);

        await user.click(screen.getByTestId("btn_interaction_row_actions_interaction-1"));
        await user.click(screen.getByRole("menuitem", { name: "Close" }));

        expect(screen.getByText("Confirma el cierre de esta interacción.")).toBeInTheDocument();

        await user.selectOptions(screen.getByLabelText("Motivo de cierre"), "resolved");
        await user.click(screen.getByRole("button", { name: "Cerrar interacción" }));

        await waitFor(() => {
            expect(apiService.post).toHaveBeenCalledWith("/interactions-bulk/close", {
                interaction_ids: ["interaction-1"],
                motive: "resolved",
            });
        });
    });

    it("opens the detail modal from the row view action", async () => {
        const user = userEvent.setup();
        renderWithClient(<InteractionsDataTable actions={createInteractionRowActions()} selectedWorkspace={null} />);

        await user.click(screen.getByTestId("btn_interaction_row_actions_interaction-1"));
        await user.click(screen.getByRole("menuitem", { name: "View" }));

        const dialog = await screen.findByRole("dialog");

        expect(within(dialog).getByText("Solicitud de actualizacion")).toBeInTheDocument();
        expect(within(dialog).getByText("cliente.demo@kace.com")).toBeInTheDocument();
    });

    it("opens the interaction detail modal when the row Ver action is invoked", async () => {
        const viewActionHandler = vi.fn();

        renderWithClient(
            <InteractionsDataTable
                actions={[
                    {
                        name: "Ver",
                        action: viewActionHandler,
                        customizable: false,
                    },
                ]}
                selectedWorkspace={null}
            />,
        );

        const dataTableConfig = useDataTable.mock.calls.at(-1)[0];
        const viewAction = dataTableConfig.actions.find((action) => action.name === "Ver");

        act(() => {
            viewAction.action(interactions[0].id, interactions[0].reference, interactions[0]);
        });

        const dialog = await screen.findByRole("dialog");

        expect(viewActionHandler).not.toHaveBeenCalled();
        expect(within(dialog).getByText("Solicitud de actualizacion")).toBeInTheDocument();
        expect(within(dialog).getByText("cliente.demo@kace.com")).toBeInTheDocument();
        expect(within(dialog).getByText("Gestionar")).toBeInTheDocument();
        expect(within(dialog).getByText("Vista previa del contenido")).toBeInTheDocument();
    });

    it("passes workspace options into the interaction detail modal for workspace labels", async () => {
        renderWithClient(
            <InteractionsDataTable
                actions={[
                    {
                        name: "Ver",
                        action: vi.fn(),
                        customizable: false,
                    },
                ]}
                selectedWorkspace={null}
            />,
        );

        const dataTableConfig = useDataTable.mock.calls.at(-1)[0];
        const viewAction = dataTableConfig.actions.find((action) => action.name === "Ver");
        const workspaceInteraction = {
            ...interactions[0],
            workspace_id: "workspace-1",
            channel: "Inbox",
        };

        act(() => {
            viewAction.action(workspaceInteraction.id, workspaceInteraction.reference, workspaceInteraction);
        });

        const dialog = await screen.findByRole("dialog");

        expect(within(dialog).getByText("Soporte")).toBeInTheDocument();
        expect(dialog).not.toHaveTextContent("Inbox");
    });

    it("updates the open detail modal review button after claiming review", async () => {
        const user = userEvent.setup();
        const claimedInteraction = {
            ...interactions[0],
            in_review: true,
            start_review_by: "current-user",
        };
        apiService.post.mockImplementation((url) => {
            if (url === "/interactions/interaction-1/review/claim") {
                return Promise.resolve({ data: { data: claimedInteraction } });
            }

            return Promise.resolve({ data: { updated: 1 } });
        });

        renderWithClient(
            <InteractionsDataTable
                actions={[
                    {
                        name: "Ver",
                        action: vi.fn(),
                        customizable: false,
                    },
                ]}
                selectedWorkspace={null}
            />,
        );

        const dataTableConfig = useDataTable.mock.calls.at(-1)[0];
        const viewAction = dataTableConfig.actions.find((action) => action.name === "Ver");

        act(() => {
            viewAction.action(interactions[0].id, interactions[0].reference, interactions[0]);
        });

        const dialog = await screen.findByRole("dialog");
        await user.click(within(dialog).getByRole("button", { name: "Gestionar" }));

        await waitFor(() => {
            expect(apiService.post).toHaveBeenCalledWith("/interactions/interaction-1/review/claim", {});
        });
        await waitFor(() => {
            expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Liberar" })).toBeEnabled();
        });
        expect(within(screen.getByRole("dialog")).queryByRole("button", { name: "Gestionar" })).not.toBeInTheDocument();
    });

    it("opens the move interaction dialog from the detail action menu and sends the single ID through bulk move", async () => {
        const user = userEvent.setup();

        renderWithClient(
            <InteractionsDataTable
                actions={[
                    {
                        name: "Ver",
                        action: vi.fn(),
                        customizable: false,
                    },
                ]}
                selectedWorkspace={null}
            />,
        );

        const dataTableConfig = useDataTable.mock.calls.at(-1)[0];
        const viewAction = dataTableConfig.actions.find((action) => action.name === "Ver");

        act(() => {
            viewAction.action(interactions[0].id, interactions[0].reference, interactions[0]);
        });

        await screen.findByRole("dialog");
        await user.click(screen.getByRole("button", { name: "Más opciones" }));
        await user.click(screen.getByRole("menuitem", { name: "Mover interacción" }));

        expect(screen.getByText("Selecciona a dónde quieres mover esta interacción.")).toBeInTheDocument();
        expect(screen.getByText("Solicitud de actualizacion · cliente.demo@kace.com")).toBeInTheDocument();

        await user.selectOptions(screen.getByLabelText("Espacio de trabajo destino"), "workspace-1");
        await user.click(screen.getByRole("button", { name: "Mover" }));

        await waitFor(() => {
            expect(apiService.post).toHaveBeenCalledWith("/interactions-bulk/move", {
                interaction_ids: ["interaction-1"],
                workspace_id: "workspace-1",
            });
        });
        expect(toast.success).toHaveBeenCalledWith("Interacciones movidas");
    });

    it("opens the close interaction dialog from the detail action menu and sends the single ID through bulk close", async () => {
        const user = userEvent.setup();

        renderWithClient(
            <InteractionsDataTable
                actions={[
                    {
                        name: "Ver",
                        action: vi.fn(),
                        customizable: false,
                    },
                ]}
                selectedWorkspace={null}
            />,
        );

        const dataTableConfig = useDataTable.mock.calls.at(-1)[0];
        const viewAction = dataTableConfig.actions.find((action) => action.name === "Ver");

        act(() => {
            viewAction.action(interactions[0].id, interactions[0].reference, interactions[0]);
        });

        await screen.findByRole("dialog");
        await user.click(screen.getByRole("button", { name: "Más opciones" }));
        await user.click(screen.getByRole("menuitem", { name: "Cerrar interacción" }));

        expect(
            screen.getByText("La interacción quedará marcada como Cerrada y saldrá del flujo activo."),
        ).toBeInTheDocument();

        await user.selectOptions(screen.getByLabelText("Motivo de cierre"), "resolved");
        await user.click(screen.getByRole("button", { name: "Cerrar interacción" }));

        await waitFor(() => {
            expect(apiService.post).toHaveBeenCalledWith("/interactions-bulk/close", {
                interaction_ids: ["interaction-1"],
                motive: "resolved",
            });
        });
        expect(toast.success).toHaveBeenCalledWith("Interacciones cerradas");
    });

    it("opens the delete interaction dialog from the detail action menu and sends the single ID through bulk delete", async () => {
        const user = userEvent.setup();

        renderWithClient(
            <InteractionsDataTable
                actions={[
                    {
                        name: "Ver",
                        action: vi.fn(),
                        customizable: false,
                    },
                ]}
                selectedWorkspace={null}
            />,
        );

        const dataTableConfig = useDataTable.mock.calls.at(-1)[0];
        const viewAction = dataTableConfig.actions.find((action) => action.name === "Ver");

        act(() => {
            viewAction.action(interactions[0].id, interactions[0].reference, interactions[0]);
        });

        await screen.findByRole("dialog");
        await user.click(screen.getByRole("button", { name: "Más opciones" }));
        await user.click(screen.getByRole("menuitem", { name: "Eliminar interacción" }));

        expect(screen.getByText("Se eliminará la interacción Solicitud de actualizacion")).toBeInTheDocument();

        await user.selectOptions(screen.getByLabelText("Motivo de eliminación"), "duplicate");
        await user.click(screen.getByRole("button", { name: "Eliminar interacción" }));

        await waitFor(() => {
            expect(apiService.post).toHaveBeenCalledWith("/interactions-bulk/delete", {
                interaction_ids: ["interaction-1"],
                motive: "duplicate",
            });
        });
        expect(toast.success).toHaveBeenCalledWith("Interacciones eliminadas");
    });

    it("selects all rendered rows from the header checkbox", async () => {
        const user = userEvent.setup();
        renderWithClient(<InteractionsDataTable actions={[]} selectedWorkspace={null} />);

        const [headerCheckbox] = screen.getAllByRole("checkbox");
        await user.click(headerCheckbox);

        expect(screen.getByRole("button", { name: "Acciones (2)" })).toBeInTheDocument();
    });

    it("keeps selections from other pages in the bulk count while leaving the current page checkboxes unchecked", async () => {
        const user = userEvent.setup();
        renderedInteractions = [interactions[0]];
        const { rerender } = renderWithClient(<InteractionsDataTable actions={[]} selectedWorkspace={null} />);

        const [, firstRowCheckbox] = screen.getAllByRole("checkbox");
        await user.click(firstRowCheckbox);
        expect(screen.getByRole("button", { name: "Acciones (1)" })).toBeInTheDocument();

        renderedInteractions = [interactions[1]];
        rerender(<InteractionsDataTable actions={[]} selectedWorkspace={null} />);

        const [headerCheckbox, visibleRowCheckbox] = screen.getAllByRole("checkbox");
        // The current page row is not part of the selection, so its checkbox and the
        // header stay unchecked, but the selection made on the other page persists.
        expect(headerCheckbox).not.toBeChecked();
        expect(visibleRowCheckbox).not.toBeChecked();
        expect(screen.getByRole("button", { name: "Acciones (1)" })).toBeInTheDocument();
    });

    it("posts selected IDs from all pages, not just the visible ones", async () => {
        const user = userEvent.setup();
        renderedInteractions = [interactions[0]];
        const moveActions = createBulkPermissionActions(["move"]);
        const { rerender } = renderWithClient(<InteractionsDataTable actions={moveActions} selectedWorkspace={null} />);

        const [, firstRowCheckbox] = screen.getAllByRole("checkbox");
        await user.click(firstRowCheckbox);

        renderedInteractions = [interactions[1]];
        rerender(<InteractionsDataTable actions={moveActions} selectedWorkspace={null} />);

        const [, visibleRowCheckbox] = screen.getAllByRole("checkbox");
        await user.click(visibleRowCheckbox);
        await user.click(screen.getByRole("button", { name: "Acciones (2)" }));
        await user.click(screen.getByRole("menuitem", { name: "Mover interacciones" }));
        await user.selectOptions(screen.getByLabelText("Espacio de trabajo"), "workspace-1");
        await user.click(screen.getByRole("button", { name: "Mover" }));

        await waitFor(() => {
            expect(apiService.post).toHaveBeenCalledWith("/interactions-bulk/move", {
                interaction_ids: ["interaction-1", "interaction-2"],
                workspace_id: "workspace-1",
            });
        });
    });

    it("opens the move modal and sends selected IDs with the chosen workspace", async () => {
        const user = userEvent.setup();
        const { queryClient } = renderWithClient(
            <InteractionsDataTable actions={createBulkPermissionActions(["move"])} selectedWorkspace={null} />,
        );

        const [, firstRowCheckbox] = screen.getAllByRole("checkbox");
        await user.click(firstRowCheckbox);
        await user.click(screen.getByRole("button", { name: "Acciones (1)" }));
        await user.click(screen.getByRole("menuitem", { name: "Mover interacciones" }));

        expect(screen.getByText("Mover interacciones seleccionadas")).toBeInTheDocument();

        await user.selectOptions(screen.getByLabelText("Espacio de trabajo"), "workspace-1");
        await user.click(screen.getByRole("button", { name: "Mover" }));

        await waitFor(() => {
            expect(apiService.post).toHaveBeenCalledWith("/interactions-bulk/move", {
                interaction_ids: ["interaction-1"],
                workspace_id: "workspace-1",
            });
        });
        expect(toast.success).toHaveBeenCalledWith("Interacciones movidas");
        expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["interactions"] });
        expect(queryRefetchMock).toHaveBeenCalledTimes(1);
        expect(queryHandleRefreshMock).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole("button", { name: "Acciones (1)" })).not.toBeInTheDocument();
    });

    it("opens the close modal and sends selected IDs with the chosen motive", async () => {
        const user = userEvent.setup();
        renderWithClient(
            <InteractionsDataTable actions={createBulkPermissionActions(["close"])} selectedWorkspace={null} />,
        );

        const [headerCheckbox] = screen.getAllByRole("checkbox");
        await user.click(headerCheckbox);
        await user.click(screen.getByRole("button", { name: "Acciones (2)" }));
        await user.click(screen.getByRole("menuitem", { name: "Cerrar interacciones" }));

        expect(screen.getByText("Cerrar interacciones seleccionadas")).toBeInTheDocument();

        await user.selectOptions(screen.getByLabelText("Motivo"), "resolved");
        await user.click(screen.getByRole("button", { name: "Cerrar" }));

        await waitFor(() => {
            expect(apiService.post).toHaveBeenCalledWith("/interactions-bulk/close", {
                interaction_ids: ["interaction-1", "interaction-2"],
                motive: "resolved",
            });
        });
        expect(toast.success).toHaveBeenCalledWith("Interacciones cerradas");
    });

    it("opens the delete modal and sends selected IDs with the chosen motive", async () => {
        const user = userEvent.setup();
        renderWithClient(
            <InteractionsDataTable actions={createBulkPermissionActions(["delete"])} selectedWorkspace={null} />,
        );

        const [, firstRowCheckbox] = screen.getAllByRole("checkbox");
        await user.click(firstRowCheckbox);
        await user.click(screen.getByRole("button", { name: "Acciones (1)" }));
        await user.click(screen.getByRole("menuitem", { name: "Eliminar interacciones" }));

        expect(screen.getByText("Eliminar interacciones seleccionadas")).toBeInTheDocument();

        await user.selectOptions(screen.getByLabelText("Motivo"), "duplicate");
        await user.click(screen.getByRole("button", { name: "Eliminar" }));

        await waitFor(() => {
            expect(apiService.post).toHaveBeenCalledWith("/interactions-bulk/delete", {
                interaction_ids: ["interaction-1"],
                motive: "duplicate",
            });
        });
        expect(toast.success).toHaveBeenCalledWith("Interacciones eliminadas");
    });

    it("keeps the modal open and shows the backend error when a bulk mutation fails", async () => {
        const user = userEvent.setup();
        apiService.post.mockRejectedValueOnce({ response: { data: { message: "Backend rejected the move" } } });
        renderWithClient(
            <InteractionsDataTable actions={createBulkPermissionActions(["move"])} selectedWorkspace={null} />,
        );

        const [, firstRowCheckbox] = screen.getAllByRole("checkbox");
        await user.click(firstRowCheckbox);
        await user.click(screen.getByRole("button", { name: "Acciones (1)" }));
        await user.click(screen.getByRole("menuitem", { name: "Mover interacciones" }));
        await user.selectOptions(screen.getByLabelText("Espacio de trabajo"), "workspace-1");
        await user.click(screen.getByRole("button", { name: "Mover" }));

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith("Backend rejected the move");
        });
        expect(screen.getByText("Mover interacciones seleccionadas")).toBeInTheDocument();
        expect(toast.success).not.toHaveBeenCalled();
    });
});
