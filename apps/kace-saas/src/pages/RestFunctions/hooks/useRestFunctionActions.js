import { WS_REST_FUNCTIONS_SERVICE } from "../../../utils/URL";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchDelete } from "@/services/deleteService";

const useRestFunctionActions = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { mutate } = useMutation({
        mutationFn: async (id) => fetchDelete(id, WS_REST_FUNCTIONS_SERVICE),
        onMutate: async (id) => {
            await queryClient.cancelQueries(["wsRestFunctionsData"]);
            const previousGroups = queryClient.getQueryData(["wsRestFunctionsData"]);
            queryClient.setQueryData(["wsRestFunctionsData"], (old) => {
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
            queryClient.setQueryData(["wsRestFunctionsData"], context.previousGroups);
            toast.error(t("app.error.restFunction"));
        },
        onSuccess: () => {
            queryClient.invalidateQueries(["wsRestFunctionsData"]);
            toast.success(t("app.forms.success_delete_module", { module: t("app.title.restFunction") }));
        },
    });

    return {
        handleDeleteRestFunction: (id) => {
            mutate(id);
        },
        handleUpdateRestFunction: (id) => {
            navigate(`/rest-functions/update/${id}`);
        },
        handleSeeRestFunction: (id) => {
            navigate(`/rest-functions/update/${id}?action=see`);
        },
    };
};

export default useRestFunctionActions;
