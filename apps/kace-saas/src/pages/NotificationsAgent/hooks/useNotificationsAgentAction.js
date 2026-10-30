import { USER_NOTIFICATIONS_SERVICE } from "../../../utils/URL";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { fetchDelete } from "@/services/deleteService";

const useNotificationsAgentAction = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { t } = useTranslation();
    const { mutate } = useMutation({
        mutationFn: async (id) => fetchDelete(id, USER_NOTIFICATIONS_SERVICE),
        onMutate: async (id) => {
            await queryClient.cancelQueries(["notificationsAgentData"]);
            const previousNotificationsAgent = queryClient.getQueryData(["notificationsAgentData"]);
            queryClient.setQueryData(["notificationsAgentData"], (old) => {
                if (old && old.data) {
                    return {
                        ...old,
                        data: old.data.filter((item) => item.id !== id),
                    };
                }
                return old;
            });
            return { previousNotificationsAgent };
        },
        onError: (_err, id, context) => {
            queryClient.setQueryData(["notificationsAgentData"], context.previousNotificationsAgent);
            toast.error(t("notificationsAgent.deleteError"));
        },
        onSuccess: () => {
            queryClient.invalidateQueries(["notificationsAgentData"]);
            toast.success(t("notificationsAgent.deleteSuccess"));
        },
    });

    return {
        handleUpdateNotificationsAgent: (id) => {
            navigate(`/notifications-agent/update/${id}`);
        },
        handleDeleteNotificationsAgent: (id) => {
            mutate(id);
        },
        handleSeeNotificationsAgent: (id) => {
            navigate(`/notifications-agent/update/${id}?action=see`);
        },
    };
};

export default useNotificationsAgentAction;
