import { BANNERS_SERVICE } from "../../../utils/URL";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { fetchDelete } from "@/services/deleteService";

const useBannersAction = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { t } = useTranslation();
    const { mutate } = useMutation({
        mutationFn: async (id) => fetchDelete(id, BANNERS_SERVICE),
        onMutate: async (id) => {
            await queryClient.cancelQueries(["bannersData"]);
            const previousGroups = queryClient.getQueryData(["bannersData"]);
            queryClient.setQueryData(["bannersData"], (old) => {
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
            queryClient.setQueryData(["bannersData"], context.previousGroups);
            toast.error(`${t("app.forms.error_delete")} ${t("app.title.banners")}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(["bannersData"]);
            toast.success(t("app.forms.success_delete_module", { module: t("app.title.banners") }));
        },
    });

    return {
        handleUpdateBanner: (id) => {
            navigate(`/banners/update/${id}`);
        },
        handleDeleteBanner: (id) => {
            mutate(id);
        },
        handleSeeBanner: (id) => {
            navigate(`/banners/update/${id}?action=see`);
        },
    };
};

export default useBannersAction;
