import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { sendInformation } from "@/services/generic-send-information";
import { getTranslatedError } from "@/utils/getTranslatedError";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";

const getApiErrorMessages = (error) => {
    const responseData = error?.response?.data;
    const legacyErrors = responseData?.errors;

    if (typeof legacyErrors === "string") return [legacyErrors];
    if (Array.isArray(legacyErrors)) {
        return legacyErrors
            .map((legacyError) => legacyError?.message ?? legacyError)
            .filter((message) => typeof message === "string");
    }

    return [responseData?.message, responseData?.error, error?.message].filter(
        (message) => typeof message === "string",
    );
};

const useMailAccountsMutation = () => {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const queryKey = [URL_AND_KEYS.mail_accounts.key];

    const { mutate, isPending } = useMutation({
        mutationFn: sendInformation,
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey });
            const previousQueries = queryClient.getQueriesData({ queryKey });

            if (variables.id) {
                queryClient.setQueriesData({ queryKey }, (old) => {
                    if (!Array.isArray(old?.data)) return old;
                    return {
                        ...old,
                        data: old.data.map((item) =>
                            item.id === variables.id ? { ...item, ...variables.dataPost, id: variables.id } : item,
                        ),
                    };
                });
            }

            return { previousQueries };
        },
        onError: (error, _variables, context) => {
            context?.previousQueries?.forEach(([previousQueryKey, data]) => {
                queryClient.setQueryData(previousQueryKey, data);
            });

            if (getApiErrorMessages(error).some((message) => message.includes("Host "))) {
                toast.error(t("mailAccounts.errors.hostNotAllowed"));
                return;
            }

            toast.error(getTranslatedError(error, t));
        },
        onSuccess: () => {
            toast.success(t("app.alerts.done"));
            navigate("/mail-account");
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey, exact: false });
        },
    });

    return { mutate, isPending };
};

export default useMailAccountsMutation;
