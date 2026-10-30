import { fetchDelete } from "@/services/deleteService";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

const useGeneralDelete = ({ keyQuery = "", successMessage, errorMessage }) => {
    const queryClient = useQueryClient();
    const { t } = useTranslation();
    const { mutate } = useMutation({
        mutationFn: async (data) => fetchDelete(data.id, data.url),
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey: [keyQuery] });
            const previousQueries = queryClient.getQueriesData({ queryKey: [keyQuery] });
            queryClient.setQueriesData({ queryKey: [keyQuery] }, (old) => {
                if (Array.isArray(old?.data)) {
                    return {
                        ...old,
                        data: old.data.filter((item) => item.id !== variables.id),
                    };
                }
                return old;
            });
            return { previousQueries };
        },
        onError: (_err, _variables, context) => {
            context?.previousQueries?.forEach(([queryKey, data]) => {
                queryClient.setQueryData(queryKey, data);
            });
            toast.error(errorMessage ?? t("app.forms.error_delete"));
        },
        onSuccess: () => {
            toast.success(successMessage ?? t("app.forms.success_delete"));
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: [keyQuery] });
        },
    });
    return { mutate };
};

export default useGeneralDelete;
