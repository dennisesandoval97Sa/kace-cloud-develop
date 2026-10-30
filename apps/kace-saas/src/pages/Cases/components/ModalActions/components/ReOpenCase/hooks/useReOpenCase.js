import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useDispatch } from "react-redux";
import { setOpenModal } from "@/redux/state/modalBehavior";
import { getTranslatedError } from "@/utils/getTranslatedError";
import { sendInformation } from "../../../../../../../services/generic-send-information";
import { URL_AND_KEYS } from "../../../../../../../utils/urlAndKeys";
import useSelectedCase from "../../../hooks/useSelectedCase";

export const useReopenCase = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const queryClient = useQueryClient();
    const { caseSelect } = useSelectedCase();

    const { mutateAsync, isPending } = useMutation({ mutationFn: sendInformation });

    const handleReopenCase = async (values) => {
        const caseId = caseSelect?.data?.id;
        if (!caseId) {
            toast.error(t("app.errors.generic"));
            return;
        }

        try {
            await mutateAsync({
                url: `/${URL_AND_KEYS.cases.reOpenCase}/${caseId}`,
                dataPost: {
                    transicion_id: values.transicion_id,
                    comment: {
                        descripcion: values.descripcion,
                    },
                },
            });
            toast.success(t("genericTexts.EverythingOk"));
            queryClient.invalidateQueries({ queryKey: [URL_AND_KEYS.cases.key], exact: false });
            dispatch(setOpenModal(false));
        } catch (error) {
            toast.error(getTranslatedError(error, t));
        }
    };

    return {
        handleReopenCase,
        isPending,
    };
};
