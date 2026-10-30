import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import useGeneralDelete from "@/hooks/useGeneralDelete";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import { apiService } from "@/utils/main";

const useActionsChannelHub = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { t } = useTranslation();
    const { mutate: deleteAction } = useGeneralDelete({ keyQuery: URL_AND_KEYS.channel_hub.key });

    const { mutate: registerAction, isPending: isRegistering } = useMutation({
        mutationFn: async (id) => {
            const response = await apiService.post(`${URL_AND_KEYS.channel_hub.url}/${id}/register`);
            return response;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [URL_AND_KEYS.channel_hub.key] });
            toast.success(t("channelHub.register_success"));
        },
        onError: () => {
            toast.error(t("channelHub.register_error"));
        },
    });

    return {
        handleUpdate: (id) => {
            navigate(`/channel-hub/update/${id}`);
        },
        handleDelete: (id) => {
            deleteAction({ id, url: URL_AND_KEYS.channel_hub.url });
        },
        handleSee: (id) => {
            navigate(`/channel-hub/update/${id}?action=see`);
        },
        handleRegister: (id) => {
            registerAction(id);
        },
        isRegistering,
    };
};

export default useActionsChannelHub;
