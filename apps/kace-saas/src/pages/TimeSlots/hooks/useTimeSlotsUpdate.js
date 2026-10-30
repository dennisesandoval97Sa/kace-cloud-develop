import { useNavigate } from "react-router-dom";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { TIME_SLOTS_QUERY_KEY } from "../data/constants";
import { TIME_SLOT_SERVICE } from "@kace/urls";
import { toast } from "sonner";
import { sendInformation } from "../../../services/generic-send-information";
import { formatDataBeforePost } from "../data";
import { getI18ForErrors } from "@kace/utils";
import { findPublicErrorCode } from "@kace/error-codes";
import { getTranslatedError } from "@/utils/getTranslatedError";

export const useTimeSlotUpdate = () => {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const { t } = useTranslation();

    const { mutate, isPending: isSending } = useMutation({
        mutationFn: sendInformation,
        onMutate: async (data) => {
            const queryKey = [TIME_SLOTS_QUERY_KEY];
            await queryClient.cancelQueries({ queryKey });
            const previousQueries = queryClient.getQueriesData({ queryKey });
            const optimisticItem = {
                ...data.dataPost,
                id: data.id ?? data.dataPost.id,
            };

            previousQueries.forEach(([cachedQueryKey]) => {
                queryClient.setQueryData(cachedQueryKey, (old) => {
                    if (!Array.isArray(old?.data)) return old;

                    const index = data.id ? old.data.findIndex((item) => item.id === data.id) : -1;
                    if (index !== -1) {
                        const updatedData = [...old.data];
                        updatedData[index] = {
                            ...updatedData[index],
                            ...optimisticItem,
                        };
                        return {
                            ...old,
                            data: updatedData,
                        };
                    }

                    return old;
                });
            });

            return { previousQueries };
        },
        onError: (err, _, context) => {
            context?.previousQueries?.forEach(([queryKey, data]) => {
                queryClient.setQueryData(queryKey, data);
            });
            mapError("timeslot", err);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [TIME_SLOTS_QUERY_KEY], exact: false });
            toast.success(t("app.alerts.done"));
            navigate(`${TIME_SLOT_SERVICE}`);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: [TIME_SLOTS_QUERY_KEY], exact: false });
        },
    });

    const handleTimeSlotsUpdate = async (values) => {
        const { id } = values;
        const url = id ? `${TIME_SLOT_SERVICE}/${id}` : `${TIME_SLOT_SERVICE}`;
        const dataPost = formatDataBeforePost(values, id);
        const data = { id, url, dataPost };
        mutate(data);
    };

    const mapError = (position, error) => {
        const data = error?.response?.data;
        const publicErrorCode = findPublicErrorCode(data?.data?.code, data?.code);
        const hasPublicCompatibilityErrors =
            Array.isArray(data?.errors) && data.errors.some((apiError) => findPublicErrorCode(apiError?.code));

        if (publicErrorCode || hasPublicCompatibilityErrors) {
            toast.error(getTranslatedError(error, t));
        } else if (Array.isArray(data?.errors)) {
            for (const error of data.errors) {
                getI18ForErrors(t, position, error.message, (message) => {
                    toast.error(message);
                });
            }
        } else {
            toast.error(getTranslatedError(error, t));
        }
    };

    return { handleTimeSlotsUpdate, isSending };
};
