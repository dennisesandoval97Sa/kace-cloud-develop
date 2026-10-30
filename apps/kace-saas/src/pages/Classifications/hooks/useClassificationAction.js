import { CLASSIFICATIONS_SERVICE } from "@kace/utils";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { fetchDelete } from "@/services/deleteService";

const useClassificationAction = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { t } = useTranslation();
    const { mutate } = useMutation({
        mutationFn: async (id) => fetchDelete(id, CLASSIFICATIONS_SERVICE),
        onMutate: async (id) => {
            await queryClient.cancelQueries(["classificationData"]);
            const previousGroups = queryClient.getQueryData(["classificationData"]);
            queryClient.setQueryData(["classificationData"], (old) => {
                if (old && old.data) {
                    return {
                        ...old,
                        data: old.data.filter((item) => item.id !== id),
                    };
                }
                return old;
            });
            return { previousGroups };
        },
        onError: (_err, id, context) => {
            queryClient.setQueryData(["classificationData"], context.previousGroups);
            toast.error(`${t("app.forms.error_delete")} ${t("app.title.classifications")}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(["classificationData"]);
            queryClient.refetchQueries(["classificationData"]);
            toast.success(t("app.forms.success_delete_module", { module: t("app.title.classifications") }));
        },
    });

    return {
        handleUpdateClassificationFlow: (id) => {
            navigate(`/clasificaciones/flujo/update/${id}`);
        },
        handleUpdateClassification: (id) => {
            navigate(`/clasificaciones/update/${id}`);
        },
        handleDeleteClassification: (id) => {
            mutate(id);
        },
        handleSeeClassification: (id) => {
            navigate(`/clasificaciones/update/${id}?action=see`);
        },
        handleAssingForm: (id) => {
            navigate(`/clasificaciones/assignForm/${id}`);
        },
    };
};

export default useClassificationAction;
