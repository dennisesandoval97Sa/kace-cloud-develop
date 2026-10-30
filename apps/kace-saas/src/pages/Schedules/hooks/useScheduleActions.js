import { apiService } from "@kace/utils";
import { SCHEDULES_SERVICE } from "../../../utils/URL";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { genericView } from "../../../services/genericView";
import { INITIAL_SCHEDULE_VALUES } from "../data/constants";
import { handleStateTimer } from "../../../utils/form-format";
import { genericHandleSendInformation } from "../../../services/genericHandleSendInformation";
import useGeneralMutation from "../../../hooks/useGeneralMutation";
import { useTranslation } from "react-i18next";
import { getTranslatedError } from "../../../utils/getTranslatedError";

async function fetchDelete(id) {
    const response = await apiService.get(`${SCHEDULES_SERVICE}/${id}/delete`);
    if (response.status !== 200 && response.status !== 201) {
        // Keeps the response so onError can translate its public error code or show its message.
        throw Object.assign(new Error(response.data?.message), { response });
    }
    return response;
}

const useScheduleActions = () => {
    const { t } = useTranslation();
    const [schedule, setSchedule] = useState(INITIAL_SCHEDULE_VALUES);
    const [isEditing, setIsEditing] = useState(false);
    const { id } = useParams();
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    const { mutate, isPending } = useGeneralMutation({
        keyQuery: "scheduleData",
        path: "/schedules",
    });

    const { data, isLoading, isFetching } = useQuery({
        queryKey: ["scheduleForm", id],
        queryFn: async () => genericView(`${SCHEDULES_SERVICE}/${id}`),
        enabled: !!id,
    });

    const { mutate: mutateDelete, isPending: isPendingDelete } = useMutation({
        mutationFn: fetchDelete,
        onMutate: async (id) => {
            await queryClient.cancelQueries(["scheduleData"]);
            const previousData = queryClient.getQueryData(["scheduleData"]);
            queryClient.setQueryData(["scheduleData"], (old) => {
                if (old && old.data) {
                    return {
                        ...old,
                        data: old.data.filter((item) => item.id !== id),
                    };
                }
                return old;
            });
            return { previousData };
        },
        onError: (err, _id, context) => {
            queryClient.setQueryData(["scheduleData"], context.previousData);
            // Without an HTTP response (network failure) there is no public code nor API message to translate.
            toast.error(
                err?.response
                    ? getTranslatedError(err, t)
                    : `${t("app.forms.error_delete")} ${t("app.title.schedules")}`,
            );
        },
        onSuccess: () => {
            queryClient.invalidateQueries(["scheduleData"]);
            toast.success(t("app.forms.success_delete_module", { module: t("app.title.schedules") }));
        },
        onSettled: () => {
            queryClient.invalidateQueries(["scheduleData"]);
        },
    });

    const handleSchedule = async (values, setFormikErrors, setFormikStatus) => {
        const data = genericHandleSendInformation({
            values,
            urlService: SCHEDULES_SERVICE,
            setFormikErrors,
            setFormikStatus,
            pending: isPending,
        });
        mutate(data);
    };

    useEffect(() => {
        if (data) {
            setSchedule(handleStateTimer(data));
        }
    }, [data]);

    return {
        handleUpdateSchedule: (id) => {
            setIsEditing(true);
            navigate(`/schedules/update/${id}`);
        },
        handleSeeSchedule: (id) => {
            navigate(`/schedules/update/${id}?action=see`);
        },
        handleDeleteSchedule: (id) => {
            mutateDelete(id);
        },
        schedule,
        isLoading,
        isFetching,
        handleSchedule,
        isPending,
        isPendingDelete,
        isEditing,
        setIsEditing,
    };
};

export default useScheduleActions;
