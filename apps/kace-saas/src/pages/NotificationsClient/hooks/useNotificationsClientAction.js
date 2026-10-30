import { CLIENT_NOTIFICATIONS_SERVICE } from "../../../utils/URL";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { fetchDelete } from "@/services/deleteService";

const useNotificationsClientAction = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { t } = useTranslation();
    const { mutate } = useMutation({
        mutationFn: async (id) => fetchDelete(id, CLIENT_NOTIFICATIONS_SERVICE),
        onMutate: async (id) => {
            await queryClient.cancelQueries(["notificationsClientData"]);
            const previousNotificationsClient = queryClient.getQueryData(["notificationsClientData"]);
            queryClient.setQueryData(["notificationsClientData"], (old) => {
                if (old && old.data) {
                    return {
                        ...old,
                        data: old.data.filter((item) => item.id !== id),
                    };
                }
                return old;
            });
            return { previousNotificationsClient };
        },
        onError: (_err, id, context) => {
            queryClient.setQueryData(["notificationsClientData"], context.previousNotificationsClient);
            toast.error(t("notificationsClient.deleteError"));
        },
        onSuccess: () => {
            queryClient.invalidateQueries(["notificationsClientData"]);
            toast.success(t("notificationsClient.deleteSuccess"));
        },
    });

    return {
        handleUpdateNotificationsClient: (id) => {
            navigate(`/notifications-client/update/${id}`);
        },
        handleDeleteNotificationsClient: (id) => {
            mutate(id);
        },
        handleSeeNotificationsClient: (id) => {
            navigate(`/notifications-client/update/${id}?action=see`);
        },
    };
};

export default useNotificationsClientAction;
