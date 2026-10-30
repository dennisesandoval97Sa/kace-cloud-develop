import React, { useCallback, useState, useMemo } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Button from "@kace_v2/shared/ui/atoms/Button";
import DropdownMenu from "@kace_v2/shared/ui/molecules/DropdownMenu";
import { ChevronDown } from "lucide-react";
import useCasesBulkPermissions from "@kace_v2/shared/hooks/useCasesBulkPermissions.hook";
import useBoardCasesBulkActions from "@kace_v2/features/boards/hooks/useBoardCasesBulkActions.hook";
import { prefetchCaseAvailableTransitionsOptions } from "@kace_v2/features/boards/hooks/useCaseAvailableTransitionsOptions.hook";
import {
    getBoardColumnValueKey,
    hasSameTransicion,
    partitionClosedCases,
    resolveBoardBulkCapabilities,
} from "@kace_v2/features/boards/utils/boardCasesBulk.utils";
import { isCasesLikeEntity } from "@kace_v2/features/boards/utils/casesEntity.util";
import {
    hasAuxiliaryDeletePermission,
    isDisallowedAuxiliaryDelete,
} from "@kace_v2/features/boards/utils/auxiliary-delete-permission.util";
import { hasAnyMainEntityDependency } from "@kace_v2/features/boards/utils/auxiliary-dependency.util";
import BoardCasesBulkCombinedModal from "@kace_v2/features/boards/components/CombinedBulkActions/BoardCasesBulkCombinedModal";
import BoardCasesBulkDeleteModal from "@kace_v2/features/boards/components/BoardCasesBulkDeleteModal";

