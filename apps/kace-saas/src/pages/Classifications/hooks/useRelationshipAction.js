import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { sendInformation } from "../../../services/generic-send-information";
import { useTranslation } from "react-i18next";
import { findPublicErrorCode, PUBLIC_ERROR_CODES } from "@kace/error-codes";
import { getTranslatedError } from "@/utils/getTranslatedError";

const useRelationshipAction = (idClasification) => {
    const queryClient = useQueryClient();
    const { t } = useTranslation();
    const { mutate, isPending: deleteGroupLoading } = useMutation({
        mutationFn: sendInformation,
        onMutate: async () => {
            await queryClient.cancelQueries(["classificationAssignData"]);
            const previousClassifications = queryClient.getQueryData(["classificationAssignData"]);

            return { previousClassifications };
        },
        onError: (err, id, context) => {
            if (context?.previousClassifications !== undefined) {
                queryClient.setQueryData(["classificationAssignData"], context.previousClassifications);
            }
            const responseData = err?.response?.data;
            const publicErrorCode = findPublicErrorCode(responseData?.data?.code, responseData?.code);
            if (publicErrorCode === PUBLIC_ERROR_CODES.CLASSIFICATION_GROUP_RELATION_NOT_FOUND) {
                toast.error(t("app.alerts.relationclassificationGroup"));
                return;
            }
            toast.error(getTranslatedError(err, t));
        },
        onSuccess: () => {
            queryClient.invalidateQueries(["classificationAssignData"]);
            toast.success(t("app.forms.success_delete_module", { module: t("app.title.relationshipClassification") }));
        },
        onSettled: () => {
            queryClient.invalidateQueries(["classificationAssignData"]);
        },
    });

    return {
        handleDeleteGroup: (id) => {
            const dataPost = {
                group_id: id,
                classification_id: idClasification,
            };
            const data = {
                id: null,
                url: "classifications-groups-relationships-batch-delete",
                dataPost: [dataPost],
            };
            mutate(data);
        },
        deleteGroupLoading,
    };
};

export default useRelationshipAction;
