import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { initialValues } from "./data";
import { genericView } from "../../services/genericView";
import { GROUP_SERVICE, REL_USERS_GROUP_SERVICE } from "../../utils/URL";
import { toast } from "sonner";
import { setShowGroupsSelect } from "../../redux/state/showGroupSelect";
import { sendInformation } from "../../services/generic-send-information";
import GroupForm from "./components/GroupForm";
import { GeneralLoader } from "@kace/ui-shared";
import { useTranslation } from "react-i18next";
import { apiService } from "../../utils/main";
import { buildGroupMutationData, getGroupMembershipChanges } from "./utils/groupSave";
import { parseGroupHasActiveUsersError } from "./utils/activeGroupUsersDisplay";
import { getTranslatedError } from "../../utils/getTranslatedError";
import GroupActiveUsersBlockDialog from "./components/GroupActiveUsersBlockDialog";

const GroupUpdateHandler = () => {
    const { t } = useTranslation();
    const [group, setGroup] = useState(initialValues);
    const [relatedUsers, setRelatedUsers] = useState({ users: [], count: 0 });
    const [currentUsers, setCurrentUsers] = useState([]);
    const [searchQuery, setSearchQuery] = useState({ filter: "", input: "" });
    const [page, setPage] = useState(0);
    const [dataUsers, setDataUsers] = useState({ users: [], count: 0 });
    const [areAllUsersByGroupFetched, setAreAllUsersByGroupFetched] = useState(false);
    const [isMembershipSynced, setIsMembershipSynced] = useState(false);
    const [activeUsersBlock, setActiveUsersBlock] = useState(null);
    const dispatch = useDispatch();
    const queryClient = useQueryClient();
    const { id } = useParams();
    const navigate = useNavigate();
    const { data: dataGroupSelected, isLoading } = useQuery({
        queryKey: ["groupsData", id],
        queryFn: () => genericView(`${GROUP_SERVICE}/${id}`),
        enabled: !!id,
    });

    // Memberships must be revalidated on every edit visit (delete clears relations;
    // restoring a group must not reuse a stale usersByGroup React Query cache).
    const { data: users, isFetchedAfterMount } = useQuery({
        queryKey: ["usersByGroup", id, page],
        queryFn: async () =>
            apiService.post(`${REL_USERS_GROUP_SERVICE}/search`, {
                filter: [
                    {
                        field: "rel_usuarios_grupos.grupo_id",
                        operator: "eq",
                        value: `${id}`,
                        type: "AND",
                    },
                ],
                relationship: null,
                order: null,
                limit: 100,
                offset: page * 50,
            }),
        enabled: !!id && !areAllUsersByGroupFetched,
        staleTime: 0,
        gcTime: 0,
        refetchOnMount: "always",
    });

    useEffect(() => {
        setRelatedUsers({ users: [], count: 0 });
        setDataUsers({ users: [], count: 0 });
        setCurrentUsers([]);
        setAreAllUsersByGroupFetched(false);
        setIsMembershipSynced(false);
        setPage(0);
        if (id) {
            queryClient.removeQueries({ queryKey: ["usersByGroup", id] });
        }
    }, [id, queryClient]);

    useEffect(() => {
        if (dataGroupSelected) {
            setGroup(dataGroupSelected.data);
        }
    }, [dataGroupSelected]);
    useEffect(() => {
        if (searchQuery.filter !== "") {
            setDataUsers({ users: [], count: 0 });
        }
    }, [searchQuery]);

    useEffect(() => {
        // Ignore cached placeholders; only hydrate after a fetch for this mount.
        if (!users || !isFetchedAfterMount) {
            return;
        }
        const newArray = [];
        const relatedUsersFormat = [];
        const items = users?.data?.data?.items ?? [];
        const _users = items.map(({ usuario_id, usuario }) => {
            newArray.push({ usuario_id, grupo_id: id });
            relatedUsersFormat.push({ id: usuario_id, label: usuario?.nombre, value: usuario?.nombre });
            return { usuario_id, nombre: usuario?.nombre };
        });
        const quantityOfUsers = Number(users?.data?.metadata?.count?.count ?? items.length);
        setRelatedUsers({ users: _users, count: quantityOfUsers });
        setAreAllUsersByGroupFetched(checkIfAllUserGroupsAreVisible());
        setCurrentUsers(newArray);
        setDataUsers({ users: relatedUsersFormat, count: quantityOfUsers });
        setIsMembershipSynced(true);
    }, [users, isFetchedAfterMount, id]);

    const { mutate, isPending: isSending } = useMutation({
        mutationFn: sendInformation,
        onMutate: async (data) => {
            await queryClient.cancelQueries(["groupsData"]);
            const previousData = queryClient.getQueryData(["groupsData"]);
            queryClient.setQueryData(["groupsData"], (old) => {
                if (old && old.data) {
                    return {
                        ...old,
                        data: [...old.data, data.dataPost],
                    };
                }
            });
            return { previousData };
        },
        onError: (err, _vars, context) => {
            queryClient.setQueryData(["groupsData"], context?.previousData);
            const blocked = parseGroupHasActiveUsersError(err);
            if (blocked) {
                setActiveUsersBlock({ count: blocked.count, users: blocked.users });
                return;
            }
            toast.error(getTranslatedError(err, t));
        },
        onSuccess: () => {
            queryClient.invalidateQueries(["groupsData"]);
            toast.success(t("app.alerts.done"));
            navigate("/group");
        },
        onSettled: () => {
            queryClient.invalidateQueries(["groupsData"]);
        },
    });

    const checkIfAllUserGroupsAreVisible = () => {
        const dataUserIds = new Set(dataUsers.users.map((user) => user.id));
        return relatedUsers.users.every((relatedUser) => dataUserIds.has(relatedUser.usuario_id));
    };

    const handleGroupUpdate = async (values, arrayUsers) => {
        const data = buildGroupMutationData(values, arrayUsers);
        mutate(data, {
            onSuccess: async () => {
                const { toAdd: usuariosGrupo, toRemove: usuariosEliminar } = getGroupMembershipChanges({
                    isCreate: data.isCreate,
                    groupId: data.id,
                    currentUsers,
                    selectedUserIds: arrayUsers,
                });

                if (usuariosGrupo.length > 0) {
                    const responseAgregar = await apiService.post(REL_USERS_GROUP_SERVICE, usuariosGrupo);
                    if (responseAgregar.status === 200) {
                        toast.success(t("app.alerts.groupMembershipUpdated"));
                    }
                }

                if (usuariosEliminar.length > 0) {
                    const responseEliminar = await apiService.post(
                        `${REL_USERS_GROUP_SERVICE}/delete`,
                        usuariosEliminar,
                    );
                    if (responseEliminar.status === 200) {
                        toast.success(t("app.alerts.groupMembershipUpdated"));
                    }
                }

                const activeGroupId = localStorage.getItem("userGroupId");
                const currentUserId = queryClient.getQueryData(["userInformation"])?.user?.id;
                const selfRemovedFromActiveGroup = usuariosEliminar.some(
                    (u) =>
                        String(u.usuario_id) === String(currentUserId) && String(u.grupo_id) === String(activeGroupId),
                );
                if (selfRemovedFromActiveGroup) {
                    localStorage.removeItem("userGroupId");
                    queryClient.setQueryData(["userInformation"], (old) => {
                        if (!old) return old;
                        return {
                            ...old,
                            groups: (old.groups ?? []).filter((g) => String(g.id) !== String(activeGroupId)),
                            user: { ...old.user, selectedGroup: undefined },
                        };
                    });
                }

                queryClient.removeQueries({ queryKey: ["groupsData"], exact: false });
                queryClient.invalidateQueries(["groups"]);
                queryClient.invalidateQueries(["userInformation"]);
                queryClient.invalidateQueries(["usersByGroup"]);

                if (selfRemovedFromActiveGroup) {
                    dispatch(setShowGroupsSelect(true));
                }
            },
        });
    };

    const isFormLoading = isLoading || (!!id && !isMembershipSynced);

    return (
        <>
            {isFormLoading ? (
                <GeneralLoader />
            ) : (
                <GroupForm
                    key={id}
                    data={group}
                    relatedUsers={relatedUsers}
                    dataHandler={handleGroupUpdate}
                    isSending={isSending}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    page={page}
                    setPage={setPage}
                    dataUsers={dataUsers}
                />
            )}
            <GroupActiveUsersBlockDialog
                open={Boolean(activeUsersBlock)}
                count={activeUsersBlock?.count}
                users={activeUsersBlock?.users}
                onClose={() => setActiveUsersBlock(null)}
            />
        </>
    );
};

export default GroupUpdateHandler;
