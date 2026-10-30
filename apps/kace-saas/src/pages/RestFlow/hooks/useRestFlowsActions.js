import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { WS_REST_FLOWS_SERVICE } from "@kace/urls";
import { fetchDelete } from "@/services/deleteService";

const useRestFlowsActions = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { mutate } = useMutation({
        mutationFn: async (id) => fetchDelete(id, WS_REST_FLOWS_SERVICE),
        onMutate: async (id) => {
            await queryClient.cancelQueries(["wsRestFlowsData"]);
            const previousGroups = queryClient.getQueryData(["wsRestFlowsData"]);
            queryClient.setQueryData(["wsRestFlowsData"], (old) => {
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
            queryClient.setQueryData(["wsRestFlowsData"], context.previousGroups);
            toast.error(t("app.error.restFlow"));
        },
        onSuccess: () => {
            queryClient.invalidateQueries(["wsRestFlowsData"]);
            toast.success(t("app.forms.success_delete_module", { module: t("app.title.restFlow") }));
        },
    });

    return {
        handleDeleteRestFlow: (id) => {
            mutate(id);
        },
        handleUpdateRestFlow: (id) => {
            navigate(`/rest-flows/update/${id}`);
        },
        handleSeeRestFlow: (id) => {
            navigate(`/rest-flows/update/${id}?action=see`);
        },
    };
};

export default useRestFlowsActions;
