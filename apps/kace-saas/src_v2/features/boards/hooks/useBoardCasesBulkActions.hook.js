import { useCallback, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
    postCasesBulkAssign,
    postCasesBulkClose,
    postCasesBulkTransition,
} from "@kace_v2/features/boards/services/cases-bulk.service";
import { postAuxCasesBulkDelete } from "@kace_v2/features/boards/services/boards.service";
import {
    chunkCaseIds,
    getEligibleCaseIds,
    runCaseBulkChunks,
    parseBulkAssignResponses,
    resolveBulkOutcomeIds,
    isResponsibleUnavailableError,
} from "@kace_v2/features/boards/utils/boardCasesBulk.utils";
import { getTranslatedError } from "@/utils/getTranslatedError";

const useBoardCasesBulkActions = ({
    boardId,
    primaryEntity,
    selectedRows = [],
    selectedIds = [],
    fechaResolucionColumnKey,
    clearSelection,
    setDeleteOpen,
}) => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();

    const assignMutation = useMutation({ mutationFn: postCasesBulkAssign });
    const transitionMutation = useMutation({ mutationFn: postCasesBulkTransition });
    const closeMutation = useMutation({ mutationFn: postCasesBulkClose });
    const deleteMutation = useMutation({
        mutationFn: async ({ entity, payload }) => {
            if (!entity) {
                throw new Error("entity is required");
            }
            return postAuxCasesBulkDelete({ entity, payload });
        },
    });

    const invalidateBoardResources = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ["boards", "resources", boardId] });
    }, [queryClient, boardId]);

    const referenceCaseId = useMemo(() => selectedIds[0] ?? null, [selectedIds]);

    const handleBulkMutationError = useCallback(
        (error, caseIds, toastId, onPartialCleanup) => {
            const processed = error?.bulkProcessedCount ?? 0;
            const total = error?.bulkTotalCount ?? caseIds.length;
            if (processed > 0) {
                toast.error(
                    t("boards.bulkActions.partialError", {
                        processed,
                        total,
                        errorDetail: getTranslatedError(error, t),
                    }),
                    { id: toastId },
                );
                invalidateBoardResources();
                clearSelection();
                onPartialCleanup();
            } else {
                toast.error(getTranslatedError(error, t), { id: toastId });
            }
        },
        [clearSelection, invalidateBoardResources, t],
    );

    const enrichCombinedError = useCallback((error, caseIds) => {
        error.bulkProcessedCount = error?.bulkProcessedCount ?? 0;
        error.bulkTotalCount = error?.bulkTotalCount ?? caseIds.length;
        error.bulkSuccessIds = error?.bulkSuccessIds ?? [];
        error.bulkFailedIds = error?.bulkFailedIds ?? caseIds;
        return error;
    }, []);

    const handleAssignSubmit = useCallback(
        async ({ group_id, responsible_id }) => {
            const caseIds = getEligibleCaseIds(selectedRows, fechaResolucionColumnKey);
            if (!caseIds.length) return { processed: 0, total: 0, successIds: [], failedIds: [] };
            const toastId = toast.loading(t("boards.bulkActions.processing"));
            try {
                const { processedCount, successIds, responses } = await runCaseBulkChunks(
                    caseIds,
                    assignMutation.mutateAsync,
                    (chunk) => ({
                        case_ids: chunk,
                        group_id,
                        responsible_id: responsible_id || null,
                    }),
                );

                const {
                    totalSkipped,
                    totalAssigned: assigned,
                    isPartial,
                    allSkippedIds,
                } = parseBulkAssignResponses(responses, caseIds.length);

                if (isPartial && totalSkipped > 0) {
                    if (assigned === 0) {
                        toast.warning(t("boards.bulkActions.apiErrors.couldNotAssignResponsible"), { id: toastId });
                    } else {
                        toast.warning(
                            t("boards.bulkActions.partialAssignment", {
                                assigned,
                                skipped: totalSkipped,
                            }),
                            { id: toastId },
                        );
                    }
                    const { successIds: resolvedSuccessIds, failedIds: resolvedFailedIds } = resolveBulkOutcomeIds(
                        caseIds,
                        successIds,
                        assigned,
                        allSkippedIds,
                    );

                    return {
                        processed: assigned,
                        total: caseIds.length,
                        successIds: resolvedSuccessIds,
                        failedIds: resolvedFailedIds,
                    };
                }

                toast.success(t("boards.bulkActions.operationCompleted"), { id: toastId });
                return {
                    processed: processedCount,
                    total: caseIds.length,
                    successIds,
                    failedIds: caseIds.filter((id) => !successIds.includes(id)),
                };
            } catch (error) {
                const translated = getTranslatedError(error, t);
                if (isResponsibleUnavailableError(error, translated, t)) {
                    toast.warning(translated, { id: toastId });
                } else {
                    toast.error(translated, { id: toastId });
                }
                throw enrichCombinedError(error, caseIds);
            }
        },
        [assignMutation.mutateAsync, enrichCombinedError, fechaResolucionColumnKey, selectedRows, t],
    );

    const handleTransitionSubmit = useCallback(
        async (transitionId) => {
            const caseIds = getEligibleCaseIds(selectedRows, fechaResolucionColumnKey);
            if (!caseIds.length) return { processed: 0, total: 0, successIds: [], failedIds: [] };
            const toastId = toast.loading(t("boards.bulkActions.processing"));
            try {
                const { processedCount, successIds } = await runCaseBulkChunks(
                    caseIds,
                    transitionMutation.mutateAsync,
                    (chunk) => ({
                        case_ids: chunk,
                        transition_id: transitionId,
                    }),
                );
                toast.success(t("boards.bulkActions.operationCompleted"), { id: toastId });
                queryClient.invalidateQueries({ queryKey: ["case-available-states", "board-bulk"] });
                return {
                    processed: processedCount,
                    total: caseIds.length,
                    successIds,
                    failedIds: caseIds.filter((id) => !successIds.includes(id)),
                };
            } catch (error) {
                toast.error(getTranslatedError(error, t), { id: toastId });
                throw enrichCombinedError(error, caseIds);
            }
        },
        [enrichCombinedError, fechaResolucionColumnKey, queryClient, selectedRows, t, transitionMutation.mutateAsync],
    );

    const handleCloseSubmit = useCallback(
        async (closeReason) => {
            const caseIds = getEligibleCaseIds(selectedRows, fechaResolucionColumnKey);
            if (!caseIds.length) return { processed: 0, total: 0, successIds: [], failedIds: [] };
            const toastId = toast.loading(t("boards.bulkActions.processing"));
            try {
                const { processedCount, successIds } = await runCaseBulkChunks(
                    caseIds,
                    closeMutation.mutateAsync,
                    (chunk) => ({
                        case_ids: chunk,
                        close_reason: closeReason,
                    }),
                );
                toast.success(t("boards.bulkActions.operationCompleted"), { id: toastId });
                return {
                    processed: processedCount,
                    total: caseIds.length,
                    successIds,
                    failedIds: caseIds.filter((id) => !successIds.includes(id)),
                };
            } catch (error) {
                toast.error(getTranslatedError(error, t), { id: toastId });
                throw enrichCombinedError(error, caseIds);
            }
        },
        [closeMutation.mutateAsync, enrichCombinedError, fechaResolucionColumnKey, selectedRows, t],
    );

    const handleBulkDeleteSubmit = useCallback(async () => {
        if (!selectedIds.length) return;
        const entity = primaryEntity?.startsWith("aux_") ? primaryEntity.slice(4) : primaryEntity;
        if (!entity) return;
        const toastId = toast.loading(t("boards.bulkActions.processing"));
        try {
            const chunks = chunkCaseIds(selectedIds);
            let totalBlocked = 0;
            for (const chunk of chunks) {
                const result = await deleteMutation.mutateAsync({ entity, payload: { ids: chunk } });
                totalBlocked += result?.data?.data?.blocked?.length ?? 0;
            }
            if (totalBlocked > 0) {
                toast.warning(t("boards.bulkActions.partialDeleteBlocked", { count: totalBlocked }), { id: toastId });
            } else {
                toast.success(t("boards.bulkActions.operationCompleted"), { id: toastId });
            }
            setDeleteOpen(false);
            invalidateBoardResources();
            clearSelection();
        } catch (error) {
            handleBulkMutationError(error, selectedIds, toastId, () => setDeleteOpen(false));
        }
    }, [
        clearSelection,
        deleteMutation,
        handleBulkMutationError,
        invalidateBoardResources,
        primaryEntity,
        selectedIds,
        setDeleteOpen,
        t,
    ]);

    return {
        assignMutation,
        transitionMutation,
        closeMutation,
        deleteMutation,
        referenceCaseId,
        handleAssignSubmit,
        handleTransitionSubmit,
        handleCloseSubmit,
        handleBulkDeleteSubmit,
        invalidateBoardResources,
    };
};

export default useBoardCasesBulkActions;
