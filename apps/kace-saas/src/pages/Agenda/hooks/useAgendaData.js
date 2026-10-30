import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { genericView } from "../../../services/genericView";
import { genericSearch } from "../../../services/genericSearch";
import { filterAgendaToGroup } from "../data/queries";
import { AGENDA_SERVICE, AGENDA_GROUP_SERVICE, GROUP_SERVICE } from "@kace/urls";

export const useAgendaData = (id = null) => {
    const [groups, setGroups] = useState([]);

    const fetchAgendaToGroup = async (agendaId) => {
        const param = filterAgendaToGroup(agendaId);
        return genericSearch(`${AGENDA_GROUP_SERVICE}/search`, param, null, null, false);
    };

    const { data, isLoading } = useQuery({
        queryKey: ["agendaForm", id],
        queryFn: async () => genericView(`${AGENDA_SERVICE}/${id}`),
        enabled: !!id,
        refetchOnMount: true,
        staleTime: 1000 * 60,
        retry: 1,
    });

    const { data: agendaToGroupData, isLoading: isAgendaToGroupLoading } = useQuery({
        queryKey: ["agendaToGroupForm", id],
        queryFn: () => fetchAgendaToGroup(id),
        enabled: !!id,
        refetchOnMount: true,
        staleTime: 1000 * 60,
        retry: 1,
    });

    const groupIds = useMemo(
        () => agendaToGroupData?.data?.map((item) => item.group_id).filter(Boolean) ?? [],
        [agendaToGroupData],
    );
    const normalizedGroupIds = useMemo(() => [...groupIds].sort(), [groupIds]);
    const hasGroups = !!id && groupIds.length > 0;

    const { data: groupsData, isLoading: isGroupsQueryLoading } = useQuery({
        queryKey: ["groups", "agendaForm", id, normalizedGroupIds],
        queryFn: () =>
            genericSearch(
                `${GROUP_SERVICE}/search`,
                [
                    {
                        field: "id",
                        operator: "in",
                        value: groupIds.join(", "),
                        type: "AND",
                    },
                ],
                {
                    limit: groupIds.length,
                    offset: 0,
                },
            ),
        enabled: hasGroups,
        refetchOnMount: true,
        retry: 2,
    });

    const initializeStates = () => {
        setGroups([]);
    };

    useEffect(() => {
        if (!id || (!isAgendaToGroupLoading && groupIds.length === 0)) {
            setGroups([]);
        }
    }, [groupIds, id, isAgendaToGroupLoading]);

    useEffect(() => {
        if (groupsData && !isGroupsQueryLoading && id) {
            const groupsById = new Map(groupsData.data.map((item) => [item.id, item]));
            const hydratedGroups = groupIds
                .map((groupId) => groupsById.get(groupId))
                .filter(Boolean)
                .map((item) => ({
                    id: item.id,
                    label: item.nombre,
                }));
            setGroups(hydratedGroups);
        }
    }, [groupIds, groupsData, id, isGroupsQueryLoading]);

    return {
        data,
        isLoading,
        id,
        dataAgendaToGroup: groups,
        setDataAgendaToGroup: setGroups,
        initializeStates,
        isAgendaToGroupLoading,
        isGroupsLoading: isAgendaToGroupLoading || isGroupsQueryLoading,
    };
};
