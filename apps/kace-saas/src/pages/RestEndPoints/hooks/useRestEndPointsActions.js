import { WS_REST_ENDPOINTS_SERVICE } from "../../../utils/URL";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { fetchDelete } from "@/services/deleteService";

const useRestEndpointsActions = () => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    const { mutate } = useMutation({
        mutationFn: async (id) => fetchDelete(id, WS_REST_ENDPOINTS_SERVICE),
        onMutate: async (id) => {
            await queryClient.cancelQueries(["wsRestEndpointsData"]);
            const previousGroups = queryClient.getQueryData(["wsRestEndpointsData"]);
            queryClient.setQueryData(["wsRestEndpointsData"], (old) => {
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
            queryClient.setQueryData(["wsRestEndpointsData"], context.previousGroups);
            toast.error(t("app.error.restEndPoint"));
        },
        onSuccess: () => {
            queryClient.invalidateQueries(["wsRestEndpointsData"]);
            toast.success(t("app.forms.success_delete_module", { module: t("app.title.restEndPoint") }));
        },
    });

    return {
        handleDeleteRestEndpoints: (id) => {
            mutate(id);
        },
        handleUpdateRestEndpoints: (id) => {
            navigate(`/rest-endpoints/update/${id}`);
        },
        handleSeeRestEndpoints: (id) => {
            navigate(`/rest-endpoints/update/${id}?action=see`);
        },
    };
};

export default useRestEndpointsActions;
