import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { initialValues } from "./data";
import { USER_SERVICE, REL_USERS_GROUP_SERVICE } from "../../utils/URL";
import { toast } from "sonner";
import { setShowGroupsSelect } from "../../redux/state/showGroupSelect";
import UserForm from "./components/UserForm";
import { GeneralLoader } from "@kace/ui-shared";
import { useTranslation } from "react-i18next";
import { apiService } from "../../utils/main";
import useGeneralMutation from "../../hooks/useGeneralMutation";
import { URL_AND_KEYS } from "../../utils/urlAndKeys";
import { genericHandleSendInformation } from "../../services/genericHandleSendInformation";
import { getUserFieldsToStrip } from "./getUserFieldsToStrip";

const UsersUpdateHandler = () => {
    const { t } = useTranslation();
    const [user, setUser] = useState(initialValues);
    const dispatch = useDispatch();
    const { id } = useParams();
    const queryClient = useQueryClient();
    const { mutate, isPending } = useGeneralMutation({
        keyQuery: URL_AND_KEYS.users.key,
        path: "/user",
    });
    const { data: userData, isLoading } = useQuery({
        queryKey: ["userForm", id],
        queryFn: async () => {
            const response = await apiService.get(`${USER_SERVICE}/${id}`);
            return response.data.data;
        },
        enabled: !!id,
    });

    const { data: groups, isLoading: isGroupsLoading } = useQuery({
        queryKey: ["groupsByUser", id],
        queryFn: async () => {
            const requestBody = {
                filter: [
                    {
                        field: "usuario_id",
                        operator: "eq",
                        value: id,
                        type: "AND",
                    },
                ],
                limit: 0,
                offset: 0,
            };

            return apiService.post(`${REL_USERS_GROUP_SERVICE}/search`, requestBody);
        },
        enabled: !!id,
    });

    function arraysAreExactlyEqual(arr1 = [], arr2 = []) {
        const a = arr1 ?? [];
        const b = arr2 ?? [];
        const result = a.length === b.length && a.every((value, index) => value === b[index]);
        return result;
    }

    const handleUserUpdate = async (values, setFormikErrors, setFormikStatus, groups = []) => {
        if (isPending) return;

        const isCreate = !id;
        const updatedValues = Object.keys(values).reduce((acc, key) => {
            const currentValue = values[key];
            const previousValue = user[key];
            if (key !== "id" && currentValue !== previousValue && !(!currentValue && !previousValue)) {
                acc[key] = currentValue;
            }
            if (key === "id" && currentValue) {
                acc[key] = currentValue;
            }

            return acc;
        }, {});

        const fields = getUserFieldsToStrip(values.account_type);
        let createValues = values;
        if (isCreate) {
            createValues = {
                ...values,
                group_ids: [...new Set((groups ?? []).filter(Boolean))],
                grupo_activo: values.grupo_activo || groups?.[0] || "",
            };
        }

        const data = genericHandleSendInformation({
            values: createValues,
            urlService: URL_AND_KEYS.users.url,
            setFormikErrors,
            setFormikStatus,
            pending: isPending,
            fields,
            options: {
                fieldsToKeepEmpty: ["codigos_externos", "external_id"],
                ...(isCreate ? { serverGeneratedId: true, isCreate: true } : {}),
            },
        });
        delete updatedValues.id;
        const userGroups = user?.groups?.map((g) => g.id) ?? [];
        const groupsChanged = !isCreate && !arraysAreExactlyEqual(userGroups, groups);
        if (!isCreate && Object.keys(updatedValues).length === 0 && !groupsChanged) {
            toast.info(t("app.alerts.noChanges"));
            return;
        }

        const syncGroupsAfterUserSave = async () => {
            const currentUserId = queryClient.getQueryData(["userInformation"])?.user?.id;
            const isSelfEdit = String(id) === String(currentUserId);
            let selfRemovedFromActiveGroup = false;
            if (groupsChanged) {
                const groupsToRemove = userGroups
                    .filter((group) => !groups.includes(group))
                    .map((group) => ({
                        usuario_id: id,
                        grupo_id: group,
                    }));

                const groupsToAdd = groups
                    .filter((group) => !userGroups.includes(group))
                    .map((group) => ({
                        usuario_id: id,
                        grupo_id: group,
                    }));

                try {
                    if (groupsToRemove.length > 0) {
                        const removeResponse = await apiService.post(
                            `${REL_USERS_GROUP_SERVICE}/delete`,
                            groupsToRemove,
                        );
                        if (removeResponse.status !== 200 && removeResponse.status !== 201) {
                            toast.warning(t("app.alerts.deleteGroup"));
                        }
                    }

                    if (groupsToAdd.length > 0) {
                        const addResponse = await apiService.post(`${REL_USERS_GROUP_SERVICE}`, groupsToAdd);
                        if (addResponse.status !== 200 && addResponse.status !== 201) {
                            toast.warning(t("app.alerts.saveGroup"));
                        }
                    }
                } catch {
                    // NO-SONAR: En caso de error se enseña un error amigable para el usuario
                    toast.warning(t("app.alerts.error"));
                }

                const activeGroupId = localStorage.getItem("userGroupId");
                selfRemovedFromActiveGroup =
                    isSelfEdit && groupsToRemove.some((u) => String(u.grupo_id) === String(activeGroupId));
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
            }

            queryClient.removeQueries({ queryKey: ["userForm"], exact: false });
            queryClient.invalidateQueries(["users"]);

            if (isSelfEdit && Object.keys(updatedValues).length > 0) {
                queryClient.setQueryData(["userInformation"], (old) => {
                    if (!old) return old;
                    return {
                        ...old,
                        user: { ...old.user, ...updatedValues },
                    };
                });

                if (updatedValues.rol_id) {
                    await queryClient.invalidateQueries({ queryKey: ["userInformation"] });
                    await queryClient.refetchQueries({ queryKey: ["userInformation"] });
                }
            }

            if (isSelfEdit && groupsChanged && !selfRemovedFromActiveGroup) {
                queryClient.setQueryData(["userInformation"], (old) => {
                    if (!old) return old;
                    const selectedGroups = (user.groups ?? []).filter((group) => groups.includes(group.id));
                    const existingIds = new Set(selectedGroups.map((group) => group.id));
                    const addedGroups = groups
                        .filter((groupId) => !existingIds.has(groupId))
                        .map((groupId) => ({ id: groupId, nombre: groupId }));
                    return {
                        ...old,
                        groups: [
                            ...selectedGroups.map(({ id: groupId, label, value }) => ({
                                id: groupId,
                                nombre: label ?? value ?? groupId,
                            })),
                            ...addedGroups,
                        ],
                    };
                });
            }

            if (selfRemovedFromActiveGroup) {
                dispatch(setShowGroupsSelect(true));
            }
        };

        if (!isCreate && Object.keys(updatedValues).length === 0 && groupsChanged) {
            await syncGroupsAfterUserSave();
            return;
        }

        mutate(data, {
            onSuccess: async () => {
                if (isCreate) {
                    queryClient.removeQueries({ queryKey: ["userForm"], exact: false });
                    queryClient.invalidateQueries(["users"]);
                    return;
                }
                await syncGroupsAfterUserSave();
            },
            onError: () => {
                toast.warning(t("app.alerts.error"));
            },
        });
    };

    useEffect(() => {
        if (userData) {
            const updatedUser = { ...userData, newUser: 2 };
            if (
                updatedUser.account_type !== undefined &&
                updatedUser.account_type !== null &&
                updatedUser.account_type !== ""
            ) {
                updatedUser.account_type = String(updatedUser.account_type);
            }
            if (groups) {
                const { data } = groups.data;
                updatedUser.groups = data?.items.map((relation) => ({
                    id: relation.grupo_id,
                    label: relation.grupo?.nombre,
                    value: relation.grupo?.nombre,
                }));
            }
            setUser(updatedUser);
        }
    }, [userData, groups]);

    return (
        <>
            {isLoading || isGroupsLoading ? (
                <GeneralLoader />
            ) : (
                <UserForm data={user} dataHandler={handleUserUpdate} isSending={isPending} />
            )}
        </>
    );
};

export default UsersUpdateHandler;
