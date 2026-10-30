import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { initialValuesRoles } from "../constants";
import useGenericViewQuery from "@/hooks/useGenericViewQuery";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import {
    generateAuxiliariesPermissions,
    mergeGrantedStatus,
} from "../utils/processRoleData";

const useRoleFormData = () => {
    const { id } = useParams();
    const isEditMode = !!id;

    const { data: permissionsList = {}, isLoading: isLoadingPermissionsList } =
        useGenericViewQuery({
            url: URL_AND_KEYS.permissions.url,
            keyQuery: ["permissionsList"],
        });

    const { data: auxiliariesList = [], isLoading: isLoadingAxuliariesList } =
        useGenericViewQuery({
            url: URL_AND_KEYS.auxDefinitions.url,
            keyQuery: ["auxiliariesList"],
        });

    const { data, isLoading } = useGenericViewQuery({
        url: `${URL_AND_KEYS.roles.url}/${id}`,
        keyQuery: URL_AND_KEYS.roles.key,
        searchById: [id],
        enabled: isEditMode,
    });

    const safeJsonParse = useMemo(
        () => JSON.parse(data?.permisos || "{}"),
        [data?.permisos],
    );

    const auxiliariesPermissions = useMemo(
        () =>
            generateAuxiliariesPermissions(auxiliariesList),
        [auxiliariesList, generateAuxiliariesPermissions],
    );

    const permissions = useMemo(
        () =>
            mergeGrantedStatus(
                { ...permissionsList, auxiliaries: auxiliariesPermissions },
                safeJsonParse,
            ),
        [
            safeJsonParse,
            permissionsList,
            auxiliariesPermissions,
            mergeGrantedStatus,
        ],
    );

    const formData = useMemo(
        () =>
            isEditMode
                ? { ...data, permisos: permissions || "" }
                : {
                    ...initialValuesRoles,
                    permisos: permissions || "",
                },
        [isEditMode, initialValuesRoles, permissions],
    );

    return {
        formData,
        isEditMode,
        isLoading:
            isLoading || isLoadingPermissionsList || isLoadingAxuliariesList,
    };
};

export default useRoleFormData;
