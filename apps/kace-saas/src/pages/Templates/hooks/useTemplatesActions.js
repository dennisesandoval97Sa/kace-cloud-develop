import { TEMPLATES_SERVICE } from "../../../utils/URL";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { fetchDelete } from "@/services/deleteService";

const useTemplatesActions = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { mutate } = useMutation({
        mutationFn: async (id) => fetchDelete(id, TEMPLATES_SERVICE),
        onMutate: async (id) => {
            await queryClient.cancelQueries(["templatesData"]);
            const previousGroups = queryClient.getQueryData(["templatesData"]);
            queryClient.setQueryData(["templatesData"], (old) => {
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
            queryClient.setQueryData(["templatesData"], context.previousGroups);
            toast.error(t("app.forms.template_delete_error"));
        },
        onSuccess: () => {
            queryClient.invalidateQueries(["templatesData"]);
            toast.success(t("app.forms.template_delete_success"));
        },
    });

    return {
        handleUpdateTemplate: (id) => {
            navigate(`/templates/update/${id}`);
        },
        handleDeleteTemplate: (id) => {
            mutate(id);
        },
        handleSeeTemplate: (id) => {
            navigate(`/templates/update/${id}?action=see`);
        },
    };
};

export default useTemplatesActions;
