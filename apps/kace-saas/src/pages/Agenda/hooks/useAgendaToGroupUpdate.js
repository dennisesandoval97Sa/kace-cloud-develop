import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { toast } from "sonner";
import { useDispatch } from "react-redux";
import { setOpenModal } from "../../../redux/state/modalBehavior";
import { AGENDA_GROUP_SERVICE } from "@kace/urls";
import { sendInformation } from "../../../services/generic-send-information";

export const useAgendaToGroupUpdate = () => {
    const dispatch = useDispatch();
    const queryClient = useQueryClient();
    const { t } = useTranslation();

    const [state, setState] = useState({
        dataAgendaToGroup: {},
        previousGroups: null,
        agendaId: null,
    });

    const handleAgendaToGroup = (groups, id, previousDataAgendaToGroup) => {
        const data = groups.map((group) => ({
            agenda_id: id,
            group_id: group,
        }));
        setState({
            dataAgendaToGroup: data,
            previousGroups: previousDataAgendaToGroup,
            agendaId: id,
        });
    };

    const handleCache = async () => {
        await queryClient.invalidateQueries(["agendaToGroupForm", state.agendaId]);
        await queryClient.invalidateQueries(["agendaForm", state.agendaId]);
    };

    const { mutate: attach } = useMutation({
        mutationFn: sendInformation,
        onError: () => {
            toast.error(t("app.alerts.error"));
            dispatch(setOpenModal(false));
        },
        onSuccess: () => {
            handleCache();
            toast.success(t("app.alerts.done"));
            dispatch(setOpenModal(false));
        },
    });

    const { mutate: detach } = useMutation({
        mutationFn: sendInformation,
        onError: () => {
            toast.error(t("app.alerts.error"));
        },
        onSuccess: () => {
            handleAgendaToGroupUpdate();
            handleCache();
        },
    });

    const handleDetach = () => {
        if (!state.previousGroups) return;

        const dataDetach = state.previousGroups.map((group) => ({
            agenda_id: state.agendaId,
            group_id: group.id,
        }));

        const data = {
            id: null,
            url: `${AGENDA_GROUP_SERVICE}/batch/delete`,
            dataPost: dataDetach,
        };
        detach(data);
    };

    const handleAgendaToGroupUpdate = (agendaId = state.agendaId) => {
        const dataAgendaToGroup = agendaId
            ? state.dataAgendaToGroup.map((relationship) => ({
                  ...relationship,
                  agenda_id: agendaId,
              }))
            : state.dataAgendaToGroup;
        const data = {
            id: null,
            url: `${AGENDA_GROUP_SERVICE}/batch`,
            dataPost: dataAgendaToGroup,
        };
        attach(data);
    };

    return {
        handleAgendaToGroupUpdate,
        handleAgendaToGroup,
        handleDetach,
    };
};