const BoardCasesBulkToolbar = ({
    boardId,
    boardConfig,
    selectedRows,
    selectedIds,
    clearSelection,
    permissionScope,
    showBulkDelete,
    permissionsAuxiliaries,
}) => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const bulkPermissions = useCasesBulkPermissions(permissionScope);
    const { canReassign, canChangeState, canClose, missingPermissionKeys } = useMemo(
        () => resolveBoardBulkCapabilities(bulkPermissions),
        [bulkPermissions],
    );

    const [combinedOpen, setCombinedOpen] = useState(false);
    const [changeStateDisabled, setChangeStateDisabled] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);

    const fechaResolucionColumnKey = useMemo(
        () => getBoardColumnValueKey(boardConfig?.columns, boardConfig?.primary_entity, "fecha_resolucion"),
        [boardConfig?.columns, boardConfig?.primary_entity],
    );
    const transicionIdColumnKey = useMemo(
        () => getBoardColumnValueKey(boardConfig?.columns, boardConfig?.primary_entity, "transicion_id"),
        [boardConfig?.columns, boardConfig?.primary_entity],
    );

    const {
        deleteMutation,
        referenceCaseId,
        handleAssignSubmit,
        handleTransitionSubmit,
        handleCloseSubmit,
        handleBulkDeleteSubmit,
        invalidateBoardResources,
    } = useBoardCasesBulkActions({
        boardId,
        primaryEntity: boardConfig?.primary_entity,
        selectedIds,
        selectedRows,
        fechaResolucionColumnKey,
        clearSelection,
        setDeleteOpen,
    });

    const handleOpenCombined = useCallback(() => {
        if (!selectedIds.length) return;
        const { eligibleRows, skippedClosedRows } = partitionClosedCases(selectedRows, fechaResolucionColumnKey);

        if (!eligibleRows.length) {
            toast.error(t("boards.bulkActions.toast.noEligibleCases"));
            return;
        }
        if (skippedClosedRows.length) {
            toast.info(
                t("boards.bulkActions.toast.skippedClosedRemaining", {
                    skipped: skippedClosedRows.length,
                    remaining: eligibleRows.length,
                }),
            );
        }
        /*
         * Calienta las transiciones del caso de referencia (selectedIds[0], el mismo
         * que consume el modal) para que la primera apertura no pinte la sección fría.
         */
        prefetchCaseAvailableTransitionsOptions(queryClient, selectedIds[0]);
        setChangeStateDisabled(!hasSameTransicion(eligibleRows, transicionIdColumnKey));
        setCombinedOpen(true);
    }, [selectedIds, selectedRows, fechaResolucionColumnKey, transicionIdColumnKey, queryClient, t]);

    const onBulkCombinedAction = useCallback(() => {
        if (missingPermissionKeys.length) {
            toast.error(
                t("boards.bulkActions.missingPermissions", {
                    permissions: missingPermissionKeys.map((key) => t(key)).join(", "),
                }),
            );
            return;
        }
        handleOpenCombined();
    }, [missingPermissionKeys, handleOpenCombined, t]);

    const hasDependency = useMemo(
        () => hasAnyMainEntityDependency(selectedRows, boardConfig?.columns, boardConfig?.primary_entity),
        [selectedRows, boardConfig?.columns, boardConfig?.primary_entity],
    );

    const canDeleteAux = useMemo(
        () => hasAuxiliaryDeletePermission(permissionsAuxiliaries, boardConfig?.primary_entity),
        [permissionsAuxiliaries, boardConfig?.primary_entity],
    );

    const isDisallowedAux = useMemo(
        () => isDisallowedAuxiliaryDelete(boardConfig?.primary_entity),
        [boardConfig?.primary_entity],
    );

    const onBulkDelete = useCallback(() => {
        if (hasDependency || !canDeleteAux) return;
        setDeleteOpen(true);
    }, [hasDependency, canDeleteAux]);

    const isCasesBoard = isCasesLikeEntity(boardConfig?.primary_entity);

    const dropdownOptions = useMemo(() => {
        const options = [];
        if (isCasesBoard) {
            options.push({ label: t("boards.bulkActions.toolbar.bulkActions"), fn: onBulkCombinedAction });
        }
        if (showBulkDelete) {
            const isDeleteDisabled = hasDependency || !canDeleteAux;
            const deleteTooltip = hasDependency
                ? t("boards.boardView.bulkDeleteDependencyTooltip")
                : isDisallowedAux
                  ? t("boards.boardView.bulkDeleteDisallowedTooltip")
                  : !canDeleteAux
                    ? t("boards.boardView.deleteRecordPermissionTooltip")
                    : undefined;
            options.push({
                label: t("boards.bulkActions.menu.deleteRecords"),
                fn: onBulkDelete,
                disabled: isDeleteDisabled,
                tooltip: deleteTooltip,
            });
        }
        return options;
    }, [
        isCasesBoard,
        showBulkDelete,
        hasDependency,
        canDeleteAux,
        isDisallowedAux,
        t,
        onBulkCombinedAction,
        onBulkDelete,
    ]);

    if (!selectedIds.length) {
        return null;
    }

    const selectedCountKey = isCasesBoard
        ? "boards.bulkActions.toolbar.selectedCount"
        : "boards.bulkActions.toolbar.selectedCountRecords";

    /*
     * Con una sola opción disponible (ej. sin permiso/soporte de borrado masivo), el
     * desplegable solo repetiría la misma etiqueta del botón — se ejecuta directo en 1 clic.
     */
    const singleOption = dropdownOptions.length === 1 ? dropdownOptions[0] : null;

    return (
        <>
            <div className="flex flex-wrap items-center gap-2 py-2">
                <span className="text-sm font-medium">{t(selectedCountKey, { count: selectedIds.length })}</span>
                {singleOption ? (
                    <Button
                        variant="secondary"
                        size="sm"
                        disabled={singleOption.disabled}
                        title={singleOption.tooltip}
                        onClick={singleOption.fn}
                    >
                        {singleOption.label}
                    </Button>
                ) : (
                    <DropdownMenu
                        label={t("boards.bulkActions.toolbar.bulkActions")}
                        options={dropdownOptions}
                        onSelect={(option) => {
                            if (typeof option.fn === "function") option.fn();
                        }}
                    >
                        <Button variant="secondary" size="sm" className="gap-1">
                            {t("boards.bulkActions.toolbar.bulkActions")}
                            <ChevronDown className="h-4 w-4" />
                        </Button>
                    </DropdownMenu>
                )}
                <Button variant="outline" size="sm" onClick={clearSelection}>
                    {t("boards.bulkActions.toolbar.clearSelection")}
                </Button>
            </div>
            {isCasesBoard && (
                <BoardCasesBulkCombinedModal
                    open={combinedOpen}
                    onOpenChange={setCombinedOpen}
                    referenceCaseId={referenceCaseId}
                    selectedCount={selectedIds.length}
                    canReassign={canReassign}
                    canChangeState={canChangeState}
                    changeStateDisabled={changeStateDisabled}
                    canClose={canClose}
                    handleAssignSubmit={handleAssignSubmit}
                    handleTransitionSubmit={handleTransitionSubmit}
                    handleCloseSubmit={handleCloseSubmit}
                    invalidateBoardResources={invalidateBoardResources}
                    clearSelection={clearSelection}
                />
            )}
            {showBulkDelete && (
                <BoardCasesBulkDeleteModal
                    open={deleteOpen}
                    onOpenChange={(open) => {
                        if (!open && deleteMutation.isPending) return;
                        setDeleteOpen(open);
                    }}
                    count={selectedIds.length}
                    isPending={deleteMutation.isPending}
                    onSubmit={handleBulkDeleteSubmit}
                />
            )}
        </>
    );
};

BoardCasesBulkToolbar.propTypes = {
    boardId: PropTypes.string.isRequired,
    boardConfig: PropTypes.object,
    selectedIds: PropTypes.arrayOf(PropTypes.string).isRequired,
    selectedRows: PropTypes.array.isRequired,
    clearSelection: PropTypes.func.isRequired,
    permissionScope: PropTypes.oneOf(["admin", "agent"]).isRequired,
    showBulkDelete: PropTypes.bool,
    permissionsAuxiliaries: PropTypes.array,
};

export default BoardCasesBulkToolbar;
