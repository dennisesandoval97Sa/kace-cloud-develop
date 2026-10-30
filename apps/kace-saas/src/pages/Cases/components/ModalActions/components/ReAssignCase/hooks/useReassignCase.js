import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useDispatch } from "react-redux";
import { setOpenModal } from "@/redux/state/modalBehavior";
import { postCasesBulkAssign } from "@kace_v2/features/boards/services/cases-bulk.service";
import {
    runCaseBulkChunks,
    parseBulkAssignResponses,
    resolveBulkOutcomeIds,
    isResponsibleUnavailableError,
} from "@kace_v2/features/boards/utils/boardCasesBulk.utils";
import useSelectedCase from "../../../hooks/useSelectedCase";
import useSelectedCases from "@/pages/Cases/hooks/useSelectedCases";
import { getTranslatedError } from "@/utils/getTranslatedError";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";

export const useReassignCase = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const queryClient = useQueryClient();
    const { caseSelect } = useSelectedCase();
    const { selectedCases, clearSelectedCases } = useSelectedCases();

    const caseIds = useMemo(() => {
        if (caseSelect?.data?.id) {
            return [caseSelect.data.id];
        }
        if (selectedCases?.length > 0) {
            return selectedCases.map((c) => c.id);
        }
        return [];
    }, [caseSelect?.data?.id, selectedCases]);

    const { mutateAsync, isPending } = useMutation({ mutationFn: postCasesBulkAssign });

    const reassign = async (groupId, responsibleId, { combined = false } = {}) => {
        if (!caseIds.length) return;
        try {
            const { processedCount, successIds, responses } = await runCaseBulkChunks(
                caseIds,
                mutateAsync,
                (chunk) => ({
                    case_ids: chunk,
                    group_id: groupId,
                    responsible_id: responsibleId || null,
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
                    toast.warning(t("boards.bulkActions.apiErrors.couldNotAssignResponsible"));
                } else {
                    toast.warning(
                        t("boards.bulkActions.partialAssignment", {
                            assigned,
                            skipped: totalSkipped,
                        }),
                    );
                }
            } else {
                toast.success(t("genericTexts.EverythingOk"));
            }

            if (!combined) {
                queryClient.invalidateQueries({ queryKey: [URL_AND_KEYS.cases.key], exact: false });
                if (assigned > 0) {
                    clearSelectedCases();
                    dispatch(setOpenModal(false));
                }
                return;
            }

            if (isPartial && totalSkipped > 0) {
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

            return {
                processed: processedCount,
                total: caseIds.length,
                successIds,
                failedIds: caseIds.filter((id) => !successIds.includes(id)),
            };
        } catch (error) {
            queryClient.invalidateQueries({ queryKey: [URL_AND_KEYS.cases.key], exact: false });
            const translated = getTranslatedError(error, t);
            if (isResponsibleUnavailableError(error, translated, t)) {
                toast.warning(translated);
            } else {
                toast.error(translated);
            }
            if (!combined) {
                clearSelectedCases();
                return;
            }
            error.bulkProcessedCount = error?.bulkProcessedCount ?? 0;
            error.bulkTotalCount = error?.bulkTotalCount ?? caseIds.length;
            error.bulkFailedIds = error?.bulkFailedIds ?? caseIds;
            throw error;
        }
    };

    const handleReassignUser = (values, options) => reassign(values?.grupo_id, values?.usuario_id, options);
    const handleReassignGroup = (values, options) => reassign(values?.grupo_id, null, options);

    return {
        handleReassignUser,
        handleReassignGroup,
        isPending,
    };
};
