import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { URL_AND_KEYS } from "../../../../../../utils/urlAndKeys";

export const useCalendarMutation = ({
    idUser,
    idCase,
    selectedShedule,
    setAvailableForm,
    sendInformation,
}) => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();

    const { mutate, isPending } = useMutation({
        mutationFn: sendInformation,
        onMutate: async (data) => {
            await queryClient.cancelQueries([
                URL_AND_KEYS.calendar.key,
                idUser,
                idCase,
                selectedShedule,
            ]);
            const previousData = queryClient.getQueryData([
                URL_AND_KEYS.calendar.key,
                idUser,
                idCase,
                selectedShedule,
            ]);
            queryClient.setQueryData(
                [URL_AND_KEYS.calendar.key, idUser, idCase, selectedShedule],
                (old) => {
                    if (old && old.data) {
                        return {
                            ...old,
                            data: [...old.data, data?.dataPost],
                        };
                    }
                },
            );
            return { previousData };
        },
        onError: (err, _, context) => {
            queryClient.setQueryData(
                [URL_AND_KEYS.calendar.key, idUser, idCase, selectedShedule],
                context.previousData,
            );
            toast.error(err.response.data.message);
        },
        onSuccess: () => {
            queryClient.invalidateQueries([
                URL_AND_KEYS.calendar.key,
                idUser,
                idCase,
                selectedShedule,
            ]);
            toast.success(t("diary.calendar.alerts.done"));
            setAvailableForm(false);
        },
    });
    return { mutate, isPending };
};
