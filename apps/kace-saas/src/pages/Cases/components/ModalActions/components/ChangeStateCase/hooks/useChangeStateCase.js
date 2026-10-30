import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useDispatch } from "react-redux";
import { setOpenModal } from "@/redux/state/modalBehavior";
import { postCasesBulkTransition } from "@kace_v2/features/boards/services/cases-bulk.service";
import useSelectedCases from "@/pages/Cases/hooks/useSelectedCases";
import { getTranslatedError } from "@/utils/getTranslatedError";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";

export const useChangeStateCase = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const queryClient = useQueryClient();
    const { selectedCases, clearSelectedCases } = useSelectedCases();
    const caseIds = selectedCases.map((c) => c.id);

    const { mutateAsync, isPending } = useMutation({ mutationFn: postCasesBulkTransition });

    const handleChangeState = async (values, { combined = false } = {}) => {
        if (!caseIds.length) return;
        try {
            await mutateAsync({ transition_id: values.transicion_id, case_ids: caseIds });
            toast.success(t("genericTexts.EverythingOk"));

            queryClient.invalidateQueries({
                queryKey: [[URL_AND_KEYS.cases.urlCaseAvailableStates]],
                exact: false,
            });
            if (!combined) {
                queryClient.invalidateQueries({ queryKey: [URL_AND_KEYS.cases.key], exact: false });
                clearSelectedCases();
                dispatch(setOpenModal(false));
                return;
            }
            return { processed: caseIds.length, total: caseIds.length, successIds: caseIds, failedIds: [] };
        } catch (error) {
            toast.error(getTranslatedError(error, t));
            if (combined) {
                error.bulkProcessedCount = error?.bulkProcessedCount ?? 0;
                error.bulkTotalCount = error?.bulkTotalCount ?? caseIds.length;
                error.bulkFailedIds = error?.bulkFailedIds ?? caseIds;
                throw error;
            }
        }
    };

    return { handleChangeState, isPending };
};
