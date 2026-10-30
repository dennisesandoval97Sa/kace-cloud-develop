import { GROUP_SERVICE } from "../../../utils/URL";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { apiService } from "@/utils/main";
import { resolveGroupDeleteErrorMessage } from "../utils/resolveGroupDeleteErrorMessage";

const useActionsGroup = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { mutate } = useMutation({
        mutationFn: async (id) => apiService.get(`${GROUP_SERVICE}/${id}/delete`),
        onMutate: async (id) => {
            await queryClient.cancelQueries(["groupsData"]);
            const previousGroups = queryClient.getQueryData(["groupsData"]);
            queryClient.setQueryData(["groupsData"], (old) => {
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
        onError: (err, _id, context) => {
            queryClient.setQueryData(["groupsData"], context.previousGroups);
            toast.error(resolveGroupDeleteErrorMessage(err, t));
        },
        onSuccess: (_data, id) => {
            queryClient.invalidateQueries(["groupsData"]);
            // Drop membership cache so a restored group edit cannot show deleted relations.
            queryClient.removeQueries({ queryKey: ["usersByGroup", id] });
            toast.success(t("app.forms.success_delete_module", { module: t("app.title.group_singular") }));
        },
    });

    return {
        handleUpdateGroup: (id) => {
            queryClient.removeQueries({ queryKey: ["usersByGroup", id] });
            navigate(`/group/update/${id}`);
        },
        handleDeleteGroup: (id) => {
            mutate(id);
        },
        handleSeeGroup: (id) => {
            queryClient.removeQueries({ queryKey: ["usersByGroup", id] });
            navigate(`/group/update/${id}?action=see`);
        },
    };
};

export default useActionsGroup;
