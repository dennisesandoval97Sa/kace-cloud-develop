import PropTypes from "prop-types";
import { useCallback, useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import DataTable from "@/componentsV2/core/DataTable";
import useDataTable from "@/hooks/useDataTable";
import { SPECIAL_FIELDS } from "@/services/createSchemaFilter";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import { getTranslatedError } from "@/utils/getTranslatedError";
import { createSystemInboxInteractionExclusionFilter, isSystemInboxWorkspaceId } from "@/utils/systemInboxWorkspace";
import {
    Button,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui-shared";
import InteractionsBulkMotiveModal from "./InteractionsBulkMotiveModal";
import InteractionsBulkMoveModal from "./InteractionsBulkMoveModal";
import InteractionDetailModal from "./InteractionDetailModal";
import { InteractionMotiveDialog } from "./InteractionDetailActionDialogs";
import useInteractionBulkOptions from "../hooks/useInteractionBulkOptions";
import useSelectedInteractions from "../hooks/useSelectedInteractions";
import { useInteractionReviewActions } from "../hooks/useInteractionReviewActions";
import { closeInteractions, deleteInteractions, moveInteractions } from "../services/interactionsBulkService";
import { getInteractionSubject } from "../utils/interactionDisplayUtils";

const INTERACTION_COLUMNS = ["receipt_at", "description", "client_identifier", "status"];

const INTERACTION_STATUS_FILTER_OPTIONS = [
    { value: "Open", name: "Open" },
    { value: "Closed", name: "Closed" },
    { value: "In review", name: "In review" },
];

const getInteractionStatusFilterOptions = (t) =>
    INTERACTION_STATUS_FILTER_OPTIONS.map((option) => {
        const labelKeyByValue = {
            Open: "interactions.status.open",
            Closed: "interactions.status.closed",
            "In review": "interactions.status.inReview",
        };

        return {
            ...option,
            name: t(labelKeyByValue[option.value], option.name),
        };
    });

const interactionsDataTableConfig = {
    url: URL_AND_KEYS.interactions.url,
    key: URL_AND_KEYS.interactions.key,
    view: URL_AND_KEYS.interactions.view,
    entity: URL_AND_KEYS.interactions.entity,
    genericColumns: INTERACTION_COLUMNS,
    enableStepJump: true,
    order: {
        field: "receipt_at",
        direction: "desc",
    },
};

const getInteractionSender = (interaction) => interaction?.client_identifier || interaction?.external_identifier || "";

const getInteractionStatusKey = (interaction) => {
    if (interaction?.is_closed) return "closed";
    if (interaction?.in_review) return "inReview";
    return "open";
};

const getInteractionStatusLabel = (interaction, t) => {
    const statusKey = getInteractionStatusKey(interaction);
    const labelMap = {
        closed: "interactions.detail.closed",
        inReview: "interactions.detail.underReview",
        open: "interactions.detail.release",
    };

    return t(labelMap[statusKey]);
};

const getStatusClassName = (interaction) => {
    const statusKey = getInteractionStatusKey(interaction);
    if (statusKey === "closed") return "border-gray-300 bg-gray-100 text-gray-700";
    if (statusKey === "inReview") return "border-yellow-200 bg-yellow-100 text-yellow-700";
    return "border-blue-200 bg-blue-100 text-blue-700";
};

const formatInteractionDate = (value) => {
    if (!value) return "-";

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "-";

    return format(date, "dd/MM/yyyy HH:mm", { locale: es });
};

const processInteractionsData = (data = []) =>
    data.map((interaction) => ({
        ...interaction,
        status: getInteractionStatusKey(interaction),
    }));

const createFallbackSchemaColumn = (columnName) => {
    const fallback = {
        receipt_at: {
            label: "Date",
            data_type: "datetime",
            field_type: "datetime",
        },
        description: {
            label: "Subject",
            data_type: "string",
            field_type: "string",
        },
        client_identifier: {
            label: "Sender address",
            data_type: "string",
            field_type: "string",
        },
        status: {
            label: "Status",
            data_type: "derived",
            field_type: "derived",
        },
    };

    return {
        column_name: columnName,
        ...(fallback[columnName] ?? {}),
    };
};

const processInteractionsSchema = (schema = []) => {
    const schemaByName = new Map(schema.map((column) => [column.column_name, column]));

    return INTERACTION_COLUMNS.map((columnName) => ({
        ...(schemaByName.get(columnName) ?? {}),
        ...createFallbackSchemaColumn(columnName),
    }));
};

const createProcessInteractionsColumns =
    (t) =>
    (filters = {}) => ({
        ...filters,
        receipt_at: (row) => ({
            ...row,
            label: "Date",
            data_type: "datetime",
            filterData: {
                field: "receipt_at",
                operator: "between",
                type: "AND",
                value: "",
            },
        }),
        description: (row) => ({
            ...row,
            label: "Subject",
            data_type: "string",
            filterData: {
                field: "description",
                operator: "ilike",
                type: "AND",
                value: "",
            },
        }),
        client_identifier: (row) => ({
            ...row,
            label: "Sender address",
            data_type: "string",
            filterData: {
                field: "client_identifier",
                operator: "ilike",
                type: "AND",
                value: "",
            },
        }),
        status: (row) => ({
            ...row,
            label: "Status",
            data_type: "derived",
            options: getInteractionStatusFilterOptions(t),
            filterData: {
                field: "status",
                operator: "eq",
                type: "AND",
                value: "",
            },
        }),
    });

const processInteractionsFilters = (defaultFilters = []) => [
    ...defaultFilters,
    {
        column_name: "status",
        field: SPECIAL_FIELDS.list,
    },
];

const normalizeStatusFilterValue = (value) =>
    String(value ?? "")
        .trim()
        .toLowerCase()
        .replace(/[\s_-]+/g, "");

const mapInteractionStatusFilter = (filter) => {
    const status = normalizeStatusFilterValue(filter?.value);

    if (status === "open") {
        return {
            groupType: filter.type ?? "AND",
            filters: [
                { field: "is_closed", operator: "eq", value: false, type: "AND" },
                { field: "in_review", operator: "eq", value: false, type: "AND" },
            ],
        };
    }

    if (status === "closed") {
        return {
            field: "is_closed",
            operator: "eq",
            value: true,
            type: filter.type ?? "AND",
        };
    }

    if (status === "inreview") {
        return {
            groupType: filter.type ?? "AND",
            filters: [
                { field: "is_closed", operator: "eq", value: false, type: "AND" },
                { field: "in_review", operator: "eq", value: true, type: "AND" },
            ],
        };
    }

    return null;
};

const transformInteractionStatusFilters = (filters = []) =>
    filters
        .map((filter) => {
            if (filter?.groupType && Array.isArray(filter.filters)) {
                return {
                    ...filter,
                    filters: transformInteractionStatusFilters(filter.filters),
                };
            }

            if (filter?.field !== "status") {
                return filter;
            }

            return mapInteractionStatusFilter(filter);
        })
        .filter(Boolean);

export const appendSystemInboxInteractionFilter = (filters = []) => [
    ...transformInteractionStatusFilters(filters),
    createSystemInboxInteractionExclusionFilter(),
];

const VIEW_ACTION_LABELS = new Set(["Ver", "See"]);
const DELETE_ACTION_LABELS = new Set(["Delete", "Eliminar"]);
const UPDATE_ACTION_LABELS = new Set(["Editar", "Edit", "Update", "Actualizar"]);
const BULK_MOVE_PERMISSION_NAME = "InteractionsBulkMove";
const BULK_CLOSE_PERMISSION_NAME = "InteractionsBulkClose";
const DELETE_PERMISSION_NAME = "InteractionsDelete";

const isViewInteractionAction = (action, translatedSeeLabel) =>
    action?.name === translatedSeeLabel || VIEW_ACTION_LABELS.has(action?.name);

const hasActionLabel = (actions, translatedLabel, fallbackLabels = new Set()) =>
    actions.some((action) => action?.name === translatedLabel || fallbackLabels.has(action?.name));

const hasActionPermission = (actions, permissionName, translatedLabel, fallbackLabels = new Set()) =>
    actions.some(
        (action) =>
            action?.permissionName === permissionName ||
            action?.name === permissionName ||
            action?.name === translatedLabel ||
            fallbackLabels.has(action?.name),
    );

const InteractionRowActions = ({ interaction, canClose, canDelete, canView, onView, onClose, onDelete }) => {
    const { t } = useTranslation();
    const { button: reviewButton } = useInteractionReviewActions({ interaction });
    const isOpen = Boolean(interaction?.id && !interaction?.is_closed);
    const showReviewAction = Boolean(
        isOpen &&
        reviewButton?.onClick &&
        !reviewButton?.disabled &&
        ["manage", "release"].includes(reviewButton?.intent),
    );
    const showCloseAction = Boolean(isOpen && canClose);
    const rowActions = [
        showReviewAction
            ? {
                  key: "review",
                  label: reviewButton.label,
                  onSelect: reviewButton.onClick,
              }
            : null,
        showCloseAction
            ? {
                  key: "close",
                  label: t("interactions.rowActions.close", "Close"),
                  onSelect: () => onClose(interaction),
              }
            : null,
        canDelete
            ? {
                  key: "delete",
                  label: t("app.forms.delete", "Delete"),
                  onSelect: () => onDelete(interaction),
                  className: "text-redCustom focus:text-redCustom",
              }
            : null,
        canView
            ? {
                  key: "view",
                  label: t("app.forms.see", "View"),
                  onSelect: () => onView(interaction),
              }
            : null,
    ].filter(Boolean);

    if (rowActions.length === 0) {
        return null;
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    className="h-8 w-8 p-0 font-bold"
                    aria-label={t("interactions.rowActions.title", "Row actions")}
                    id={`btn_interaction_row_actions_${interaction.id}`}
                    data-testid={`btn_interaction_row_actions_${interaction.id}`}
                >
                    ...
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
                <DropdownMenuLabel>{t("interactions.rowActions.title", "Row actions")}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {rowActions.map((action) => (
                    <DropdownMenuItem
                        key={action.key}
                        className={action.className}
                        onSelect={() => action.onSelect()}
                        id={`action_${interaction.id}_${action.key}`}
                        data-testid={`action_${interaction.id}_${action.key}`}
                    >
                        {action.label}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

InteractionRowActions.propTypes = {
    interaction: PropTypes.object.isRequired,
    canClose: PropTypes.bool.isRequired,
    canDelete: PropTypes.bool.isRequired,
    canView: PropTypes.bool.isRequired,
    onView: PropTypes.func.isRequired,
    onClose: PropTypes.func.isRequired,
    onDelete: PropTypes.func.isRequired,
};

const isSameInteractionId = (leftId, rightId) =>
    leftId !== null &&
    leftId !== undefined &&
    rightId !== null &&
    rightId !== undefined &&
    String(leftId) === String(rightId);

const hasReviewStateChanged = (currentInteraction, nextInteraction) =>
    currentInteraction?.in_review !== nextInteraction?.in_review ||
    currentInteraction?.start_review_by !== nextInteraction?.start_review_by ||
    currentInteraction?.reviewer_id !== nextInteraction?.reviewer_id;

const InteractionsDataTable = ({ actions = [], selectedWorkspace = null }) => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState("");
    const [activeBulkModal, setActiveBulkModal] = useState(null);
    const [activeRowActionDialog, setActiveRowActionDialog] = useState(null);
    const [interactionToView, setInteractionToView] = useState(null);
    const {
        selectedInteractions,
        setSelectedInteractions,
        clearSelectedInteractions,
        getInteractionFromRow,
        toggleInteraction,
    } = useSelectedInteractions(selectedWorkspace ?? "all");
    const { workspaceOptions, motiveOptions, isLoadingWorkspaces, isLoadingMotiveOptions } =
        useInteractionBulkOptions();
    const moveMutation = useMutation({ mutationFn: moveInteractions });
    const closeMutation = useMutation({ mutationFn: closeInteractions });
    const deleteMutation = useMutation({ mutationFn: deleteInteractions });
    const seeActionLabel = t("app.forms.see", "View");
    const deleteActionLabel = t("app.forms.delete", "Delete");
    const updateActionLabel = t("app.forms.edit", "Edit");
    const bulkMoveActionLabel = t("interactions.bulk.move", "Move interactions");
    const bulkCloseActionLabel = t("interactions.bulk.close", "Close interactions");

    const actionPermissions = useMemo(
        () => ({
            canView: actions.some((action) => isViewInteractionAction(action, seeActionLabel)),
            canDelete: hasActionLabel(actions, deleteActionLabel, DELETE_ACTION_LABELS),
            canClose: hasActionLabel(actions, updateActionLabel, UPDATE_ACTION_LABELS),
            canBulkMove: hasActionPermission(actions, BULK_MOVE_PERMISSION_NAME, bulkMoveActionLabel),
            canBulkClose: hasActionPermission(actions, BULK_CLOSE_PERMISSION_NAME, bulkCloseActionLabel),
            canBulkDelete: hasActionPermission(
                actions,
                DELETE_PERMISSION_NAME,
                deleteActionLabel,
                DELETE_ACTION_LABELS,
            ),
        }),
        [actions, bulkCloseActionLabel, bulkMoveActionLabel, deleteActionLabel, seeActionLabel, updateActionLabel],
    );

    const tableActions = useMemo(() => {
        if (!actionPermissions.canView && !actionPermissions.canDelete && !actionPermissions.canClose) {
            return [];
        }

        const viewAction = actions.find((action) => isViewInteractionAction(action, seeActionLabel));

        return [
            viewAction
                ? {
                      ...viewAction,
                      action: (_id, _reference, interaction) => {
                          setInteractionToView(interaction ?? null);
                      },
                  }
                : {
                      name: "__interaction_row_actions__",
                      action: () => {},
                      customizable: false,
                  },
        ];
    }, [actionPermissions, actions, seeActionLabel]);

    const tableFilters = useMemo(() => {
        const filters = [];

        if (selectedWorkspace !== null && selectedWorkspace !== undefined) {
            filters.push({
                field: "workspace_id",
                operator: "eq",
                value: selectedWorkspace.toString(),
                type: "AND",
            });
        }

        const normalizedSearchTerm = searchTerm.trim();
        if (normalizedSearchTerm) {
            // groupType "AND" joins this whole group to the outer WHERE with AND
            // (so it ANDs with the workspace filter), while the inner subfilters
            // keep type "OR" to match description OR sender. Using "OR" here would
            // make the group OR with the preceding workspace filter, leaking
            // results from other workspaces when a workspace is selected.
            filters.push({
                groupType: "AND",
                filters: [
                    {
                        field: "description",
                        operator: "ilike",
                        value: normalizedSearchTerm,
                        type: "OR",
                    },
                    {
                        field: "client_identifier",
                        operator: "ilike",
                        value: normalizedSearchTerm,
                        type: "OR",
                    },
                ],
            });
        }

        return filters;
    }, [selectedWorkspace, searchTerm]);
    const processInteractionsColumns = useMemo(() => createProcessInteractionsColumns(t), [t]);

    const includeInteractionsColumns = useCallback(
        ({ availableColumns }) =>
            availableColumns.map((column) => {
                const columnId = column.id ?? column.accessorKey;

                if (columnId === "actions") {
                    return {
                        ...column,
                        cell: ({ row }) => (
                            <InteractionRowActions
                                interaction={row.original}
                                canClose={actionPermissions.canClose}
                                canDelete={actionPermissions.canDelete}
                                canView={actionPermissions.canView}
                                onView={(interaction) => setInteractionToView(interaction)}
                                onClose={(interaction) => setActiveRowActionDialog({ type: "close", interaction })}
                                onDelete={(interaction) => setActiveRowActionDialog({ type: "delete", interaction })}
                            />
                        ),
                    };
                }

                if (columnId === "receipt_at") {
                    return {
                        ...column,
                        header: t("gridMain.columns.Date"),
                        cell: ({ row }) => (
                            <span className="text-sm text-slate-600">
                                {formatInteractionDate(row.original.receipt_at)}
                            </span>
                        ),
                    };
                }

                if (columnId === "description") {
                    return {
                        ...column,
                        header: t("gridMain.columns.Subject"),
                        cell: ({ row }) => (
                            <span className="block max-w-[36rem] truncate text-sm font-semibold text-slate-900">
                                {getInteractionSubject(row.original) || t("interactions.detail.noSubject")}
                            </span>
                        ),
                    };
                }

                if (columnId === "client_identifier") {
                    return {
                        ...column,
                        header: t("interactions.table.sender"),
                        cell: ({ row }) => (
                            <span className="block max-w-[18rem] truncate text-sm text-slate-900">
                                {getInteractionSender(row.original) || "-"}
                            </span>
                        ),
                    };
                }

                if (columnId === "status") {
                    return {
                        ...column,
                        header: t("gridMain.columns.Status"),
                        // "status" is derived (is_closed/in_review), not a real column.
                        // The backend (InteractionSearcher + KnexInteractionRepository)
                        // translates this sort field into a CASE expression.
                        enableSorting: true,
                        meta: { ...column.meta, sortField: "status" },
                        cell: ({ row }) => (
                            <span
                                className={`inline-flex min-w-16 items-center justify-center rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusClassName(
                                    row.original,
                                )}`}
                            >
                                {getInteractionStatusLabel(row.original, t)}
                            </span>
                        ),
                    };
                }

                return column;
            }),
        [actionPermissions, t],
    );

    const { renderData, query, filters, pagination, columnSelector } = useDataTable({
        dataTableConfig: interactionsDataTableConfig,
        actions: tableActions,
        processFilters: processInteractionsFilters,
        processColumns: processInteractionsColumns,
        includeColumns: includeInteractionsColumns,
        processData: processInteractionsData,
        processSchema: processInteractionsSchema,
        tableFilters,
        transformFiltersBeforeQuery: appendSystemInboxInteractionFilter,
    });

    const visibleInteractions = useMemo(
        () => renderData.rows.map((row) => getInteractionFromRow(row)).filter((interaction) => interaction?.id),
        [renderData.rows, getInteractionFromRow],
    );
    const allIds = useMemo(() => visibleInteractions.map((interaction) => interaction.id), [visibleInteractions]);
    const visibleIdSet = useMemo(() => new Set(allIds), [allIds]);
    // Selection persists across pages (stored per workspace scope), so the bulk
    // count and the bulk operations use the full selection, not just the visible
    // page. Mirrors the Cases data table behaviour.
    const selectedInteractionIds = useMemo(
        () => selectedInteractions.map((interaction) => interaction?.id).filter(Boolean),
        [selectedInteractions],
    );
    const selectedIdSet = useMemo(() => new Set(selectedInteractionIds), [selectedInteractionIds]);
    const isAllSelected = allIds.length > 0 && allIds.every((id) => selectedIdSet.has(id));

    const toggleVisibleInteractions = useCallback(() => {
        setSelectedInteractions((previousSelection) => {
            const previousSelectedIds = new Set(
                previousSelection.map((interaction) => interaction?.id).filter(Boolean),
            );
            const allVisibleSelected = allIds.length > 0 && allIds.every((id) => previousSelectedIds.has(id));

            if (allVisibleSelected) {
                return previousSelection.filter((interaction) => !visibleIdSet.has(interaction?.id));
            }

            const nextSelectionById = new Map(
                previousSelection
                    .filter((interaction) => interaction?.id)
                    .map((interaction) => [interaction.id, interaction]),
            );
            visibleInteractions.forEach((interaction) => nextSelectionById.set(interaction.id, interaction));

            return Array.from(nextSelectionById.values());
        });
    }, [allIds, setSelectedInteractions, visibleIdSet, visibleInteractions]);

    const closeBulkModal = useCallback(() => setActiveBulkModal(null), []);

    const handleViewModalOpenChange = useCallback((open) => {
        if (!open) {
            setInteractionToView(null);
        }
    }, []);

    const refreshInteractions = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: [URL_AND_KEYS.interactions.key] });
        query?.refetch?.();
        query?.handleRefresh?.();
    }, [query, queryClient]);

    const handleReviewChange = useCallback(
        (updatedInteraction) => {
            setInteractionToView((currentInteraction) => {
                if (!currentInteraction?.id) {
                    return currentInteraction;
                }

                const refreshedInteraction = visibleInteractions.find(
                    (interaction) =>
                        isSameInteractionId(interaction?.id, currentInteraction.id) &&
                        hasReviewStateChanged(currentInteraction, interaction),
                );
                const responseInteraction = isSameInteractionId(updatedInteraction?.id, currentInteraction.id)
                    ? updatedInteraction
                    : null;
                const nextInteraction = responseInteraction ?? refreshedInteraction;

                if (!nextInteraction) {
                    return currentInteraction;
                }

                return {
                    ...currentInteraction,
                    ...nextInteraction,
                };
            });
            refreshInteractions();
        },
        [refreshInteractions, visibleInteractions],
    );

    const handleBulkSuccess = useCallback(
        (messageKey) => {
            toast.success(t(messageKey));
            refreshInteractions();
            clearSelectedInteractions();
            closeBulkModal();
        },
        [clearSelectedInteractions, closeBulkModal, refreshInteractions, t],
    );

    const handleBulkError = useCallback(
        (error) => {
            toast.error(getTranslatedError(error, t) || t("interactions.bulk.messages.error"));
        },
        [t],
    );

    const handleMoveSubmit = useCallback(
        async ({ workspace_id }) => {
            if (isSystemInboxWorkspaceId(workspace_id)) return;
            try {
                await moveMutation.mutateAsync({
                    interaction_ids: selectedInteractionIds,
                    workspace_id,
                });
                handleBulkSuccess("interactions.bulk.messages.moveSuccess");
            } catch (error) {
                handleBulkError(error);
            }
        },
        [handleBulkError, handleBulkSuccess, moveMutation, selectedInteractionIds],
    );

    const handleCloseSubmit = useCallback(
        async ({ motive }) => {
            try {
                await closeMutation.mutateAsync({
                    interaction_ids: selectedInteractionIds,
                    motive,
                });
                handleBulkSuccess("interactions.bulk.messages.closeSuccess");
            } catch (error) {
                handleBulkError(error);
            }
        },
        [closeMutation, handleBulkError, handleBulkSuccess, selectedInteractionIds],
    );

    const handleDeleteSubmit = useCallback(
        async ({ motive }) => {
            try {
                await deleteMutation.mutateAsync({
                    interaction_ids: selectedInteractionIds,
                    motive,
                });
                handleBulkSuccess("interactions.bulk.messages.deleteSuccess");
            } catch (error) {
                handleBulkError(error);
            }
        },
        [deleteMutation, handleBulkError, handleBulkSuccess, selectedInteractionIds],
    );

    const handleSingleActionSuccess = useCallback(
        (messageKey) => {
            toast.success(t(messageKey));
            refreshInteractions();
        },
        [refreshInteractions, t],
    );

    const handleSingleMoveSubmit = useCallback(
        async (interaction, { workspace_id }) => {
            if (isSystemInboxWorkspaceId(workspace_id)) return;
            try {
                await moveMutation.mutateAsync({
                    interaction_ids: [interaction.id],
                    workspace_id,
                });
                handleSingleActionSuccess("interactions.bulk.messages.moveSuccess");
            } catch (error) {
                handleBulkError(error);
                throw error;
            }
        },
        [handleBulkError, handleSingleActionSuccess, moveMutation],
    );

    const handleSingleCloseSubmit = useCallback(
        async (interaction, { motive }) => {
            try {
                await closeMutation.mutateAsync({
                    interaction_ids: [interaction.id],
                    motive,
                });
                handleSingleActionSuccess("interactions.bulk.messages.closeSuccess");
            } catch (error) {
                handleBulkError(error);
                throw error;
            }
        },
        [closeMutation, handleBulkError, handleSingleActionSuccess],
    );

    const handleSingleDeleteSubmit = useCallback(
        async (interaction, { motive }) => {
            try {
                await deleteMutation.mutateAsync({
                    interaction_ids: [interaction.id],
                    motive,
                });
                handleSingleActionSuccess("interactions.bulk.messages.deleteSuccess");
            } catch (error) {
                handleBulkError(error);
                throw error;
            }
        },
        [deleteMutation, handleBulkError, handleSingleActionSuccess],
    );

    const processedHeaderWithCheckbox = useMemo(
        () => [
            {
                id: "__select__",
                colSpan: 1,
                content: (
                    <input
                        type="checkbox"
                        aria-label={t("interactions.bulk.selectAll")}
                        checked={isAllSelected}
                        onChange={toggleVisibleInteractions}
                    />
                ),
            },
            ...renderData.processedHeader,
        ],
        [isAllSelected, renderData.processedHeader, t, toggleVisibleInteractions],
    );

    const rowsWithCheckbox = useMemo(
        () =>
            renderData.rows.map((row) => {
                const interaction = getInteractionFromRow(row);

                return {
                    ...row,
                    mainRow: {
                        ...row.mainRow,
                        cells: [
                            {
                                id: "__select__",
                                content: (
                                    <input
                                        type="checkbox"
                                        aria-label={t("interactions.bulk.selectRow")}
                                        checked={selectedIdSet.has(interaction?.id)}
                                        onChange={() => toggleInteraction(row)}
                                    />
                                ),
                            },
                            ...row.mainRow.cells,
                        ],
                    },
                };
            }),
        [getInteractionFromRow, renderData.rows, selectedIdSet, t, toggleInteraction],
    );

    const bulkActions = useMemo(
        () => ({
            selectedCount: selectedInteractionIds.length,
            onClearSelection: () => setSelectedInteractions([]),
            actions: [
                actionPermissions.canBulkMove
                    ? {
                          label: t("interactions.bulk.move"),
                          onClick: () => setActiveBulkModal("move"),
                      }
                    : null,
                actionPermissions.canBulkClose
                    ? {
                          label: t("interactions.bulk.close"),
                          onClick: () => setActiveBulkModal("close"),
                      }
                    : null,
                actionPermissions.canBulkDelete
                    ? {
                          label: t("interactions.bulk.delete"),
                          onClick: () => setActiveBulkModal("delete"),
                      }
                    : null,
            ].filter(Boolean),
        }),
        [
            actionPermissions.canBulkClose,
            actionPermissions.canBulkDelete,
            actionPermissions.canBulkMove,
            selectedInteractionIds.length,
            setSelectedInteractions,
            t,
        ],
    );

    return (
        <div className="flex w-full flex-col gap-4">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                    type="search"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder={t("interactions.title.searchPlaceholder", "Buscar interacciones")}
                    className="h-10 w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                />
            </div>

            <DataTable
                renderData={{
                    ...renderData,
                    processedHeader: processedHeaderWithCheckbox,
                    rows: rowsWithCheckbox,
                }}
                query={query}
                filters={filters}
                pagination={pagination}
                columnSelector={columnSelector}
                bulkActions={bulkActions}
            />

            <InteractionsBulkMoveModal
                open={activeBulkModal === "move"}
                onOpenChange={(open) => setActiveBulkModal(open ? "move" : null)}
                onSubmit={handleMoveSubmit}
                isPending={moveMutation.isPending}
                count={selectedInteractionIds.length}
                workspaceOptions={workspaceOptions}
                isLoadingOptions={isLoadingWorkspaces}
            />
            <InteractionsBulkMotiveModal
                open={activeBulkModal === "close"}
                onOpenChange={(open) => setActiveBulkModal(open ? "close" : null)}
                onSubmit={handleCloseSubmit}
                isPending={closeMutation.isPending}
                count={selectedInteractionIds.length}
                motiveOptions={motiveOptions}
                isLoadingOptions={isLoadingMotiveOptions}
                mode="close"
            />
            <InteractionsBulkMotiveModal
                open={activeBulkModal === "delete"}
                onOpenChange={(open) => setActiveBulkModal(open ? "delete" : null)}
                onSubmit={handleDeleteSubmit}
                isPending={deleteMutation.isPending}
                count={selectedInteractionIds.length}
                motiveOptions={motiveOptions}
                isLoadingOptions={isLoadingMotiveOptions}
                mode="delete"
            />
            <InteractionMotiveDialog
                open={activeRowActionDialog?.type === "close"}
                onOpenChange={(open) => !open && setActiveRowActionDialog(null)}
                interaction={activeRowActionDialog?.interaction}
                motiveOptions={motiveOptions}
                isLoadingOptions={isLoadingMotiveOptions}
                isPending={closeMutation.isPending}
                onSubmit={async ({ motive }) => {
                    await handleSingleCloseSubmit(activeRowActionDialog.interaction, { motive });
                    setActiveRowActionDialog(null);
                }}
                mode="close"
                t={t}
            />
            <InteractionMotiveDialog
                open={activeRowActionDialog?.type === "delete"}
                onOpenChange={(open) => !open && setActiveRowActionDialog(null)}
                interaction={activeRowActionDialog?.interaction}
                motiveOptions={motiveOptions}
                isLoadingOptions={isLoadingMotiveOptions}
                isPending={deleteMutation.isPending}
                onSubmit={async ({ motive }) => {
                    await handleSingleDeleteSubmit(activeRowActionDialog.interaction, { motive });
                    setActiveRowActionDialog(null);
                }}
                mode="delete"
                t={t}
            />
            <InteractionDetailModal
                open={Boolean(interactionToView)}
                onOpenChange={handleViewModalOpenChange}
                interaction={interactionToView}
                workspaceOptions={workspaceOptions}
                motiveOptions={motiveOptions}
                isLoadingWorkspaces={isLoadingWorkspaces}
                isLoadingMotiveOptions={isLoadingMotiveOptions}
                isMovingInteraction={moveMutation.isPending}
                isClosingInteraction={closeMutation.isPending}
                isDeletingInteraction={deleteMutation.isPending}
                onMoveInteraction={handleSingleMoveSubmit}
                onCloseInteraction={handleSingleCloseSubmit}
                onDeleteInteraction={handleSingleDeleteSubmit}
                onReviewChange={handleReviewChange}
            />
        </div>
    );
};

InteractionsDataTable.propTypes = {
    actions: PropTypes.array,
    selectedWorkspace: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

export default InteractionsDataTable;
