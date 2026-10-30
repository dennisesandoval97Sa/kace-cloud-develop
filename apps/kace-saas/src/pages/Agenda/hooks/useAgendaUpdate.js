import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AGENDA_SERVICE } from "@kace/urls";
import { sendInformation } from "../../../services/generic-send-information";
import { formatDataBeforePost } from "../data";
import { AGENDA_QUERY_KEY } from "../data/constants";
import { useAgendaToGroupUpdate } from "./useAgendaToGroupUpdate";

const updateAgendaLists = ({ queryClient, queries, variables }) => {
    queries.forEach(([queryKey]) => {
        queryClient.setQueryData(queryKey, (old) => {
            if (!Array.isArray(old?.data)) return old;

            const index = old.data.findIndex((item) => item.id === variables.id);
            if (index !== -1) {
                const updatedData = [...old.data];
                updatedData[index] = { ...updatedData[index], ...variables.dataPost };
                return {
                    ...old,
                    data: updatedData,
                };
            }

            return old;
        });
    });
};

export const useAgendaUpdate = () => {
    const queryClient = useQueryClient();
    const { t } = useTranslation();
    const { handleAgendaToGroupUpdate, handleAgendaToGroup, handleDetach } = useAgendaToGroupUpdate();

    const { mutate, isPending: isSending } = useMutation({
        mutationFn: sendInformation,
        onMutate: async (data) => {
            await queryClient.cancelQueries({ queryKey: [AGENDA_QUERY_KEY] });
            const previousQueries = queryClient.getQueriesData({ queryKey: [AGENDA_QUERY_KEY] });
            updateAgendaLists({ queryClient, queries: previousQueries, variables: data });
            return { previousQueries };
        },
        onError: (__, _, context) => {
            context?.previousQueries?.forEach(([queryKey, cachedData]) => {
                queryClient.setQueryData(queryKey, cachedData);
            });
            toast.error(t("app.alerts.error"));
        },
        onSuccess: (response, variables) => {
            if (variables?.id) {
                handleDetach();
            } else {
                const createdAgendaId = response?.data?.data?.id ?? variables?.dataPost?.id;
                handleAgendaToGroupUpdate(createdAgendaId);
            }
            queryClient.invalidateQueries({ queryKey: [AGENDA_QUERY_KEY], exact: false });
        },
    });

    const handleAgendaUpdate = async (values, previousDataAgendaToGroup) => {
        const { id, groups } = values;
        const url = id ? `${AGENDA_SERVICE}/${id}` : `${AGENDA_SERVICE}`;
        const dataPost = formatDataBeforePost(values, id);
        const data = { id, url, dataPost };
        handleAgendaToGroup(groups, dataPost.id ? dataPost.id : id, previousDataAgendaToGroup);
        mutate(data);
    };

    return { handleAgendaUpdate, isSending };
};
