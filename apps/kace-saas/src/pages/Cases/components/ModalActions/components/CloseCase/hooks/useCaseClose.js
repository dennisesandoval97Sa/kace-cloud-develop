import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useDispatch } from "react-redux";
import { setOpenModal } from "@/redux/state/modalBehavior";
import { postCasesBulkClose } from "@kace_v2/features/boards/services/cases-bulk.service";
import useSelectedCase from "../../../hooks/useSelectedCase";
import useSelectedCases from "@/pages/Cases/hooks/useSelectedCases";
import { sendInformation } from "@/services/generic-send-information";
import { getTranslatedError } from "@/utils/getTranslatedError";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";

const closeCases = ({ caseIds, closeReason, isSelection }) => {
    if (isSelection) return postCasesBulkClose({ case_ids: caseIds, close_reason: closeReason });
    const url = `${URL_AND_KEYS.cases.urlCaseClose}/${caseIds[0]}`;
    return sendInformation({ url, dataPost: { motivo_baja: closeReason } });
};

const useCaseClose = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const queryClient = useQueryClient();
    const { caseSelect } = useSelectedCase();
    const singleCase = caseSelect?.data;

    const { selectedCases, clearSelectedCases } = useSelectedCases();

    const isSelection = selectedCases?.length > 0;
    const casesToProcess = isSelection ? selectedCases : singleCase ? [singleCase] : [];
    const caseIds = casesToProcess.map((c) => c.id);

    const { mutateAsync, isPending } = useMutation({ mutationFn: closeCases });

    const handleCaseClose = async (values, { combined = false } = {}) => {
        if (!caseIds.length) return;
        try {
            await mutateAsync({ caseIds, closeReason: values.motivo_baja, isSelection });
            toast.success(t("genericTexts.EverythingOk"));
            if (!combined) {
                queryClient.invalidateQueries({ queryKey: [URL_AND_KEYS.cases.key], exact: false });
                clearSelectedCases();
                dispatch(setOpenModal(false));
                return;
            }
            return { processed: caseIds.length, total: caseIds.length, successIds: caseIds, failedIds: [] };
        } catch (error) {
            toast.error(getTranslatedError(error, t));
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

    return { handleCaseClose, isPending };
};

export default useCaseClose;
